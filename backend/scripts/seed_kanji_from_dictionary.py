"""Idempotently seed JLPT N3 dictionary entries into the relational Kanji tables."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.database import Kanji, KanjiExample, KanjiReading


DEFAULT_DICTIONARY = ROOT / "app" / "data" / "kanji_dictionary.json"


def _values(value) -> list[str]:
    if isinstance(value, list):
        return list(dict.fromkeys(str(item).strip() for item in value if str(item).strip()))
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def seed(db: Session, dictionary_path: Path = DEFAULT_DICTIONARY) -> dict[str, int]:
    with Path(dictionary_path).open("r", encoding="utf-8") as file:
        entries = json.load(file)
    if not isinstance(entries, list):
        raise ValueError("Kanji dictionary must contain a JSON list")

    counts = {"created": 0, "updated": 0, "skipped_non_n3_conflicts": 0}
    try:
        for entry in entries:
            if not isinstance(entry, dict) or str(entry.get("jlpt") or "").upper() != "N3":
                continue
            character = str(entry.get("kanji") or "")[:1]
            meaning = str(entry.get("meaning_vi") or entry.get("meaning") or "").strip()
            if not character or not meaning:
                continue
            kanji = db.query(Kanji).filter(Kanji.character == character).first()
            if kanji is not None and kanji.jlpt_level != "N3":
                counts["skipped_non_n3_conflicts"] += 1
                continue
            is_new = kanji is None
            if is_new:
                kanji = Kanji(character=character, jlpt_level="N3", meaning_vi=meaning)
                db.add(kanji)
            kanji.meaning_vi = meaning
            kanji.jlpt_level = "N3"
            try:
                kanji.stroke_count = int(entry.get("stroke_count", entry.get("strokes")))
            except (TypeError, ValueError):
                kanji.stroke_count = None

            if not is_new:
                # Delete explicitly and flush before inserting replacements so
                # unique constraints remain safe on databases that insert
                # before processing ORM relationship deletes.
                db.query(KanjiReading).filter(KanjiReading.kanji_id == kanji.id).delete(synchronize_session=False)
                db.query(KanjiExample).filter(KanjiExample.kanji_id == kanji.id).delete(synchronize_session=False)
                db.flush()
                db.expire(kanji, ["readings", "examples"])
            for reading_type in ("onyomi", "kunyomi"):
                for reading in _values(entry.get(reading_type)):
                    kanji.readings.append(KanjiReading(reading_type=reading_type, reading=reading))
            for example in entry.get("examples") or []:
                if not isinstance(example, dict):
                    continue
                sentence = str(example.get("word") or example.get("sentence") or "").strip()
                if not sentence:
                    continue
                kanji.examples.append(KanjiExample(
                    sentence=sentence,
                    reading=str(example.get("reading") or "").strip(),
                    meaning_vi=str(example.get("meaning_vi") or example.get("meaning") or "").strip(),
                ))
            counts["created" if is_new else "updated"] += 1
        db.commit()
        return counts
    except Exception:
        db.rollback()
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed N3 kanji_dictionary entries into kanji, kanji_readings, and kanji_examples.")
    parser.add_argument("--dictionary", type=Path, default=DEFAULT_DICTIONARY)
    args = parser.parse_args()
    with SessionLocal() as db:
        print(seed(db, args.dictionary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
