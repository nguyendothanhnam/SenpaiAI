"""Authenticated placement API, shared by web and future mobile clients."""
from datetime import datetime, timezone
from typing import Literal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import PlacementAttempt, PlacementAttemptItem, User
from ..core.config import settings
from ..services import placement_assessment_service as assessment
from ..services.placement_question_bank import bank_snapshots, level_availability
from ..services.placement_profile import profile_summary
from ..services.placement_service import answer_question, public_attempt, start_attempt

router = APIRouter(prefix="/placement", tags=["placement"])


class StartRequest(BaseModel):
    language: Literal["vi", "en"] = "vi"
    mode: Literal["adaptive", "confirmation"] | None = None
    selected_level: Literal["N5", "N4", "N3", "N2", "N1"] | None = None


class AnswerRequest(BaseModel):
    question_key: str = Field(min_length=1, max_length=150)
    answer: str | bool | list[str] = Field(union_mode="left_to_right")
    revision: int | None = Field(default=None, ge=0)

    @field_validator("answer")
    @classmethod
    def bounded_answer(cls, value):
        if isinstance(value, str) and len(value) > 1000:
            raise ValueError("Answer exceeds 1000 characters")
        if isinstance(value, list) and (len(value) > 20 or any(len(token) > 200 for token in value)):
            raise ValueError("Answer contains too many or oversized tokens")
        return value


class SkillScore(BaseModel):
    total: int
    correct: int
    score: int | None


Skill = Literal["grammar", "vocab", "kanji", "reading", "listening"]


class PlacementResult(BaseModel):
    recommended_level: str
    estimated_up_to: str
    data_ceiling: str
    skill_scores: dict[Skill, SkillScore]
    evidence: dict[str, dict[Skill, dict[str, int]]]
    strengths: list[Skill]
    weaknesses: list[Skill]
    focus_skills: list[Skill]
    foundation_needed: bool
    is_estimate: bool
    stop_reason: str
    estimated_level: str | None = None
    selected_level: str | None = None
    suggested_level: str | None = None
    total_score: float | None = None
    is_demo: bool = False
    evidence_status: str = "legacy"
    outcome: str | None = None
    next_level: str | None = None
    scoring_version: str | None = None
    estimation_version: str | None = None


class Choice(BaseModel):
    id: str
    text: str


class PlacementQuestion(BaseModel):
    key: str
    skill: Skill
    level: str
    question_type: Literal["mcq", "fill_blank", "reorder", "true_false", "conjugation", "listening"]
    prompt: str
    prompt_key: str | None = None
    options: list[str] | None = None
    tokens: list[str] | None = None
    statement: str | None = None
    base_form: str | None = None
    target_form: str | None = None
    lesson_id: int | None = None
    start_ms: float | None = None
    end_ms: float | None = None
    choices: list[Choice] | None = None
    item_id: int | None = None
    revision: int = 0
    user_answer: str | bool | list[str] | None = None
    passage: str | None = None
    stimulus_key: str | None = None
    audio_url: str | None = None


class AttemptResponse(BaseModel):
    id: int
    status: str
    language: str
    answered_count: int
    min_questions: int
    max_questions: int
    available_levels: list[str]
    question: PlacementQuestion | None
    result: PlacementResult | None
    created_at: datetime
    completed_at: datetime | None
    confirmed_at: datetime | None
    assessment_mode: str = "legacy"
    selected_level: str | None = None
    items: list[PlacementQuestion] = Field(default_factory=list)
    ready_to_submit: bool = False
    is_demo: bool = False
    expires_at: datetime | None = None
    server_time: datetime | None = None
    scoring_version: str = "legacy-v1"
    estimation_version: str = "legacy-v1"
    revision: int = 0


class StatusResponse(BaseModel):
    has_completed: bool
    has_confirmed: bool = Field(description="A completed placement has been confirmed and initial level setup is complete. Starting a retake does not clear this flag.")
    active_attempt_id: int | None
    has_estimated_level: bool = False
    has_manual_level: bool = False


def serialized(db, attempt):
    return assessment.public_assessment(db, attempt) if assessment.is_v2(attempt) else public_attempt(attempt)


def owned(db, user, attempt_id):
    attempt = db.query(PlacementAttempt).filter_by(id=attempt_id, user_id=user.id).with_for_update().first()
    if not attempt:
        raise HTTPException(404, "placement_not_found")
    return attempt


@router.get("/status", response_model=StatusResponse)
def status(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from ..services.placement_override import manual_placement_level
    manual = manual_placement_level(user) is not None
    active_row = db.query(PlacementAttempt).filter_by(user_id=user.id, status="in_progress").with_for_update().first()
    if active_row and assessment.expire_if_needed(db, active_row):
        db.commit()
    completed = db.query(PlacementAttempt.id).filter_by(user_id=user.id, status="completed").first()
    confirmed = db.query(PlacementAttempt.id).filter_by(user_id=user.id, status="completed").filter(PlacementAttempt.confirmed_at.isnot(None)).first()
    active = db.query(PlacementAttempt.id).filter_by(user_id=user.id, status="in_progress").first()
    verified = db.query(PlacementAttempt.id).filter_by(user_id=user.id, status="completed").filter(
        PlacementAttempt.confirmed_at.isnot(None),
        (PlacementAttempt.estimated_level.isnot(None)) | (PlacementAttempt.assessment_mode == "legacy")).first()
    return {"has_completed": completed is not None, "has_confirmed": confirmed is not None or manual, "active_attempt_id": active.id if active else None, "has_estimated_level": verified is not None, "has_manual_level": manual}


@router.get("/levels")
def levels(language: Literal["vi", "en"] = "vi", user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"levels": level_availability(bank_snapshots(db, language)), "min_questions": 20, "max_questions": 30, "time_limit_seconds": 1800}


@router.get("/profile/summary")
def summary(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return profile_summary(db, user)


@router.get("/attempts", response_model=list[AttemptResponse])
def history(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return [serialized(db, row) for row in db.query(PlacementAttempt).filter_by(user_id=user.id)
            .order_by(PlacementAttempt.id.desc()).limit(20).all()]


@router.post("/attempts", response_model=AttemptResponse)
def start(body: StartRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    attempt = assessment.start_assessment(db, user, body.language, body.mode, body.selected_level) if body.mode else start_attempt(db, user, body.language)
    db.commit()
    return serialized(db, attempt)


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
def get_attempt(attempt_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    attempt = owned(db, user, attempt_id)
    if assessment.expire_if_needed(db, attempt):
        db.commit()
    return serialized(db, attempt)


@router.post("/attempts/{attempt_id}/answers", response_model=AttemptResponse)
def answer(attempt_id: int, body: AnswerRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    attempt = owned(db, user, attempt_id)
    if assessment.is_v2(attempt):
        assessment.answer_assessment(db, attempt, body.question_key, body.answer, body.revision)
    else:
        answer_question(db, attempt, body.question_key, body.answer)
    db.commit()
    return serialized(db, attempt)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResponse)
def submit(attempt_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    attempt = owned(db, user, attempt_id)
    if not assessment.is_v2(attempt) or attempt.status == "abandoned":
        raise HTTPException(409, "placement_incomplete")
    if not assessment.expire_if_needed(db, attempt):
        assessment.finalize(db, attempt)
    db.commit()
    return serialized(db, attempt)


@router.get("/attempts/{attempt_id}/result", response_model=PlacementResult)
def result(attempt_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    attempt = owned(db, user, attempt_id)
    if assessment.expire_if_needed(db, attempt):
        db.commit()
    if attempt.status != "completed":
        raise HTTPException(409, "placement_incomplete")
    return attempt.result


@router.post("/attempts/{attempt_id}/abandon", response_model=AttemptResponse)
def abandon(attempt_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    db.query(User).filter_by(id=user.id).with_for_update().one()
    attempt = owned(db, user, attempt_id)
    if attempt.status == "in_progress":
        attempt.status = "abandoned"
        db.commit()
    return serialized(db, attempt)


@router.get("/attempts/{attempt_id}/media/{item_id}")
def media(attempt_id: int, item_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    owned(db, user, attempt_id)
    item = db.query(PlacementAttemptItem).filter_by(id=item_id, attempt_id=attempt_id).first()
    root = Path(settings.listening_media_dir).resolve()
    audio_path = item.snapshot.get("audio_path") if item else None
    path = (root / audio_path).resolve() if audio_path else None
    if not path or not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(404, "placement_media_unavailable")
    return FileResponse(path, media_type="audio/wav", headers={"Cache-Control": "private, no-store"})


@router.post("/attempts/{attempt_id}/confirm", response_model=AttemptResponse)
def confirm(attempt_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Same lock order as start to avoid deadlocks on concurrent start/confirmation.
    db.query(User).filter_by(id=user.id).with_for_update().one()
    attempt = owned(db, user, attempt_id)
    if attempt.status != "completed":
        raise HTTPException(409, "placement_incomplete")
    latest = db.query(PlacementAttempt.id).filter_by(user_id=user.id, status="completed").order_by(PlacementAttempt.id.desc()).first()
    if latest.id != attempt.id:
        raise HTTPException(409, "placement_stale_result")
    if not attempt.confirmed_at:
        if not assessment.is_v2(attempt) or attempt.estimated_level:
            user.current_jlpt_level = attempt.estimated_level if assessment.is_v2(attempt) else attempt.recommended_level
            if user.placement_override:
                user.placement_override = {**user.placement_override, 'active': False}
        attempt.confirmed_at = datetime.now(timezone.utc)
        db.commit()
    return serialized(db, attempt)
