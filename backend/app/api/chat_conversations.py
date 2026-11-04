"""Conversation and folder endpoints for the chat workspace."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.database import get_db
from ..models.database import ChatConversation, ChatFolder, ChatHistory, User, VoiceConversation
from ..models.schemas import (
    ChatConversationCreate, ChatConversationFolder, ChatConversationPin,
    ChatConversationRename, ChatFolderCreate, ChatFolderOrder, ChatFolderUpdate,
    ChatHistory as ChatHistorySchema,
)
from ..services.chat_conversations import normalize_title

router = APIRouter(prefix="/chat", tags=["chat conversations"])


def _owned_conversation(db: Session, conversation_id: UUID, user_id: int) -> ChatConversation:
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == user_id,
    ).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return conversation


def _owned_folder(db: Session, folder_id: UUID, user_id: int) -> ChatFolder:
    folder = db.query(ChatFolder).filter(
        ChatFolder.id == folder_id,
        ChatFolder.user_id == user_id,
    ).first()
    if folder is None:
        raise HTTPException(status_code=404, detail="chat_folder_not_found")
    return folder


def _clean_name(value: str, limit: int, field: str) -> str:
    cleaned = " ".join((value or "").split())
    if not cleaned:
        raise HTTPException(status_code=422, detail=f"{field}_required")
    if len(cleaned) > limit:
        raise HTTPException(status_code=422, detail=f"{field}_too_long")
    return cleaned


def _delete_conversation(db: Session, conversation: ChatConversation) -> None:
    db.query(ChatHistory).filter(
        ChatHistory.user_id == conversation.user_id,
        ChatHistory.conversation_id == conversation.id,
    ).delete(synchronize_session=False)
    db.query(VoiceConversation).filter(
        VoiceConversation.user_id == conversation.user_id,
        VoiceConversation.id == conversation.id,
    ).delete(synchronize_session=False)
    db.delete(conversation)


def _search_snippet(db: Session, conversation: ChatConversation, term: str) -> Optional[str]:
    row = db.query(ChatHistory).filter(
        ChatHistory.user_id == conversation.user_id,
        ChatHistory.conversation_id == conversation.id,
        or_(ChatHistory.question.ilike(f"%{term}%"), ChatHistory.answer.ilike(f"%{term}%")),
    ).order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc()).first()
    if not row:
        return None
    text = row.question if term.casefold() in row.question.casefold() else row.answer
    position = text.casefold().find(term.casefold())
    start = max(0, position - 70)
    snippet = text[start: start + 180].strip()
    return ("…" if start else "") + snippet + ("…" if start + 180 < len(text) else "")


def _conversation_json(db: Session, conversation: ChatConversation, count: int,
                      search_term: Optional[str] = None) -> dict:
    folder = db.query(ChatFolder).filter(
        ChatFolder.id == conversation.folder_id,
        ChatFolder.user_id == conversation.user_id,
    ).first() if conversation.folder_id else None
    voice = db.query(VoiceConversation).filter(
        VoiceConversation.id == conversation.id,
        VoiceConversation.user_id == conversation.user_id,
    ).first() if conversation.mode == "voice" else None
    return {
        "id": str(conversation.id),
        "user_id": conversation.user_id,
        "folder_id": str(conversation.folder_id) if conversation.folder_id else None,
        "folder_name": folder.name if folder else None,
        "title": conversation.title,
        "is_pinned": conversation.is_pinned,
        "mode": conversation.mode,
        "created_at": conversation.created_at,
        "last_activity_at": conversation.last_activity_at,
        "message_count": count,
        "snippet": _search_snippet(db, conversation, search_term) if search_term else None,
        "voice_status": voice.status if voice else None,
        "scenario_id": voice.scenario_id if voice else None,
        "jlpt_level": voice.jlpt_level if voice else None,
        "summary": voice.summary if voice else None,
    }


@router.get("/conversations")
def list_conversations(
    folder_id: Optional[UUID] = None,
    unfiled: bool = False,
    pinned_only: bool = False,
    search: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    query = db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id, ChatConversation.mode == "text")
    if folder_id is not None:
        _owned_folder(db, folder_id, current_user.id)
        query = query.filter(ChatConversation.folder_id == folder_id)
    elif unfiled:
        query = query.filter(ChatConversation.folder_id.is_(None))
    if pinned_only:
        query = query.filter(ChatConversation.is_pinned.is_(True))
    term = (search or "").strip()
    if term:
        matching_message = db.query(ChatHistory.id).filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.conversation_id == ChatConversation.id,
            or_(ChatHistory.question.ilike(f"%{term}%"), ChatHistory.answer.ilike(f"%{term}%")),
        ).exists()
        query = query.filter(or_(ChatConversation.title.ilike(f"%{term}%"), matching_message))
    total = query.count()
    rows = query.order_by(
        ChatConversation.is_pinned.desc(),
        ChatConversation.last_activity_at.desc(),
        ChatConversation.id.desc(),
    ).offset(offset).limit(limit).all()
    items = []
    for conversation in rows:
        count = db.query(func.count(ChatHistory.id)).filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.conversation_id == conversation.id,
        ).scalar() or 0
        items.append(_conversation_json(db, conversation, count, term or None))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ChatConversationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if payload.mode != "text":
        raise HTTPException(status_code=400, detail="use_voice_conversation_api")
    folder = _owned_folder(db, payload.folder_id, current_user.id) if payload.folder_id else None
    title = _clean_name(payload.title, settings.chat_conversation_title_max_length, "conversation_title") if payload.title else (
        "New conversation" if current_user.ui_language == "en" else "Cuộc trò chuyện mới"
    )
    now = datetime.now(timezone.utc)
    conversation = ChatConversation(
        id=uuid4(), user_id=current_user.id, folder_id=folder.id if folder else None,
        title=title, title_is_auto=payload.title is None, mode="text",
        is_pinned=False, created_at=now, last_activity_at=now,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _conversation_json(db, conversation, 0)


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    count = db.query(func.count(ChatHistory.id)).filter(
        ChatHistory.user_id == current_user.id,
        ChatHistory.conversation_id == conversation.id,
    ).scalar() or 0
    return _conversation_json(db, conversation, count)


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: UUID,
    limit: Optional[int] = Query(default=None, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    page_size = limit or settings.chat_messages_page_size
    query = db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id,
        ChatHistory.conversation_id == conversation.id,
    )
    total = query.count()
    messages = query.order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc()).offset(offset).limit(page_size).all()
    return {
        "items": [ChatHistorySchema.model_validate(message).model_dump(mode="json") for message in messages],
        "total": total,
        "limit": page_size,
        "offset": offset,
        "has_more": offset + len(messages) < total,
    }


@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: UUID,
    payload: ChatConversationRename,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    conversation.title = _clean_name(payload.title, settings.chat_conversation_title_max_length, "conversation_title")
    conversation.title_is_auto = False
    db.commit()
    return _conversation_json(db, conversation, db.query(func.count(ChatHistory.id)).filter(
        ChatHistory.conversation_id == conversation.id, ChatHistory.user_id == current_user.id,
    ).scalar() or 0)


@router.put("/conversations/{conversation_id}/pin")
def set_conversation_pin(
    conversation_id: UUID,
    payload: ChatConversationPin,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    conversation.is_pinned = payload.is_pinned
    db.commit()
    return {"id": str(conversation.id), "is_pinned": conversation.is_pinned}


@router.put("/conversations/{conversation_id}/folder")
def move_conversation(
    conversation_id: UUID,
    payload: ChatConversationFolder,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    folder = _owned_folder(db, payload.folder_id, current_user.id) if payload.folder_id else None
    conversation.folder_id = folder.id if folder else None
    db.commit()
    return {"id": str(conversation.id), "folder_id": str(conversation.folder_id) if conversation.folder_id else None}


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    _delete_conversation(db, conversation)
    db.commit()


@router.get("/folders")
def list_folders(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    folders = db.query(ChatFolder).filter(ChatFolder.user_id == current_user.id).order_by(
        ChatFolder.sort_order, ChatFolder.created_at, ChatFolder.id,
    ).all()
    return [{
        "id": str(folder.id), "name": folder.name, "sort_order": folder.sort_order,
        "created_at": folder.created_at,
        "conversation_count": db.query(func.count(ChatConversation.id)).filter(
            ChatConversation.user_id == current_user.id,
            ChatConversation.folder_id == folder.id,
        ).scalar() or 0,
    } for folder in folders]


@router.put("/folders/order")
def reorder_folders(payload: ChatFolderOrder, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    folders = db.query(ChatFolder).filter(ChatFolder.user_id == current_user.id).all()
    by_id = {folder.id: folder for folder in folders}
    if len(payload.folder_ids) != len(by_id) or set(payload.folder_ids) != set(by_id):
        raise HTTPException(status_code=400, detail="folder_order_must_include_all_user_folders")
    for position, folder_id in enumerate(payload.folder_ids):
        by_id[folder_id].sort_order = position
    db.commit()
    return {"folder_ids": [str(folder_id) for folder_id in payload.folder_ids]}


@router.post("/folders", status_code=status.HTTP_201_CREATED)
def create_folder(payload: ChatFolderCreate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    count = db.query(func.count(ChatFolder.id)).filter(ChatFolder.user_id == current_user.id).scalar() or 0
    if count >= settings.chat_max_folders:
        raise HTTPException(status_code=400, detail="chat_folder_limit_reached")
    name = _clean_name(payload.name, settings.chat_folder_name_max_length, "folder_name")
    folder = ChatFolder(user_id=current_user.id, name=name, sort_order=count)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return {"id": str(folder.id), "name": folder.name, "sort_order": folder.sort_order, "created_at": folder.created_at, "conversation_count": 0}


@router.patch("/folders/{folder_id}")
def rename_folder(folder_id: UUID, payload: ChatFolderUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    folder = _owned_folder(db, folder_id, current_user.id)
    folder.name = _clean_name(payload.name, settings.chat_folder_name_max_length, "folder_name")
    db.commit()
    return {"id": str(folder.id), "name": folder.name, "sort_order": folder.sort_order}


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: UUID,
    delete_conversations: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    folder = _owned_folder(db, folder_id, current_user.id)
    conversations = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id,
        ChatConversation.folder_id == folder.id,
    ).all()
    if delete_conversations:
        for conversation in conversations:
            _delete_conversation(db, conversation)
    else:
        for conversation in conversations:
            conversation.folder_id = None
    db.delete(folder)
    db.commit()
    return {"deleted_folder_id": str(folder_id), "deleted_conversations": len(conversations) if delete_conversations else 0,
            "unfiled_conversations": 0 if delete_conversations else len(conversations)}
