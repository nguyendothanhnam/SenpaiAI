from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import schemas
from ..models.database import Vocabulary as VocabularyModel
from ..services.kanji_recognition_service import kanji_recognition_service
from ..services.kanji_sample_store import kanji_sample_store
from ..services.kanji_dictionary_service import kanji_dictionary_service
from ..services import kanjivg_service
from ..services.learning_content import learning_content_service
from ml.kanji_recognizer import get_model_info

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


@router.get("/kanji/list")
async def get_dictionary_kanji_list(
    jlpt: str = Query(default="all", pattern="^(N5|N4|all|ALL|n5|n4)$"),
    limit: int = Query(default=50, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
):
    """List local dictionary kanji used by Explore, minigames, and ML labels."""
    items, total = kanji_dictionary_service.list_entries(
        jlpt=jlpt,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/kanji/quiz")
async def get_dictionary_kanji_quiz(
    mode: str = Query(default="meaning_match", pattern="^(meaning_match|reading_match|kanji_match|matching_grid)$"),
    jlpt: str = Query(default="all", pattern="^(N5|N4|all|ALL|n5|n4)$"),
    count: int = Query(default=10, ge=1, le=50),
):
    """Generate minigame questions from the backend dictionary."""
    if mode == "matching_grid":
        return {"pairs": kanji_dictionary_service.matching_pairs(jlpt=jlpt, count=count)}
    return {"items": kanji_dictionary_service.quiz(mode=mode, jlpt=jlpt, count=count)}


@router.get("/kanji/matching-grid")
async def get_kanji_matching_grid(
    jlpt: str = Query(default="all", pattern="^(N5|N4|all|ALL|n5|n4)$"),
    count: int = Query(default=6, ge=2, le=12),
):
    """Return Kanji and shuffled meaning cards for matching-grid minigames."""
    return kanji_dictionary_service.matching_grid(jlpt=jlpt, count=count)


@router.get("/kanji/word-matching-grid")
async def get_word_matching_grid(
    jlpt: str = Query(default="all", pattern="^(N5|N4|all|ALL|n5|n4)$"),
    count: int = Query(default=6, ge=2, le=12),
):
    """Return example words and shuffled meaning cards for matching-grid minigames."""
    return kanji_dictionary_service.word_matching_grid(jlpt=jlpt, count=count)


@router.get("/kanji/dictionary-status")
async def get_kanji_dictionary_status():
    """Return dictionary validation summary."""
    return kanji_dictionary_service.validate()


@router.get("/api/kanji/{kanji}/handwriting-samples")
@router.get("/kanji/{kanji}/handwriting-samples")
async def get_kanji_handwriting_samples(
    kanji: str,
    limit: int = Query(default=5, ge=1, le=12),
):
    """Return ETL10 handwriting sample thumbnails for one kanji when available."""
    return kanji_dictionary_service.handwriting_samples(kanji, limit=limit)


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
@router.post("/kanji/recognize", response_model=schemas.KanjiRecognitionResponse)
async def recognize_kanji(payload: schemas.KanjiRecognitionRequest):
    """Recognize handwriting from canvas image/stroke data."""
    if not payload.image_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_data is required")
    return kanji_recognition_service.recognize(payload)


@router.post("/api/kanji/correction")
@router.post("/kanji/correction")
async def save_kanji_correction(payload: schemas.KanjiCorrectionRequest):
    """Save anonymized user correction data for future fine-tuning."""
    sample_id = kanji_sample_store.save_sample(
        image_data=payload.image_data,
        strokes=[[point.model_dump() for point in stroke] for stroke in payload.strokes],
        predicted_kanji=payload.predicted_kanji,
        corrected_kanji=payload.correct_kanji,
        jlpt_level=payload.jlpt_level,
        source="correction",
    )
    return {"success": True, "sample_id": sample_id}


@router.get("/api/kanji/model-info", response_model=schemas.KanjiModelInfoResponse)
@router.get("/kanji/model-info", response_model=schemas.KanjiModelInfoResponse)
async def get_kanji_model_info():
    """Return current visual recognition model coverage."""
    return get_model_info()


@router.get("/api/kanji/supported", response_model=schemas.SupportedKanjiVGResponse)
@router.get("/kanji/supported", response_model=schemas.SupportedKanjiVGResponse)
async def get_supported_kanjivg():
    """List kanji with normalized KanjiVG stroke data."""
    return kanjivg_service.get_supported_kanji()


@router.get("/api/kanji/{kanji}/strokes", response_model=schemas.KanjiVGStrokeData)
@router.get("/kanji/{kanji}/strokes", response_model=schemas.KanjiVGStrokeData)
async def get_kanji_strokes(kanji: str):
    """Get normalized KanjiVG stroke paths for one kanji."""
    return kanjivg_service.get_stroke_data(kanji)


@router.get("/api/kanji/{kanji}/metadata", response_model=schemas.KanjiVGMetadata)
@router.get("/kanji/{kanji}/metadata", response_model=schemas.KanjiVGMetadata)
async def get_kanji_metadata(kanji: str):
    """Get metadata used for practice feedback and stroke-count comparison."""
    return kanjivg_service.get_metadata(kanji)


@router.get("/kanji/{kanji}/stroke-order")
async def get_kanji_stroke_order(kanji: str):
    """Return dynamic KanjiVG stroke order data for one kanji."""
    return kanjivg_service.get_stroke_order_response(kanji)


@router.get("/kanji/{kanji_key}")
async def get_kanji(kanji_key: str, db: Session = Depends(get_db)):
    """Get one kanji dictionary entry, with numeric legacy DB lookup preserved."""
    if kanji_key.isdigit():
        return learning_content_service.get_kanji(db, int(kanji_key))

    entry = kanji_dictionary_service.get_entry(kanji_key)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanji data not found in local dictionary.")
    return entry


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
