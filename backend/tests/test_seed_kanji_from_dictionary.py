import json

from sqlalchemy import create_engine, event, func
from sqlalchemy.orm import sessionmaker

from app.models.database import Kanji, KanjiExample, KanjiReading
from scripts.seed_kanji_from_dictionary import seed


def test_seed_is_idempotent_and_leaves_existing_n4_unchanged(tmp_path):
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def sqlite_functions(connection, _):
        connection.create_function("char_length", 1, lambda value: len(value or ""))

    tables = [Kanji.__table__, KanjiReading.__table__, KanjiExample.__table__]
    Kanji.__table__.metadata.create_all(engine, tables=tables)
    Session = sessionmaker(bind=engine)
    path = tmp_path / "dictionary.json"
    path.write_text(json.dumps([
        {"kanji": "甲", "jlpt": "N3", "meaning_vi": "một", "stroke_count": 5,
         "onyomi": ["コウ"], "kunyomi": ["きのえ"],
         "examples": [{"word": "甲子", "reading": "こうし", "meaning": "ví dụ"}]},
        {"kanji": "乙", "jlpt": "N4", "meaning_vi": "hai", "stroke_count": 1,
         "onyomi": [], "kunyomi": [], "examples": []},
    ], ensure_ascii=False), encoding="utf-8")
    with Session() as db:
        old = Kanji(character="乙", jlpt_level="N4", meaning_vi="giữ nguyên", stroke_count=1)
        db.add(old)
        db.commit()

        assert seed(db, path) == {"created": 1, "updated": 0, "skipped_non_n3_conflicts": 0}
        assert seed(db, path) == {"created": 0, "updated": 1, "skipped_non_n3_conflicts": 0}
        assert db.query(Kanji).count() == 2
        assert db.query(KanjiReading).count() == 2
        assert db.query(KanjiExample).count() == 1
        unchanged = db.query(Kanji).filter_by(character="乙").one()
        assert (unchanged.jlpt_level, unchanged.meaning_vi) == ("N4", "giữ nguyên")
        assert db.query(func.count(Kanji.id)).filter(Kanji.jlpt_level == "N3").scalar() == 1

    engine.dispose()
