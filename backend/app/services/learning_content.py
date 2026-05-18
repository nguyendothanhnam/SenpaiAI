from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import schemas
from ..models.database import Kanji, Vocabulary
from ..repositories.learning_content import KanjiRepository, VocabularyRepository


class LearningContentService:
    def __init__(self) -> None:
        self.kanji_repo = KanjiRepository()
        self.vocabulary_repo = VocabularyRepository()

    def list_kanji(
        self,
        db: Session,
        *,
        search: str | None,
        jlpt_level: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Kanji], int]:
        return self.kanji_repo.list(
            db,
            search=search,
            jlpt_level=jlpt_level,
            limit=limit,
            offset=offset,
        )

    def get_kanji(self, db: Session, kanji_id: int) -> Kanji:
        kanji = self.kanji_repo.get_by_id(db, kanji_id)
        if not kanji:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Kanji not found",
            )
        return kanji

    def create_kanji(self, db: Session, payload: schemas.KanjiCreate) -> Kanji:
        existing = self.kanji_repo.get_by_character(db, payload.character)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Kanji already exists",
            )
        return self.kanji_repo.create(db, payload)

    def list_vocabulary(
        self,
        db: Session,
        *,
        search: str | None,
        jlpt_level: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Vocabulary], int]:
        return self.vocabulary_repo.list(
            db,
            search=search,
            jlpt_level=jlpt_level,
            limit=limit,
            offset=offset,
        )

    def create_vocabulary(self, db: Session, payload: schemas.VocabularyCreate) -> Vocabulary:
        existing = self.vocabulary_repo.get_by_word_reading(db, payload.word, payload.reading)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vocabulary already exists",
            )

        missing_kanji_ids = [
            kanji_id
            for kanji_id in payload.kanji_ids
            if self.kanji_repo.get_by_id(db, kanji_id) is None
        ]
        if missing_kanji_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kanji IDs not found: {missing_kanji_ids}",
            )

        return self.vocabulary_repo.create(db, payload)


learning_content_service = LearningContentService()
