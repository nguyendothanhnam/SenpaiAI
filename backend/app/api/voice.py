import json
import re
import time
import uuid
from collections import defaultdict, deque
from threading import Lock
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import ChatHistory, LearningSession, User, VoiceConversation
from ..services.llm_service import japanese_service
from ..services.stt_service import validate_audio_upload, transcribe_audio
from ..services.voice_scenarios import SCENARIOS, build_recent_context, build_system_prompt

router = APIRouter(prefix="/voice", tags=["voice"])
_transcribe_hits: dict[int, deque[float]] = defaultdict(deque)
_transcribe_lock = Lock()
TRANSCRIBE_MAX_PER_MINUTE = 10


def check_transcribe_rate_limit(user_id: int, now: float | None = None) -> bool:
    timestamp = time.monotonic() if now is None else now
    with _transcribe_lock:
        hits = _transcribe_hits[user_id]
        while hits and timestamp - hits[0] >= 60:
            hits.popleft()
        if len(hits) >= TRANSCRIBE_MAX_PER_MINUTE:
            return False
        hits.append(timestamp)
        return True


class ConversationCreate(BaseModel):
    scenario_id: str
    jlpt_level: Literal["N5", "N4", "N3"]


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    transcript_confidence: Optional[float] = Field(default=None, ge=0, le=1)


class FeedbackIssue(BaseModel):
    type: Literal["grammar", "vocab", "politeness"]
    original: str
    suggestion: str
    explanation_vi: str


class TurnFeedback(BaseModel):
    corrected_sentence: str
    issues: list[FeedbackIssue]
    better_phrases: list[str]


def parse_model_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError("invalid_feedback_json") from exc
    if not isinstance(value, dict):
        raise ValueError("invalid_feedback_json")
    return value


def serialize_feedback(raw: str) -> dict[str, Any]:
    return TurnFeedback.model_validate(parse_model_json(raw)).model_dump()


def _audio_url(_text: str) -> None:
    # The repository currently has no audio_service/VOICEVOX client to call.
    return None


@router.get("/scenarios")
def get_scenarios():
    return [{"id": key, **value} for key, value in SCENARIOS.items()]


@router.post("/conversations")
async def create_conversation(payload: ConversationCreate,
                              current_user: User = Depends(get_current_active_user),
                              db: Session = Depends(get_db)):
    if payload.scenario_id not in SCENARIOS:
        raise HTTPException(404, detail="scenario_not_found")
    conversation = VoiceConversation(user_id=current_user.id, scenario_id=payload.scenario_id,
                                    jlpt_level=payload.jlpt_level)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return {"id": str(conversation.id), "scenario_id": conversation.scenario_id,
            "jlpt_level": conversation.jlpt_level, "status": conversation.status,
            "opening_text": SCENARIOS[payload.scenario_id]["opening"],
            "audio_url": _audio_url(SCENARIOS[payload.scenario_id]["opening"])}


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...),
                     current_user: User = Depends(get_current_active_user)):
    if not check_transcribe_rate_limit(current_user.id):
        raise HTTPException(429, detail="transcription_rate_limit")
    try:
        # Read at most one byte over the cap so oversized uploads are rejected early.
        content = await audio.read(5 * 1024 * 1024 + 1)
        validate_audio_upload(audio.content_type, len(content))
        result = await transcribe_audio(content)
        return {"text": result["text"], "confidence": result["confidence"]}
    except ValueError as exc:
        code = str(exc)
        if code == "unsupported_audio_type":
            raise HTTPException(415, detail=code)
        if code in {"audio_size_limit", "audio_duration_limit"}:
            raise HTTPException(413, detail=code)
        raise HTTPException(400, detail="invalid_audio")
    except RuntimeError as exc:
        raise HTTPException(503, detail=str(exc))


def _owned_conversation(db: Session, conversation_id: uuid.UUID, user_id: int) -> VoiceConversation:
    conversation = db.query(VoiceConversation).filter(
        VoiceConversation.id == conversation_id, VoiceConversation.user_id == user_id
    ).first()
    if not conversation:
        raise HTTPException(404, detail="conversation_not_found")
    if conversation.status != "active":
        raise HTTPException(409, detail="conversation_ended")
    return conversation


@router.post("/conversations/{conversation_id}/turn")
async def conversation_turn(conversation_id: uuid.UUID, payload: TurnRequest,
                            current_user: User = Depends(get_current_active_user),
                            db: Session = Depends(get_db)):
    conversation = _owned_conversation(db, conversation_id, current_user.id)
    prior = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id,
                                         ChatHistory.conversation_id == conversation_id)
    recent = prior.order_by(ChatHistory.created_at.desc(), ChatHistory.id.desc()).limit(6).all()
    recent.reverse()
    context = build_recent_context(recent)
    prompt = f"{context}\nNgười học: {payload.text}" if context else payload.text
    system_prompt = build_system_prompt(conversation.scenario_id, conversation.jlpt_level)
    try:
        reply = await japanese_service.voice_completion(system_prompt, prompt)
    except Exception as exc:
        raise HTTPException(502, detail=f"llm_unavailable: {exc}") from exc
    entry = ChatHistory(user_id=current_user.id, question=payload.text, answer=reply,
                        jlpt_level=conversation.jlpt_level, grammar_points=[], sources=[],
                        input_mode="voice", conversation_id=conversation_id,
                        scenario=conversation.scenario_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"chat_id": entry.id, "reply": reply, "audio_url": _audio_url(reply)}


@router.post("/turns/{chat_id}/feedback")
async def turn_feedback(chat_id: int,
                        current_user: User = Depends(get_current_active_user),
                        db: Session = Depends(get_db)):
    entry = db.query(ChatHistory).filter(ChatHistory.id == chat_id,
                                         ChatHistory.user_id == current_user.id,
                                         ChatHistory.input_mode == "voice").first()
    if not entry:
        raise HTTPException(404, detail="voice_turn_not_found")
    if entry.feedback:
        return entry.feedback
    prompt = (
        "Đánh giá câu tiếng Nhật của người học và chỉ trả JSON hợp lệ theo schema: "
        '{"corrected_sentence":"...","issues":[{"type":"grammar|vocab|politeness",'
        '"original":"...","suggestion":"...","explanation_vi":"..."}],"better_phrases":["..."]}. '
        "Không bịa lỗi; nếu câu phù hợp, issues có thể rỗng.\n"
        f"Câu người học: {entry.question}\nCâu trả lời trong hội thoại: {entry.answer}"
    )
    try:
        raw = await japanese_service.voice_completion(
            "Bạn là giáo viên tiếng Nhật cho người Việt. Trả lời bằng JSON, giải thích bằng tiếng Việt.", prompt
        )
        feedback = serialize_feedback(raw)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(502, detail="invalid_feedback_from_model") from exc
    except Exception as exc:
        raise HTTPException(502, detail=f"llm_unavailable: {exc}") from exc
    entry.feedback = feedback
    db.commit()
    return feedback


@router.post("/conversations/{conversation_id}/end")
async def end_conversation(conversation_id: uuid.UUID,
                           current_user: User = Depends(get_current_active_user),
                           db: Session = Depends(get_db)):
    conversation = db.query(VoiceConversation).filter(
        VoiceConversation.id == conversation_id, VoiceConversation.user_id == current_user.id
    ).first()
    if not conversation:
        raise HTTPException(404, detail="conversation_not_found")
    if conversation.status == "ended":
        return {"summary": conversation.summary, "turn_count": db.query(ChatHistory).filter(
            ChatHistory.conversation_id == conversation_id, ChatHistory.user_id == current_user.id).count()}
    turns = db.query(ChatHistory).filter(ChatHistory.conversation_id == conversation_id,
                                         ChatHistory.user_id == current_user.id).order_by(ChatHistory.created_at).all()
    transcript = "\n".join(f"Người học: {t.question}\nAI: {t.answer}" for t in turns[-20:])
    summary_prompt = (
        "Tóm tắt ngắn hội thoại luyện nói. Chỉ trả JSON: "
        '{"summary_vi":"...","common_errors":["..."],"improvements":["...","...","..."]}.\n'
        f"Kịch bản {SCENARIOS[conversation.scenario_id]['name']}, cấp độ {conversation.jlpt_level}.\n{transcript}"
    )
    try:
        raw = await japanese_service.voice_completion("Bạn là gia sư tiếng Nhật. Trả JSON tiếng Việt.", summary_prompt)
        summary = parse_model_json(raw)
        if not isinstance(summary.get("improvements"), list):
            summary["improvements"] = []
        summary["improvements"] = summary["improvements"][:3]
    except Exception:
        summary = {"summary_vi": "Đã kết thúc buổi luyện hội thoại.", "common_errors": [], "improvements": []}
    now = datetime.now(timezone.utc)
    elapsed = max(1, int((now - (conversation.started_at.replace(tzinfo=timezone.utc)
                              if conversation.started_at.tzinfo is None else conversation.started_at)).total_seconds() / 60))
    conversation.status = "ended"
    conversation.ended_at = now
    conversation.summary = summary
    db.add(LearningSession(user_id=current_user.id, session_type="speaking",
                           topic=SCENARIOS[conversation.scenario_id]["name"],
                           difficulty_level=conversation.jlpt_level, duration_minutes=elapsed,
                           questions_answered=len(turns), correct_answers=0, completed_at=now))
    db.commit()
    return {"summary": summary, "turn_count": len(turns)}
