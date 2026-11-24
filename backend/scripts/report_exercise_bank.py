"""Read-only usable exercise inventory and conservative no-repeat capacity report."""
import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.core.exercise_selection_config import COOLDOWN_DAYS, LEVELS
from app.core.rewards_config import DAILY_ITEM_COUNT, DAILY_ITEM_DISTRIBUTION
from app.services.daily_task_service import _grammar_candidates, _kanji_candidates, _vocab_candidates, _flashcard_candidates
from app.services.exercise_content import content_fingerprint, similar_content


def summarize_pool(pools, items_per_day=DAILY_ITEM_COUNT, target_days=30):
    distinct, rejected, kinds = {}, 0, Counter()
    categories = {}
    for category, items in pools.items():
        seen = []
        for item in items:
            content = item.get('selection_content') or item['payload'].get('prompt', '')
            if any(similar_content(content, old) for old in seen):
                rejected += 1
                continue
            seen.append(content)
            skill = 'vocab' if category == 'flashcard' else category
            fingerprint = content_fingerprint(content)
            distinct.setdefault(skill, set()).add(fingerprint)
            categories.setdefault(category, set()).add(fingerprint)
            kinds[item['question_type']] += 1
    total = len(set().union(*distinct.values())) if distinct else 0
    balanced = min((len(categories.get(name, set())) // count for name, count in DAILY_ITEM_DISTRIBUTION.items() if count), default=0)
    return {
        'usable_unique_by_skill': {name: len(distinct.get(name, set())) for name in ('grammar', 'kanji', 'vocab')},
        'variants_by_question_type': dict(kinds), 'near_duplicate_variants_excluded': rejected,
        'unique_total_without_double_counting_flashcards': total,
        'days_before_first_repeat_with_redistribution': total // items_per_day,
        'days_with_full_default_distribution': balanced,
        'target_days': target_days, 'target_items': target_days * items_per_day,
        'additional_unique_items_for_target': max(0, target_days * items_per_day - total),
        'cooldown_days': COOLDOWN_DAYS,
        'cooldown_capacity_shortfall': max(0, COOLDOWN_DAYS * items_per_day - total),
        'needs_content_by_default_category': {name: max(0, count * target_days - len(categories.get(name, set())))
                                             for name, count in DAILY_ITEM_DISTRIBUTION.items()},
    }


def report(db, items_per_day=DAILY_ITEM_COUNT, target_days=30):
    builders = {'grammar': _grammar_candidates, 'kanji': _kanji_candidates, 'vocab': _vocab_candidates, 'flashcard': _flashcard_candidates}
    levels = {}
    for level in LEVELS:
        pools = {name: builder(db, 0, level, set(), rng=random.Random(0)) if name == 'kanji' else builder(db, 0, level, set()) for name, builder in builders.items()}
        levels[level] = summarize_pool(pools, items_per_day, target_days)
    return {'levels': levels, 'items_per_day': items_per_day,
            'scope': 'Published usable daily/grammar sources; no personal exposure data; no writes or AI calls.',
            'limits': 'Inventory capacity estimate, not guaranteed per-user days. Skill quotas, similarity exclusions, recent history and fallback change actual capacity. Reading/listening/placement/quiz are not integrated in this phase.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--items-per-day', type=int, default=DAILY_ITEM_COUNT)
    parser.add_argument('--days', type=int, default=30)
    parser.add_argument('--output', type=Path, help='Optional UTF-8 JSON report path')
    args = parser.parse_args()
    if args.items_per_day < 1 or args.days < 1:
        parser.error('items-per-day and days must be positive')
    with SessionLocal() as db:
        output = json.dumps(report(db, args.items_per_day, args.days), ensure_ascii=False, indent=2)
        if args.output:
            args.output.write_text(output + '\n', encoding='utf-8')
            print(f'Report written to {args.output}')
        else:
            print(output)
