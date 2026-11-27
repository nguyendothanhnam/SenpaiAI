"""Import supplied JSON: python -m scripts.import_grammar_lessons path.json"""
import json
import sys
from pathlib import Path
from app.core.database import SessionLocal
from app.services.grammar_lessons import import_lessons


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python -m scripts.import_grammar_lessons path.json')
    path = Path(sys.argv[1])
    if path.stat().st_size > 10 * 1024 * 1024:
        raise SystemExit('File exceeds 10 MiB')
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    with SessionLocal() as db:
        try:
            result = import_lessons(db, data)
            db.commit()
            print(json.dumps(result))
        except Exception:
            db.rollback()
            raise


if __name__ == '__main__':
    main()
