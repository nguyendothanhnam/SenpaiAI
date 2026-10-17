from pathlib import Path
import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.database import get_db
from ..models.database import ListeningLesson, User
from ..services.audio_service import VoicevoxProvider, VoicevoxError, choose_speaker_id, synthesize_segments

router = APIRouter(prefix="/listening", tags=["listening"])


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
                 offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    query = db.query(ListeningLesson).filter(ListeningLesson.is_published.is_(True))
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
def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(ListeningLesson).filter(ListeningLesson.id == lesson_id,
                                              ListeningLesson.is_published.is_(True)).first()
    if not lesson:
        raise HTTPException(404, detail="listening_lesson_not_found")
    return {"id": lesson.id, "title": lesson.title, "jlpt_level": lesson.jlpt_level,
            "topic": lesson.topic, "description": lesson.description,
            "segments": lesson.segments, "duration_ms": lesson.duration_ms, "source": lesson.source}


@router.get("/lessons/{lesson_id}/audio")
def get_lesson_audio(lesson_id: int, range_header: Optional[str] = Header(None, alias="Range"),
                     current_user: User = Depends(get_current_active_user),
                     db: Session = Depends(get_db)):
    lesson = db.query(ListeningLesson).filter(ListeningLesson.id == lesson_id,
                                              ListeningLesson.is_published.is_(True)).first()
    if not lesson:
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
            for segment, timing in zip(lesson.segments, assembled.timings):
                segment.update(timing)
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
