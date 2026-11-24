"""Deterministic policy boundaries with randomized sampling within equal priorities."""
import random
from collections import Counter
from ..core import placement_config as policy


def next_adaptive(bank, used, level, seen=()):
    pool = [item for item in bank if item["key"] not in used and item["level"] == level]
    counts = Counter(item["skill"] for item in bank if item["key"] in used and item["level"] == level)
    random.shuffle(pool)
    return min(pool, key=lambda item: (counts[item["skill"]], item["source_key"] in seen)) if pool else None


def fixed_questions(bank, level, seen=()):
    chosen = []
    for skill in policy.SKILLS:
        pool = [item for item in bank if item["level"] == level and item["skill"] == skill]
        random.shuffle(pool)
        used_stimuli = set()
        for _ in range(policy.FIXED_PER_SKILL):
            if not pool:
                raise ValueError("Insufficient fixed-form questions")
            item = min(pool, key=lambda value: (value["source_key"] in seen,
                       value["public"].get("stimulus_key") in used_stimuli))
            pool.remove(item)
            chosen.append(item)
            used_stimuli.add(item["public"].get("stimulus_key"))
    return chosen


def adapt_level(levels, current, answers):
    recent = [entry for entry in answers if entry["level"] == current]
    direction = 0
    if len(recent) >= policy.PROMOTE_STREAK and all(entry["correct"] for entry in recent[-policy.PROMOTE_STREAK:]):
        direction = 1
    elif len(recent) >= policy.DEMOTE_STREAK and all(not entry["correct"] for entry in recent[-policy.DEMOTE_STREAK:]):
        direction = -1
    rank = levels.index(current)
    return levels[max(0, min(len(levels) - 1, rank + direction))]
