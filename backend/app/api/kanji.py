from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import schemas
from ..models.database import Vocabulary as VocabularyModel
from ..services.kanji_recognition_service import kanji_recognition_service
from ..services.learning_content import learning_content_service

router = APIRouter(tags=["kanji-vocabulary"])


def vocabulary_to_schema(vocabulary: VocabularyModel) -> schemas.Vocabulary:
    return schemas.Vocabulary(
        id=vocabulary.id,
        word=vocabulary.japanese_word,
        reading=vocabulary.reading,
        romaji=vocabulary.romaji,
        meaning_vi=vocabulary.meaning,
        jlpt_level=vocabulary.jlpt_level,
        part_of_speech=vocabulary.part_of_speech,
        example_sentences=vocabulary.example_sentences or [],
        related_kanji=[
            schemas.VocabularyKanjiBrief.model_validate(link.kanji)
            for link in vocabulary.kanji_links
            if link.kanji is not None
        ],
        created_at=vocabulary.created_at,
        updated_at=vocabulary.updated_at,
    )


@router.get("/kanji", response_model=schemas.KanjiListResponse)
async def get_kanji_list(
    search: Optional[str] = Query(default=None, description="Search character, meaning, reading, or romaji"),
    jlpt_level: Optional[schemas.JlptLevel] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List kanji with readings and examples."""
    items, total = learning_content_service.list_kanji(
        db,
        search=search,
        jlpt_level=jlpt_level,
        limit=limit,
        offset=offset,
    )
    return schemas.KanjiListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/api/kanji/recognize", response_model=schemas.KanjiRecognitionResponse)
async def recognize_kanji(payload: schemas.KanjiRecognitionRequest):
    """Recognize handwriting from canvas image/stroke data."""
    return kanji_recognition_service.recognize(payload)


@router.get("/kanji/{kanji_id}", response_model=schemas.Kanji)
async def get_kanji(kanji_id: int, db: Session = Depends(get_db)):
    """Get one kanji by ID, including readings and examples."""
    return learning_content_service.get_kanji(db, kanji_id)


@router.post("/kanji", response_model=schemas.Kanji, status_code=status.HTTP_201_CREATED)
async def create_kanji(payload: schemas.KanjiCreate, db: Session = Depends(get_db)):
    """Create a kanji with normalized reading and example rows."""
    return learning_content_service.create_kanji(db, payload)


@router.get("/vocabulary", response_model=schemas.VocabularyListResponse)
async def get_vocabulary_list(
    search: Optional[str] = Query(default=None, description="Search word, reading, or Vietnamese meaning"),
    jlpt_level: Optional[schemas.JlptLevel] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List vocabulary with related kanji."""
    items, total = learning_content_service.list_vocabulary(
        db,
        search=search,
        jlpt_level=jlpt_level,
        limit=limit,
        offset=offset,
    )
    return schemas.VocabularyListResponse(
        items=[vocabulary_to_schema(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/vocabulary", response_model=schemas.Vocabulary, status_code=status.HTTP_201_CREATED)
async def create_vocabulary(payload: schemas.VocabularyCreate, db: Session = Depends(get_db)):
    """Create vocabulary and connect it to existing kanji rows."""
    vocabulary = learning_content_service.create_vocabulary(db, payload)
    return vocabulary_to_schema(vocabulary)
