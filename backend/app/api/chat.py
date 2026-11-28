from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
import time
import re
import uuid

from ..core.database import get_db
from ..core.config import settings
from ..core.auth import get_current_active_user
from ..models.database import User, ChatHistory, ChatConversation, Document, VoiceConversation
from ..models.schemas import (
    ChatMessage, 
    ChatResponse, 
    ChatHistory as ChatHistorySchema,
    ErrorResponse
)
from ..services.llm_service import japanese_service
from ..services import vocab_mcq_service
from ..services.kanji_dictionary_service import kanji_dictionary_service
from ..services.vector_db import chroma_service
from ..services.chat_conversations import build_recent_chat_context, normalize_title
from ..services.chat_grounding import CHAT_DOCUMENT_TYPES, reviewed_reference, relevant_chat_documents, finalize_chat_answer, clean_chat_answer
from ..services.chat_language import (
    detect_chat_language,
    needs_history,
    is_translation_question,
    same_language_translation,
    is_chitchat_query,
    chitchat_direct_answer,
)
from ..services.chat_quality import scope_reply,uncertainty,public_source,question_kind,violations,unverifiable_request
from ..services.chat_knowledge import local_knowledge,library_knowledge,local_translation,reading

router = APIRouter(prefix="/chat", tags=["chat"])


def _prepare_text_conversation(db: Session, user: User, message: ChatMessage) -> ChatConversation:
    if message.conversation_id:
        conversation = db.query(ChatConversation).filter(
            ChatConversation.id == message.conversation_id,
            ChatConversation.user_id == user.id,
        ).first()
        if conversation is None:
            raise HTTPException(status_code=404, detail="conversation_not_found")
        if conversation.mode != "text":
            raise HTTPException(status_code=409, detail="conversation_mode_mismatch")
        has_messages = db.query(ChatHistory.id).filter(
            ChatHistory.user_id == user.id,
            ChatHistory.conversation_id == conversation.id,
        ).first()
        if conversation.title_is_auto and not has_messages:
            conversation.title = normalize_title(message.message)
        return conversation

    now = datetime.now(timezone.utc)
    conversation = ChatConversation(
        id=uuid.uuid4(), user_id=user.id, title=normalize_title(message.message),
        title_is_auto=True, is_pinned=False, mode="text", created_at=now, last_activity_at=now,
    )
    db.add(conversation)
    db.flush()
    return conversation


def _save_chat_entry(db: Session, conversation: ChatConversation, entry: ChatHistory) -> None:
    conversation.last_activity_at = datetime.now(timezone.utc)
    entry.conversation_id = conversation.id
    db.add(entry)
    db.commit()


def _grounded_reply(db,conversation,user,message,answer,sources,start_time):
    from ..services.chat_quality import localized_sources
    language=detect_chat_language(message.message,message.response_language or user.ui_language)
    sources=localized_sources(sources,language)
    critical={'language','chinese_prose','prompt_echo','internal_labels','length'}
    if critical.intersection(violations(message.message,answer,language)):
        answer=uncertainty(language);sources=[]
    answer=clean_chat_answer(answer,language)
    row=ChatHistory(user_id=user.id,question=message.message,answer=answer,
        jlpt_level=message.jlpt_level or user.current_jlpt_level,grammar_points=[],translation=None,sources=sources)
    _save_chat_entry(db,conversation,row)
    return ChatResponse(answer=answer,jlpt_level=row.jlpt_level,grammar_points=[],translation=None,sources=sources,
        response_time=time.time()-start_time,conversation_id=conversation.id)


def find_single_kanji_request(text: str) -> str | None:
    if not re.search(r"\bkanji\b|漢字|chữ", text, re.IGNORECASE):
        return None
    matches = re.findall(r"[\u4e00-\u9fff]", text)
    return matches[0] if len(set(matches)) == 1 else None


def contains_japanese(text: str) -> bool:
    return bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", text or ""))


def build_kanji_answer(entry: dict, language: str = 'vi') -> str:
    examples = entry.get("examples") or []
    example_lines = []
    for example in examples[:3]:
        word = example.get("word") or ""
        reading = example.get("reading") or ""
        meaning = (example.get('meaning_vi') or example.get('meaning') or '') if language=='vi' else (example.get('meaning_en') or '')
        if word and reading and meaning:example_lines.append(f"- **{word}** ({reading}): {meaning}".strip())
    examples_text = "\n".join(example_lines) if example_lines else ("- No checked example available." if language=='en' else "- Chưa có ví dụ trong từ điển cục bộ.")
    onyomi = ", ".join(entry.get("onyomi") or []) or "-"
    kunyomi = ", ".join(entry.get("kunyomi") or []) or "-"
    if language=='en':
        return (f"### Kanji: **{entry['kanji']}**\n\n- **Meaning:** {entry.get('meaning_en') or 'No checked English meaning available'}\n"
            f"- **On readings:** {onyomi}\n- **Kun readings:** {kunyomi}\n- **Strokes:** {entry.get('stroke_count') or '-'}\n\n"
            f"**Examples:**\n{examples_text}")
    return (
        f"### 🈸 Chữ Hán (Kanji): **{entry['kanji']}**\n\n"
        f"- **Ý nghĩa:** {entry.get('meaning') or entry.get('meaning_vi') or 'Chưa có dữ liệu'}\n"
        f"- **Cấp độ JLPT:** {entry.get('jlpt') or 'N/A'}\n"
        f"- **Số nét:** {entry.get('strokes') or entry.get('stroke_count') or 'N/A'} nét\n"
        f"- **Âm On (Onyomi):** {onyomi}\n"
        f"- **Âm Kun (Kunyomi):** {kunyomi}\n\n"
        f"**Từ vựng & Ví dụ thường gặp:**\n{examples_text}\n\n"
        f"*(Tra cứu chuẩn xác từ Từ điển Kanji JLPT SenpaiAI)*"
    )





@router.post('/message', response_model=ChatResponse)
async def send_message(message: ChatMessage,
    current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Resolve language and intent, retrieve checked evidence, generate and validate."""
    from ..services.chat_quality import clarification
    try:
        start=time.time()
        conversation=_prepare_text_conversation(db,current_user,message)
        language=detect_chat_language(message.message,message.response_language or current_user.ui_language)
        previous=db.query(ChatHistory).filter(ChatHistory.user_id==current_user.id,
            ChatHistory.conversation_id==conversation.id).order_by(ChatHistory.created_at.desc(),ChatHistory.id.desc()).limit(settings.chat_context_max_turns).all()
        previous.reverse()
        follow=needs_history(message.message) and bool(previous)
        focus=(previous[-1].question+'\n'+message.message) if follow else message.message
        history=build_recent_chat_context(previous,max_turns=settings.chat_context_max_turns,
            max_chars=settings.chat_context_max_chars) if follow else ''
        scoped=scope_reply(message.message,language)
        if scoped:return _grounded_reply(db,conversation,current_user,message,scoped,[],start)
        greeting=chitchat_direct_answer(message.message,language)
        if greeting:return _grounded_reply(db,conversation,current_user,message,greeting,[],start)
        same=same_language_translation(message.message,language)
        if same:return _grounded_reply(db,conversation,current_user,message,same,[],start)
        kind=question_kind(focus)
        if unverifiable_request(focus):return _grounded_reply(db,conversation,current_user,message,uncertainty(language),[],start)
        if kind in ('general','unclear') and not follow:
            return _grounded_reply(db,conversation,current_user,message,clarification(language),[],start)
        single=find_single_kanji_request(message.message) if kind=='kanji' else None
        if single:
            entry=kanji_dictionary_service.get_entry(single)
            if entry:return _grounded_reply(db,conversation,current_user,message,build_kanji_answer(entry,language),
                [{'title':single,'type':'kanji_dictionary','url':'/kanji','jlpt_level':entry.get('jlpt'),'relevance':1.0}],start)
        context,sources=reviewed_reference(focus,language)
        fallback=context.replace('Reviewed reference:\n','').strip() if context else None
        if not context and kind=='translation' and not follow:
            context,sources,fallback=local_translation(db,focus,language)
            if fallback:return _grounded_reply(db,conversation,current_user,message,fallback,sources,start)
        if not context:
            context,sources,fallback=local_knowledge(db,focus,language)
        if fallback and not follow and kind in ('grammar','vocabulary','analysis','exercise'):
            return _grounded_reply(db,conversation,current_user,message,fallback,sources,start)
        if not context:context,sources,fallback=library_knowledge(db,focus,language)
        if not context and kind!='translation':
            level=message.jlpt_level or current_user.current_jlpt_level
            public_ids = {str(doc_id) for (doc_id,) in db.query(Document.id).filter(
                Document.user_id.is_(None), Document.document_type.in_(CHAT_DOCUMENT_TYPES),
            )}
            for filters in ([{'jlpt_level': level}, None] if level else [None]):
                results = chroma_service.search_documents(
                    focus, n_results=12, filter_dict=filters, document_types=CHAT_DOCUMENT_TYPES, document_ids=public_ids,
                )
                rows = relevant_chat_documents([
                    r for r in results if r.get('content', '').strip()
                    and public_source({'type': r.get('source', {}).get('document_type', ''),
                        'title': r.get('source', {}).get('title', ''),
                        'url': r.get('source', {}).get('source_url', '')})
                ], focus)
                if rows:
                    break
            context='\n\n'.join(r.get('content','') for r in rows)
            sources=[{'id':r.get('source',{}).get('id'),'title':r.get('source',{}).get('title',''),
                'type':r.get('source',{}).get('document_type','lesson'),
                'url':r.get('source',{}).get('source_url') or f"/library?doc_id={r.get('source',{}).get('id')}",
                'jlpt_level':r.get('source',{}).get('jlpt_level'),
                'relevance':r.get('similarity_score',0)}for r in rows]
        if not context and kind!='translation':
            return _grounded_reply(db,conversation,current_user,message,uncertainty(language),[],start)
        response_context=('[EVIDENCE]\n'+context if context else '')+('\n\n[PRIOR_TURNS]\n'+history if history else '')
        try:
            generated=await japanese_service.chat_response(question=message.message,context=response_context,
                jlpt_level=message.jlpt_level or current_user.current_jlpt_level,response_language=language)
            answer=finalize_chat_answer(message.message,generated['answer'],language)
        except RuntimeError:
            answer=fallback or uncertainty(language)
        if answer == uncertainty(language) or violations(message.message,answer,language,context):
            answer = fallback or uncertainty(language)
        if answer == uncertainty(language):
            sources = []
        if kind=='translation' and not sources:
            prefix='**Bản dịch gợi ý, chưa đối chiếu học liệu:**' if language=='vi' else '**Suggested translation, not checked against reference material:**'
            answer=prefix+'\n\n'+answer
        return _grounded_reply(db,conversation,current_user,message,answer,sources,start)
    except HTTPException:
        db.rollback();raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503,detail='chat_generation_failed') from exc


@router.get("/history", response_model=List[ChatHistorySchema])
async def get_chat_history(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's chat history."""
    
    chat_history = db.query(ChatHistory)\
        .filter(ChatHistory.user_id == current_user.id)\
        .order_by(ChatHistory.created_at.asc())\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    return chat_history

@router.delete("/history/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_entry(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a specific chat entry."""
    
    chat_entry = db.query(ChatHistory)\
        .filter(ChatHistory.id == chat_id)\
        .filter(ChatHistory.user_id == current_user.id)\
        .first()
    
    if not chat_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat entry not found"
        )
    conversation_id = chat_entry.conversation_id
    db.delete(chat_entry)
    db.flush()
    if conversation_id:
        voice = db.query(VoiceConversation).filter(
            VoiceConversation.id == conversation_id,
            VoiceConversation.user_id == current_user.id,
        ).first()
        if voice:
            voice.turn_count = db.query(ChatHistory).filter(
                ChatHistory.conversation_id == conversation_id,
                ChatHistory.user_id == current_user.id,
                ChatHistory.input_mode == "voice",
            ).count()
    db.commit()
    
    return None

@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_chat_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Clear all chat history for current user."""
    
    # Clearing chat also clears voice conversation summaries; turns are removed below.
    db.query(VoiceConversation).filter(VoiceConversation.user_id == current_user.id).delete(synchronize_session=False)
    db.query(ChatHistory)\
        .filter(ChatHistory.user_id == current_user.id)\
        .delete()
    db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id).delete(synchronize_session=False)
    
    db.commit()
    
    return None

@router.get("/search", response_model=List[ChatHistorySchema])
async def search_chat_history(
    query: str,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search through chat history."""
    
    # Simple text search in questions and answers
    chat_history = db.query(ChatHistory)\
        .filter(ChatHistory.user_id == current_user.id)\
        .filter(
            ChatHistory.question.ilike(f"%{query}%") |
            ChatHistory.answer.ilike(f"%{query}%")
        )\
        .order_by(ChatHistory.created_at.asc())\
        .limit(limit)\
        .all()
    
    return chat_history

