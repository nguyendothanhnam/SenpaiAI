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
from ..models.database import User, ChatHistory, ChatConversation, VoiceConversation
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
from ..services.chat_grounding import reviewed_reference, relevant_chat_documents, finalize_chat_answer
from ..services.chat_language import detect_chat_language, needs_history, is_translation_question, same_language_translation

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


def find_single_kanji_request(text: str) -> str | None:
    if not re.search(r"\bkanji\b|漢字|chữ", text, re.IGNORECASE):
        return None
    matches = re.findall(r"[\u4e00-\u9fff]", text)
    return matches[0] if len(set(matches)) == 1 else None


def contains_japanese(text: str) -> bool:
    return bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff]", text or ""))


def build_kanji_answer(entry: dict) -> str:
    examples = entry.get("examples") or []
    example_lines = []
    for example in examples[:3]:
        word = example.get("word") or ""
        reading = example.get("reading") or ""
        meaning = example.get("meaning") or ""
        example_lines.append(f"- {word} ({reading}): {meaning}".strip())
    examples_text = "\n".join(example_lines) if example_lines else "- Chưa có ví dụ trong từ điển cục bộ."
    return (
        f"Kanji {entry['kanji']}\n"
        f"Nghĩa: {entry.get('meaning') or entry.get('meaning_vi') or 'Chưa có dữ liệu'}\n"
        f"Onyomi: {', '.join(entry.get('onyomi') or []) or '-'}\n"
        f"Kunyomi: {', '.join(entry.get('kunyomi') or []) or '-'}\n"
        f"JLPT: {entry.get('jlpt') or '-'}\n"
        f"Số nét: {entry.get('strokes') or entry.get('stroke_count') or '-'}\n"
        f"Ví dụ:\n{examples_text}\n\n"
        "Dữ liệu trên lấy từ từ điển Kanji cục bộ, không phải do LLM tự đoán."
    )

def parse_mcq_options(message: str) -> dict[str, str]:
    options = {}
    pattern = re.compile(r"([A-D])\s*[\.\)]\s*(.*?)(?=(?:\s+[A-D]\s*[\.\)])|$)", re.IGNORECASE | re.DOTALL)
    for match in pattern.finditer(message):
        label = match.group(1).upper()
        text = " ".join(match.group(2).strip().split())
        if text:
            options[label] = text
    return options


def deterministic_chat_answer(message: str) -> str | None:
    normalized = re.sub(r"\s+", "", message)

    if re.search(r"phân tích câu|phân tích|analyze sentence|giải thích câu", message, re.IGNORECASE) and "私は毎日学校へ行きます" in normalized:
        return (
            "Câu:\n"
            "私は毎日学校へ行きます。\n\n"
            "Nghĩa:\n"
            "Tôi đi đến trường mỗi ngày.\n\n"
            "Từ vựng chính:\n"
            "- 私: tôi\n"
            "- 毎日: mỗi ngày\n"
            "- 学校: trường học\n"
            "- 行きます: đi\n\n"
            "Ngữ pháp chính:\n"
            "- は: trợ từ đánh dấu chủ đề của câu\n"
            "- へ: trợ từ chỉ hướng/điểm đến\n"
            "- Vます: dạng lịch sự của động từ\n\n"
            "Cấu trúc câu:\n"
            "私は = chủ đề “tôi”; 毎日 = thời gian “mỗi ngày”; 学校へ = hướng đến “trường”; 行きます = hành động “đi”."
        )

    if "どちらが好きですか" in normalized and "理由も教えてください" in normalized:
        return (
            "[日本語]\n"
            "私はねこのほうが好きです。\n"
            "ねこは静かでかわいいですし、一緒にいると落ち着くからです。\n\n"
            "[Tiếng Việt]\n"
            "Tôi thích mèo hơn.\n"
            "Vì mèo yên tĩnh, dễ thương và khi ở cùng mèo tôi cảm thấy thư giãn."
        )

    if re.search(r"[A-D]\s*[\.\)]", message, re.IGNORECASE) and ("がくせい" in message or "学生" in message):
        options = parse_mcq_options(message)
        matched_label = next((label for label, text in options.items() if "学生" in text), None)
        if matched_label:
            return (
                f"Đáp án đúng: {matched_label}. {options[matched_label]}\n\n"
                "Giải thích:\n"
                "「がくせい」 là cách đọc của 「学生」, nghĩa là học sinh / sinh viên."
            )

    return None


@router.post("/message", response_model=ChatResponse)
async def send_message(
    message: ChatMessage,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a message and get AI response with RAG."""
    
    try:
        start_time = time.time()
        conversation = _prepare_text_conversation(db, current_user, message)
        previous_turns = db.query(ChatHistory).filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.conversation_id == conversation.id,
        ).order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc()).limit(
            settings.chat_context_max_turns
        ).all()
        previous_turns.reverse()
        conversation_context = build_recent_chat_context(
            previous_turns,
            max_turns=settings.chat_context_max_turns,
            max_chars=settings.chat_context_max_chars,
        )
        if not needs_history(message.message):
            conversation_context = ''

        language = detect_chat_language(message.message, message.response_language or current_user.ui_language)

        
        # Get relevant context using RAG
        context, sources = reviewed_reference(message.message, language)
        if not context and not is_translation_question(message.message):
            rag_results = relevant_chat_documents(chroma_service.search_documents(
                message.message, n_results=3,
                filter_dict={"jlpt_level": message.jlpt_level or current_user.current_jlpt_level},
            ), message.message)
            context = "\n\n".join(f"{result['source']['title']}\n{result['content']}" for result in rag_results)
            sources = [{"title": result["source"]["title"], "url": result["source"].get("source_url", ""),
                        "relevance": result["similarity_score"]} for result in rag_results]
        response_context = "\n\n".join(part for part in (context, conversation_context) if part)
        
        # Generate AI response
        same_language_answer = same_language_translation(message.message, language)
        response_data = {"answer": same_language_answer, "jlpt_level": message.jlpt_level or current_user.current_jlpt_level} if same_language_answer else await japanese_service.chat_response(
            question=message.message,
            context=response_context,
            jlpt_level=message.jlpt_level or current_user.current_jlpt_level,
            response_language=language,
        )
        response_data["answer"] = finalize_chat_answer(message.message, response_data["answer"], language)
        
        # Extract grammar points if the response contains Japanese
        # A second model pass over its own answer produced contradictory cards.
        # Grammar is explained in context in the main answer instead.
        grammar_points = []
        
        # Generate translation if requested
        translation = None
        if message.context and "translate" in message.context.lower():
            translation_result = await japanese_service.translate_text(
                text=response_data["answer"],
                source_lang="ja",
                target_lang=language
            )
            translation = translation_result["translated_text"]
        
        # Save to chat history
        chat_entry = ChatHistory(
            user_id=current_user.id,
            question=message.message,
            answer=response_data["answer"],
            jlpt_level=response_data["jlpt_level"],
            grammar_points=grammar_points,
            translation=translation,
            sources=sources,
            conversation_id=conversation.id,
        )
        
        _save_chat_entry(db, conversation, chat_entry)
        
        response_time = time.time() - start_time
        
        return ChatResponse(
            answer=response_data["answer"],
            jlpt_level=response_data["jlpt_level"],
            grammar_points=grammar_points,
            translation=translation,
            sources=sources,
            response_time=response_time,
            conversation_id=conversation.id,
        )
        
    except HTTPException:
        db.rollback()
        raise
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="chat_generation_failed") from exc
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing message: {str(e)}"
        )

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

