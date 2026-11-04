from pathlib import Path
import re
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.database import get_db
from ..models.database import Document, ListeningAttempt, ListeningLesson, User
from ..models.schemas import TokenData
from ..services.audio_service import VoicevoxProvider, VoicevoxError, choose_speaker_id, furigana_tokens, synthesize_segments
from ..services.listening_from_library import generate_listening_draft
from ..services.listening_exercises import build_exercises, public_questions, grade_questions

router = APIRouter(prefix="/listening", tags=["listening"])
optional_bearer = HTTPBearer(auto_error=False)


class ListeningAnswer(BaseModel):
    question_id: str = Field(min_length=1, max_length=80)
    answer: str = Field(max_length=1000)


class ListeningAttemptRequest(BaseModel):
    mode: Literal['dictation', 'cloze', 'comprehension']
    revision: str = Field(min_length=1, max_length=64)
    answers: list[ListeningAnswer] = Field(min_length=1, max_length=50)
    duration_ms: int = Field(default=0, ge=0, le=86400000)


def exercise_lesson(lesson_id: int, user: User, db: Session) -> ListeningLesson:
    lesson = db.query(ListeningLesson).filter(ListeningLesson.id == lesson_id, ListeningLesson.is_published.is_(True)).first()
    if not lesson or not _library_lesson_visible(lesson, user):
        raise HTTPException(404, detail='listening_lesson_not_found')
    return lesson


@router.get('/lessons/{lesson_id}/exercises')
def get_exercises(lesson_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    lesson = exercise_lesson(lesson_id, current_user, db)
    revision, questions = build_exercises(lesson.id, lesson.segments or [])
    return {'lesson_id': lesson.id, 'revision': revision, 'questions': public_questions(questions)}


@router.post('/lessons/{lesson_id}/attempts', status_code=201)
def submit_attempt(lesson_id: int, body: ListeningAttemptRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    lesson = exercise_lesson(lesson_id, current_user, db)
    revision, questions = build_exercises(lesson.id, lesson.segments or [])
    if revision != body.revision:
        raise HTTPException(409, detail='listening_exercises_changed')
    try:
        graded = grade_questions(questions, body.mode, [answer.model_dump() for answer in body.answers])
    except ValueError as error:
        raise HTTPException(422, detail=str(error)) from error
    attempt = ListeningAttempt(user_id=current_user.id, lesson_id=lesson.id, mode=body.mode,
                               score=graded['score'], details={'revision': revision, **graded}, duration_ms=body.duration_ms)
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {'id': attempt.id, 'mode': body.mode, 'created_at': attempt.created_at, **graded}


@router.get('/lessons/{lesson_id}/attempts')
def list_attempts(lesson_id: int, limit: int = Query(10, ge=1, le=50),
                  current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    exercise_lesson(lesson_id, current_user, db)
    rows = db.query(ListeningAttempt).filter(ListeningAttempt.user_id == current_user.id, ListeningAttempt.lesson_id == lesson_id).order_by(ListeningAttempt.created_at.desc(), ListeningAttempt.id.desc()).limit(limit).all()
    return {'items': [{'id': row.id, 'mode': row.mode, 'score': row.score, 'created_at': row.created_at,
                       'correct_count': (row.details or {}).get('correct_count', 0), 'total': (row.details or {}).get('total', 0)} for row in rows]}


class LibraryDraftRequest(BaseModel):
    document_id: int
    topic: Optional[str] = Field(default=None, max_length=80)


class LibraryLessonSaveRequest(BaseModel):
    document_id: int
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    jlpt_level: str
    topic: str = Field(min_length=1, max_length=80)
    segments: list[dict[str, Any]] = Field(min_length=4, max_length=10)


def optional_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
                          db: Session = Depends(get_db)) -> Optional[User]:
    if not credentials:
        return None
    from ..core.auth import verify_token
    error = HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    token_data: TokenData = verify_token(credentials.credentials, error)
    user = db.query(User).filter(User.email == token_data.email).first()
    if not user or not user.is_active:
        raise error
    return user


def _library_lesson_visible(lesson: ListeningLesson, user: Optional[User]) -> bool:
    return lesson.source != "library" or (user is not None and lesson.created_by == user.id)


def parse_range_header(value: str, size: int) -> tuple[int, int] | None:
    """Return inclusive byte bounds; None indicates an invalid/unsatisfiable range."""
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
    if not match or size <= 0:
        return None
    first, last = match.groups()
    if not first:
        if not last or int(last) <= 0:
            return None
        length = min(int(last), size)
        return size - length, size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start >= size or end < start:
        return None
    return start, end


@router.get("/lessons")
def list_lessons(jlpt_level: Optional[str] = None, topic: Optional[str] = None,
                 search: Optional[str] = None, limit: int = Query(20, ge=1, le=100),
                 offset: int = Query(0, ge=0), source: Optional[str] = None,
                 current_user: Optional[User] = Depends(optional_current_user), db: Session = Depends(get_db)):
    query = db.query(ListeningLesson).filter(ListeningLesson.is_published.is_(True))
    if current_user is None:
        query = query.filter(ListeningLesson.source != "library")
    else:
        query = query.filter((ListeningLesson.source != "library") | (ListeningLesson.created_by == current_user.id))
    if source == "library":
        query = query.filter(ListeningLesson.source == "library", ListeningLesson.created_by == (current_user.id if current_user else -1))
    if jlpt_level:
        query = query.filter(ListeningLesson.jlpt_level == jlpt_level.upper())
    if topic:
        query = query.filter(ListeningLesson.topic == topic)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter((ListeningLesson.title.ilike(pattern)) |
                             (ListeningLesson.description.ilike(pattern)))
    total = query.count()
    lessons = query.order_by(ListeningLesson.jlpt_level, ListeningLesson.id).offset(offset).limit(limit).all()
    return {"items": [{"id": x.id, "title": x.title, "jlpt_level": x.jlpt_level,
                        "topic": x.topic, "description": x.description,
                        "duration_ms": x.duration_ms, "source": x.source}
                       for x in lessons], "total": total, "limit": limit, "offset": offset}


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: int, current_user: Optional[User] = Depends(optional_current_user), db: Session = Depends(get_db)):
    lesson = db.query(ListeningLesson).filter(ListeningLesson.id == lesson_id,
                                              ListeningLesson.is_published.is_(True)).first()
    if not lesson or not _library_lesson_visible(lesson, current_user):
        raise HTTPException(404, detail="listening_lesson_not_found")
    segments = lesson.segments or []
    enriched_segments = []
    changed = False
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        if segment.get("ja") and not segment.get("tokens"):
            try:
                segment["tokens"] = furigana_tokens(segment["ja"])
                changed = True
            except RuntimeError:
                # Keep lessons playable if the optional reading dependency is missing.
                pass
        enriched_segments.append(segment)
    if changed:
        lesson.segments = enriched_segments
        db.commit()
    return {"id": lesson.id, "title": lesson.title, "jlpt_level": lesson.jlpt_level,
            "topic": lesson.topic, "description": lesson.description,
            "segments": enriched_segments, "duration_ms": lesson.duration_ms, "source": lesson.source}


@router.get("/lessons/{lesson_id}/audio")
def get_lesson_audio(lesson_id: int, range_header: Optional[str] = Header(None, alias="Range"),
                     current_user: User = Depends(get_current_active_user),
                     db: Session = Depends(get_db)):
    lesson = db.query(ListeningLesson).filter(ListeningLesson.id == lesson_id,
                                              ListeningLesson.is_published.is_(True)).first()
    if not lesson or not _library_lesson_visible(lesson, current_user):
        raise HTTPException(404, detail="listening_lesson_not_found")
    media_root = Path(settings.listening_media_dir).resolve()
    audio_file = (media_root / lesson.audio_path).resolve() if lesson.audio_path else None
    if audio_file is not None and not audio_file.is_relative_to(media_root):
        raise HTTPException(404, detail="lesson_audio_not_found")
    if audio_file is None or not audio_file.is_file():
        try:
            provider = VoicevoxProvider()
            speaker_id = choose_speaker_id(provider, settings.listening_voicevox_speaker_id)
            if not lesson.segments:
                raise VoicevoxError("Bài học chưa có nội dung câu để tạo audio.")
            generated_name, assembled = synthesize_segments(
                [segment["ja"] for segment in lesson.segments], speaker_id, provider
            )
            # Assign a new JSON value so SQLAlchemy persists the generated timings.
            lesson.segments = [
                {**segment, **timing}
                for segment, timing in zip(lesson.segments, assembled.timings)
            ]
            lesson.audio_path = generated_name
            lesson.duration_ms = assembled.duration_ms
            db.commit()
            audio_file = (media_root / generated_name).resolve()
        except VoicevoxError as exc:
            raise HTTPException(503, detail=f"listening_tts_unavailable: {exc}") from exc
    if audio_file is None or not audio_file.is_relative_to(media_root) or not audio_file.is_file():
        raise HTTPException(404, detail="lesson_audio_not_found")
    size = audio_file.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Content-Type": "audio/wav"}
    start, end, status_code = 0, size - 1, 200
    if range_header:
        bounds = parse_range_header(range_header, size)
        if bounds is None:
            raise HTTPException(416, detail="invalid_range", headers={"Content-Range": f"bytes */{size}"})
        start, end = bounds
        status_code = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    content_length = max(0, end - start + 1)
    headers["Content-Length"] = str(content_length)

    def stream_file():
        with audio_file.open("rb") as stream:
            stream.seek(start)
            remaining = content_length
            while remaining:
                chunk = stream.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(stream_file(), status_code=status_code, headers=headers, media_type="audio/wav")


@router.post("/lessons/from-library")
async def create_library_draft(body: LibraryDraftRequest, current_user: User = Depends(get_current_active_user),
                               db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == body.document_id).first()
    if not document:
        raise HTTPException(404, "Library document not found")
    level = document.jlpt_level or current_user.current_jlpt_level or "N5"
    if level not in {"N5", "N4", "N3", "N2", "N1"}:
        level = current_user.current_jlpt_level if current_user.current_jlpt_level in {"N5", "N4", "N3", "N2", "N1"} else "N5"
    tag_topic = document.tags[0] if isinstance(document.tags, list) and document.tags else None
    default_topic = tag_topic if isinstance(tag_topic, str) and tag_topic.strip() else document.title
    topic = (body.topic or default_topic)[:80]
    try:
        dialogue = await generate_listening_draft(document.content[:24000], level, topic)
    except ValueError as exc:
        raise HTTPException(502, f"Invalid generated draft: {exc}") from exc
    return {"document_id": document.id, "jlpt_level": level, "topic": topic, **dialogue}


@router.post("/lessons/from-library/save", status_code=201)
def save_library_lesson(body: LibraryLessonSaveRequest, current_user: User = Depends(get_current_active_user),
                        db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == body.document_id).first()
    if not document:
        raise HTTPException(404, "Library document not found")
    if body.jlpt_level not in {"N5", "N4", "N3", "N2", "N1"}:
        raise HTTPException(422, "Invalid JLPT level")
    segments = []
    for index, segment in enumerate(body.segments, 1):
        ja, vi = segment.get("ja"), segment.get("vi")
        if not isinstance(ja, str) or not ja.strip() or len(ja) > 300 or not isinstance(vi, str) or not vi.strip() or len(vi) > 500:
            raise HTTPException(422, "Each segment must contain valid ja and vi text")
        segments.append({"idx": index, "ja": ja.strip(), "vi": vi.strip()})
    lesson = ListeningLesson(
        title=body.title.strip(), description=body.description.strip(), jlpt_level=body.jlpt_level,
        topic=body.topic.strip(), segments=segments, audio_path=None, duration_ms=0,
        source="library", source_document_id=document.id, created_by=current_user.id, is_published=True,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return {"id": lesson.id, "title": lesson.title, "jlpt_level": lesson.jlpt_level,
            "topic": lesson.topic, "description": lesson.description, "segments": lesson.segments,
            "duration_ms": lesson.duration_ms, "source": lesson.source}
