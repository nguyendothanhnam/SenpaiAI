"""Shared selector and serving ledger. Transactions belong to callers, never commit here."""
import random
import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from ..core.exercise_selection_config import COOLDOWN_DAYS, LEVELS, REVIEW_INTERVAL_DAYS, SIMILARITY_THRESHOLD
from ..models.database import ExerciseDelivery, ExerciseHistory, User
from .exercise_content import content_fingerprint, normalize_content, similar_normalized, numeric_signature


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def fallback_levels(level):
    if level not in LEVELS:
        raise ValueError("Unsupported JLPT level")
    index = LEVELS.index(level)
    return (level, *reversed(LEVELS[:index]), *LEVELS[index + 1:])


@dataclass
class Candidate:
    source_type: str
    source_id: str
    level: str
    skill: str
    question_type: str
    content: str
    pattern: str = ""
    category: str = ""
    value: Any = None
    fingerprint: str = field(init=False)
    normalized: str = field(init=False)

    def __post_init__(self):
        self.source_id = str(self.source_id)
        self.normalized = normalize_content(self.content)
        self.fingerprint = content_fingerprint(self.content)

    @property
    def key(self):
        return self.source_type, self.source_id


@dataclass
class Selection:
    items: list[Candidate]
    requested_level: str
    review_keys: set = field(default_factory=set)
    cooldown_relaxed: bool = False
    recent_keys: set = field(default_factory=set)

    def metadata(self, candidate):
        return {"requested_level": self.requested_level, "actual_level": candidate.level,
                "fallback": candidate.level != self.requested_level,
                "review_mode": candidate.key in self.review_keys,
                "cooldown_relaxed": candidate.key in self.recent_keys}


def choose_candidates(candidates, history, level, count, *, now=None, cooldown_days=COOLDOWN_DAYS,
                      distribution=None, excluded=(), rng=None):
    """Pure selection: strict within-session dedup; cooldown relaxed only after exhaustion."""
    if count < 0 or cooldown_days < 0:
        raise ValueError("Counts and cooldown must be nonnegative")
    now = utc(now or datetime.now(timezone.utc))
    cutoff = now - timedelta(days=cooldown_days)
    chooser = rng or random
    ranks = {value: index for index, value in enumerate(fallback_levels(level))}
    by_source = {(row.source_type, row.source_id): row for row in history}
    by_fingerprint = {}
    fuzzy_buckets = {}
    for row in history:
        by_fingerprint.setdefault(row.fingerprint, []).append(row)
        text = row.normalized_content
        fuzzy_buckets.setdefault((numeric_signature(text), len(text)), []).append(row)
    pool, used_keys = [], set(excluded)
    for candidate in candidates:
        if not candidate.normalized or candidate.level not in ranks or candidate.key in used_keys:
            continue
        matches = list(by_fingerprint.get(candidate.fingerprint, []))
        source = by_source.get(candidate.key)
        if source and source not in matches:
            matches.append(source)
        # Near-duplicate historical IDs must not bypass cooldown across contexts.
        if len(candidate.normalized) >= 12:
            length = len(candidate.normalized)
            signature = numeric_signature(candidate.normalized)
            for size in range(math.ceil(length * SIMILARITY_THRESHOLD), math.floor(length / SIMILARITY_THRESHOLD) + 1):
                for row in fuzzy_buckets.get((signature, size), ()):
                    if row not in matches and similar_normalized(candidate.normalized, row.normalized_content):
                        matches.append(row)
        latest = max(matches, key=lambda row: utc(row.last_served_at), default=None)
        recent = latest is not None and utc(latest.last_served_at) > cutoff
        due = any(row.last_result is False or (row.due_at and utc(row.due_at) <= now) for row in matches)
        pool.append((candidate, latest, recent, 0 if latest is None else 1 if due else 2, chooser.random()))
    chosen, texts, reviews, recent_keys = [], [], set(), set()
    categories, skills, types = Counter(), Counter(), Counter()
    previous_pattern = None
    relaxed = False
    # Exhaust unseen/due content across levels before early review, and only
    # relax cooldown after both those pools are exhausted.
    for phase in (0, 1, 2):
        while len(chosen) < count:
            available = [entry for entry in pool if entry[0].key not in used_keys
                         and (phase == 2 or not entry[2]) and (phase != 0 or entry[3] < 2)]
            if not available:
                break
            def priority(entry):
                item, latest, recent, freshness, tie = entry
                category = item.category or item.skill
                quota = (distribution or {}).get(category, 0)
                coverage = categories[category] / quota if quota else (1 if distribution else skills[item.skill])
                last_time = utc(latest.last_served_at).timestamp() if latest else 0
                # Rank level before freshness; quotas and variety are soft constraints.
                return (ranks[item.level], freshness, item.pattern == previous_pattern if item.pattern else False, coverage,
                        types[item.question_type], last_time, tie)
            available.sort(key=priority)
            accepted = None
            for entry in available:
                if any(similar_normalized(entry[0].normalized, text) for text in texts):
                    used_keys.add(entry[0].key)
                    continue
                accepted = entry
                break
            if accepted is None:
                break
            item, latest, recent, _, _ = accepted
            chosen.append(item); texts.append(item.normalized); used_keys.add(item.key)
            categories[item.category or item.skill] += 1
            skills[item.skill] += 1; types[item.question_type] += 1
            previous_pattern = item.pattern
            if latest:
                reviews.add(item.key)
            relaxed = relaxed or recent
            if recent:
                recent_keys.add(item.key)
    return Selection(chosen, level, reviews, relaxed, recent_keys)


def select_for_user(db, user_id, level, skill, count, context, constraints=None, *, candidates=None, now=None, rng=None):
    """Internal reusable API; adapters can supply placement/quiz candidates later."""
    constraints = constraints or {}
    db.query(User.id).filter_by(id=user_id).with_for_update().one()
    if candidates is None:
        from .exercise_catalog import load_candidates
        candidates = load_candidates(db, skill, constraints)
    history = db.query(ExerciseHistory).filter_by(user_id=user_id).all()
    return choose_candidates(candidates, history, level, count, now=now, rng=rng,
        cooldown_days=constraints.get("cooldown_days", COOLDOWN_DAYS),
        distribution=constraints.get("distribution"), excluded=constraints.get("excluded", ()))


def record_served(db, user_id, selection, context, context_ref, *, now=None):
    """One delivery per stable session/source; repeated GET/resume never increments."""
    now = utc(now or datetime.now(timezone.utc))
    db.query(User.id).filter_by(id=user_id).with_for_update().one()
    history = {(row.source_type, row.source_id): row for row in db.query(ExerciseHistory).filter_by(user_id=user_id).all()}
    existing = {(row.source_type, row.source_id) for row in db.query(ExerciseDelivery).filter_by(
        user_id=user_id, context=context, context_ref=str(context_ref)).all()}
    pending = []
    for item in selection.items:
        if item.key in existing:
            continue
        existing.add(item.key)
        row = history.get(item.key)
        if row is None:
            row = ExerciseHistory(user_id=user_id, source_type=item.source_type, source_id=item.source_id,
                fingerprint=item.fingerprint, normalized_content=item.normalized, jlpt_level=item.level,
                skill=item.skill, served_count=0, correct_streak=0, last_context=context, last_served_at=now)
            db.add(row); history[item.key] = row
        row.served_count += 1
        row.last_served_at, row.last_context = now, context
        row.fingerprint, row.normalized_content = item.fingerprint, item.normalized
        row.jlpt_level, row.skill = item.level, item.skill
        pending.append((item, row))
    db.flush()
    for item, row in pending:
        db.add(ExerciseDelivery(user_id=user_id, history_id=row.id, source_type=item.source_type,
            source_id=item.source_id, context=context, context_ref=str(context_ref), served_at=now))
    db.flush()


def record_answer(db, user_id, source_type, source_id, context, context_ref, correct, *, now=None):
    now = utc(now or datetime.now(timezone.utc))
    db.query(User.id).filter_by(id=user_id).with_for_update().one()
    delivery = db.query(ExerciseDelivery).filter_by(user_id=user_id, source_type=source_type,
        source_id=str(source_id), context=context, context_ref=str(context_ref)).with_for_update().first()
    if delivery is None or delivery.answered_at is not None:
        return False
    delivery.answered_at, delivery.result = now, bool(correct)
    row = db.query(ExerciseHistory).filter_by(id=delivery.history_id, user_id=user_id).with_for_update().one()
    # A late answer from an old session must not replace the latest serving result.
    newer = db.query(ExerciseDelivery.id).filter(ExerciseDelivery.history_id == row.id,
        ExerciseDelivery.id > delivery.id).first()
    if newer is None:
        row.last_result, row.last_answered_at = bool(correct), now
        row.correct_streak = (row.correct_streak or 0) + 1 if correct else 0
        interval = REVIEW_INTERVAL_DAYS[min(max(row.correct_streak - 1, 0), len(REVIEW_INTERVAL_DAYS) - 1)]
        row.due_at = now + timedelta(days=interval)
    db.flush()
    return True


def clear_history(db, user_id):
    db.query(User.id).filter_by(id=user_id).with_for_update().one()
    db.query(ExerciseDelivery).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(ExerciseHistory).filter_by(user_id=user_id).delete(synchronize_session=False)


def export_history(db, user_id):
    columns = ("source_type", "source_id", "fingerprint", "jlpt_level", "skill", "served_count", "last_served_at",
               "last_result", "last_answered_at", "correct_streak", "due_at", "last_context")
    return {"items": [{key: getattr(row, key) for key in columns} for row in db.query(ExerciseHistory).filter_by(user_id=user_id).order_by(ExerciseHistory.id)],
            "deliveries": [{key: getattr(row, key) for key in ("source_type", "source_id", "context", "context_ref", "served_at", "answered_at", "result")}
                           for row in db.query(ExerciseDelivery).filter_by(user_id=user_id).order_by(ExerciseDelivery.id)]}
