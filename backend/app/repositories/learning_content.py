from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from ..models.database import Kanji, KanjiExample, KanjiReading, Vocabulary, VocabularyKanji
from ..models import schemas


class KanjiRepository:
    def list(
        self,
        db: Session,
        *,
        search: Optional[str],
        jlpt_level: Optional[str],
        limit: int,
        offset: int,
    ) -> tuple[list[Kanji], int]:
        query = db.query(Kanji)

        if jlpt_level:
            query = query.filter(Kanji.jlpt_level == jlpt_level)

        if search:
            pattern = f"%{search}%"
            query = query.outerjoin(Kanji.readings).filter(
                or_(
                    Kanji.character.ilike(pattern),
                    Kanji.meaning_vi.ilike(pattern),
                    KanjiReading.reading.ilike(pattern),
                    KanjiReading.romaji.ilike(pattern),
                )
            )

        total = query.with_entities(func.count(func.distinct(Kanji.id))).scalar() or 0
        items = (
            query.options(selectinload(Kanji.readings), selectinload(Kanji.examples))
            .distinct()
            .order_by(Kanji.jlpt_level.asc(), Kanji.character.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    def get_by_id(self, db: Session, kanji_id: int) -> Optional[Kanji]:
        return (
            db.query(Kanji)
            .options(joinedload(Kanji.readings), joinedload(Kanji.examples))
            .filter(Kanji.id == kanji_id)
            .first()
        )

    def get_by_character(self, db: Session, character: str) -> Optional[Kanji]:
        return db.query(Kanji).filter(Kanji.character == character).first()

    def create(self, db: Session, payload: schemas.KanjiCreate) -> Kanji:
        kanji = Kanji(
            character=payload.character,
            meaning_vi=payload.meaning_vi,
            jlpt_level=payload.jlpt_level,
            stroke_count=payload.stroke_count,
        )

        kanji.readings = [
            KanjiReading(
                reading_type=reading.reading_type,
                reading=reading.reading,
                romaji=reading.romaji,
            )
            for reading in payload.readings
        ]
        kanji.examples = [
            KanjiExample(
                sentence=example.sentence,
                reading=example.reading,
                romaji=example.romaji,
                meaning_vi=example.meaning_vi,
            )
            for example in payload.examples
        ]

        db.add(kanji)
        db.commit()
        db.refresh(kanji)
        return self.get_by_id(db, kanji.id)


class VocabularyRepository:
    def list(
        self,
        db: Session,
        *,
        search: Optional[str],
        jlpt_level: Optional[str],
        limit: int,
        offset: int,
    ) -> tuple[list[Vocabulary], int]:
        query = db.query(Vocabulary)

        if jlpt_level:
            query = query.filter(Vocabulary.jlpt_level == jlpt_level)

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Vocabulary.japanese_word.ilike(pattern),
                    Vocabulary.reading.ilike(pattern),
                    Vocabulary.meaning.ilike(pattern),
                )
            )

        total = query.count()
        items = (
            query.options(joinedload(Vocabulary.kanji_links).joinedload(VocabularyKanji.kanji))
            .order_by(Vocabulary.jlpt_level.asc(), Vocabulary.japanese_word.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    def get_by_word_reading(self, db: Session, word: str, reading: str) -> Optional[Vocabulary]:
        return (
            db.query(Vocabulary)
            .filter(Vocabulary.japanese_word == word, Vocabulary.reading == reading)
            .first()
        )

    def create(self, db: Session, payload: schemas.VocabularyCreate) -> Vocabulary:
        vocabulary = Vocabulary(
            japanese_word=payload.word,
            reading=payload.reading,
            romaji=payload.romaji,
            meaning=payload.meaning_vi,
            part_of_speech=payload.part_of_speech,
            jlpt_level=payload.jlpt_level,
            example_sentences=payload.example_sentences,
        )
        db.add(vocabulary)
        db.flush()

        for position, kanji_id in enumerate(payload.kanji_ids, start=1):
            db.add(
                VocabularyKanji(
                    vocabulary_id=vocabulary.id,
                    kanji_id=kanji_id,
                    position_in_word=position,
                )
            )

        db.commit()
        db.refresh(vocabulary)
        return (
            db.query(Vocabulary)
            .options(joinedload(Vocabulary.kanji_links).joinedload(VocabularyKanji.kanji))
            .filter(Vocabulary.id == vocabulary.id)
            .first()
        )
