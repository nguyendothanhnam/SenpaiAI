"""Offline, repeatable grammar import. Run after alembic upgrade head.

python -m scripts.seed_grammar_lessons --check  # validates committed snapshots; no DB needed
python -m scripts.seed_grammar_lessons          # upsert lessons in DATABASE_URL
"""
import argparse
from collections import Counter
import json

from app.core.database import SessionLocal
from app.services.bundled_grammar import load_catalog, sync_bundled_grammar


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate pinned files without connecting to a database')
    args = parser.parse_args()
    records = load_catalog()
    if args.check:
        print(json.dumps({'lessons': len(records), 'levels': dict(Counter(item['jlpt_level'] for item in records))}))
        return
    with SessionLocal() as db:
        try:
            report = sync_bundled_grammar(db, records)
            db.commit()
        except Exception:
            db.rollback()
            raise
    print(json.dumps(report))


if __name__ == '__main__':
    main()
