"""Inventory and measured bounded searches on the current complete catalog."""
import argparse
import json
from pathlib import Path
import statistics
import sys
import time
from sqlalchemy import func

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.core.database import SessionLocal
from app.models.database import Vocabulary
from app.services.dictionary_service import search_rows, serialize
from app.services.vocabulary_text import display_meaning


def inventory(db):
    result = {}
    for level in ('N5', 'N4', 'N3', 'N2', 'N1'):
        rows = db.query(Vocabulary).filter(Vocabulary.jlpt_level == level).all()
        result[level] = {'total': len(rows), 'reviewed_vi': sum(bool(r.meaning.strip()) and r.meaning_vi_status == 'reviewed' for r in rows),
            'automatic_vi': sum(bool(r.meaning.strip()) and r.meaning_vi_status == 'automatic' for r in rows),
            'english': sum(bool(r.meaning_en) for r in rows), 'with_examples': sum(bool(r.example_sentences) for r in rows),
            'with_furigana': sum(any(isinstance(e, dict) and e.get('furigana') for e in r.example_sentences or []) for r in rows),
            'with_jmdict_id': sum(r.jmdict_id is not None for r in rows),
            'usable_grading_meanings': sum(bool(display_meaning(r)) for r in rows),
            'distinct_grading_meanings': len({display_meaning(r) for r in rows if display_meaning(r)}),
            'unique_matching_words': len({r.japanese_word for r in rows if display_meaning(r)})}
    return result


def benchmark(db, repetitions=10):
    results = []
    for query in ('食べる', 'たべる', 'taberu', 'school', 'truong hoc', '開く', 'xyz-no-match'):
        durations = []
        for _ in range(repetitions):
            start = time.perf_counter()
            rows, total = search_rows(db, query, limit=50)
            payload = [serialize(row) for row in rows]
            durations.append(1000 * (time.perf_counter() - start))
        results.append({'query': query, 'total': total, 'page_size': len(payload),
            'mean_ms': round(statistics.mean(durations), 3), 'p95_ms': round(sorted(durations)[min(len(durations)-1, int(.95*len(durations)))], 3)})
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    with SessionLocal() as db:
        report = {'dialect': db.bind.dialect.name, 'total': db.query(func.count(Vocabulary.id)).scalar(),
            'levels': inventory(db), 'benchmarks': benchmark(db) if args.benchmark else [],
            'limits': ['Single-process local measurements, SQL + serialization, not HTTP/network/load/SLA.',
                'Imported source is English; existing Vietnamese is retained when present. No bulk AI translation.',
                'Substring accent-insensitive search scans the normalized text; level/POS and exact-identity/source lookups have indexes. Reassess PostgreSQL trigram indexing if the corpus grows substantially.']}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report, ensure_ascii=True, indent=2))
