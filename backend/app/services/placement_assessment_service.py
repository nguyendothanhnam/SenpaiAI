"""Transactional v2 placement sessions; v1 sessions keep their existing grading policy."""
import random
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from ..core import placement_config as policy
from ..models.database import PlacementAttempt, PlacementAttemptItem, User
from .placement_question_bank import bank_snapshots, level_availability
from .placement_selection import next_adaptive, fixed_questions, adapt_level
from .placement_scoring import score_assessment


def now_utc():
    return datetime.now(timezone.utc)


def utc_timestamp(value):
    # SQLite strips timezone information; API timestamps must still be explicit UTC.
    return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


def is_v2(attempt):
    return attempt.assessment_mode in {"adaptive", "confirmation"}


def items_for(db, attempt):
    return db.query(PlacementAttemptItem).filter_by(attempt_id=attempt.id).order_by(PlacementAttemptItem.position).all()


def answered_rows(items):
    return [{"snapshot": item.snapshot, "answer": item.user_answer, "correct": item.is_correct} for item in items]


def assessment_score(db, attempt, reason="submitted"):
    return score_assessment(attempt.assessment_mode, attempt.selected_level, attempt.available_levels,
                            answered_rows(items_for(db, attempt)), reason)


def add_item(db, attempt, snapshot):
    snapshot = {**snapshot, "public": dict(snapshot["public"])}
    choices = list(snapshot["public"]["choices"])
    random.shuffle(choices)
    snapshot["public"]["choices"] = choices
    item = PlacementAttemptItem(attempt_id=attempt.id, question_id=snapshot["question_id"],
                               source_key=snapshot["source_key"], position=len(attempt.questions), snapshot=snapshot)
    db.add(item)
    attempt.questions = [*attempt.questions, snapshot["key"]]
    db.flush()
    return item


def finalize(db, attempt, reason="submitted"):
    if attempt.status != "in_progress":
        return attempt
    result = assessment_score(db, attempt, reason)
    attempt.status = "completed"
    attempt.completed_at = now_utc()
    attempt.result, attempt.skill_scores = result, result["skill_scores"]
    attempt.estimated_level, attempt.recommended_level = result["estimated_level"], result["recommended_level"]
    attempt.total_score = result["total_score"]
    attempt.revision += 1
    db.flush()
    return attempt


def expire_if_needed(db, attempt):
    if is_v2(attempt) and attempt.status == "in_progress" and attempt.expires_at:
        deadline = attempt.expires_at.replace(tzinfo=timezone.utc) if attempt.expires_at.tzinfo is None else attempt.expires_at
        if now_utc() >= deadline:
            finalize(db, attempt, "expired")
            return True
    return False


def start_assessment(db, user, language, mode, selected_level):
    db.query(User).filter_by(id=user.id).with_for_update().one()
    active = db.query(PlacementAttempt).filter_by(user_id=user.id, status="in_progress").with_for_update().first()
    if active:
        expire_if_needed(db, active)
        if active.status == "in_progress":
            if active.assessment_mode == mode and active.selected_level == selected_level:
                return active
            raise HTTPException(409, "placement_active_attempt")
    if mode == "confirmation" and selected_level not in policy.LEVELS:
        raise HTTPException(422, "placement_select_level")
    if mode == "adaptive" and selected_level is not None:
        raise HTTPException(422, "placement_invalid_answer")
    bank = bank_snapshots(db, language)
    ready = [row["level"] for row in level_availability(bank) if row["available"]]
    if mode == "confirmation":
        if selected_level not in ready:
            raise HTTPException(409, "placement_level_unavailable")
        levels = [selected_level]
    else:
        levels = []
        for level in policy.LEVELS:
            if level not in ready:
                break
            levels.append(level)
        if not levels:
            raise HTTPException(409, "placement_level_unavailable")
    seen = {key for (key,) in db.query(PlacementAttemptItem.source_key).join(PlacementAttempt).filter(PlacementAttempt.user_id == user.id).all()}
    attempt = PlacementAttempt(user_id=user.id, assessment_mode=mode, selected_level=selected_level,
        language=language, status="in_progress", bank=[item for item in bank if item["level"] in levels],
        questions=[], answers=[], available_levels=levels, target_level=levels[0],
        expires_at=now_utc() + timedelta(seconds=policy.TIME_LIMIT_SECONDS),
        scoring_version=policy.SCORING_VERSION, estimation_version=policy.ESTIMATION_VERSION, revision=0)
    db.add(attempt); db.flush()
    selected = fixed_questions(attempt.bank, selected_level, seen) if mode == "confirmation" else [next_adaptive(attempt.bank, set(), levels[0], seen)]
    for snapshot in selected:
        add_item(db, attempt, snapshot)
    return attempt


def answer_assessment(db, attempt, key, answer, revision):
    if expire_if_needed(db, attempt):
        return attempt
    item = next((row for row in items_for(db, attempt) if row.snapshot["key"] == key), None)
    if not item:
        raise HTTPException(409, "placement_question_changed")
    if item.user_answer == answer and item.answered_at is not None:
        return attempt
    if attempt.status != "in_progress":
        raise HTTPException(409, "placement_question_changed")
    if not isinstance(answer, str) or answer not in {value["id"] for value in item.snapshot["public"]["choices"]}:
        raise HTTPException(422, "placement_invalid_answer")
    if attempt.assessment_mode == "adaptive" and (item.answered_at is not None or key != attempt.questions[-1]):
        raise HTTPException(409, "placement_answer_conflict")
    if revision is None or revision != item.revision:
        raise HTTPException(409, "placement_answer_conflict")
    changed = db.query(PlacementAttemptItem).filter_by(id=item.id, revision=revision).update({
        PlacementAttemptItem.user_answer: answer, PlacementAttemptItem.is_correct: answer == item.snapshot["answer"],
        PlacementAttemptItem.answered_at: now_utc(), PlacementAttemptItem.revision: revision + 1}, synchronize_session=False)
    if changed != 1:
        raise HTTPException(409, "placement_answer_conflict")
    db.expire(item)
    attempt.revision += 1
    db.flush()
    if attempt.assessment_mode == "adaptive":
        rows = items_for(db, attempt)
        history = [{"level": row.snapshot["level"], "correct": row.is_correct} for row in rows if row.answered_at is not None]
        # Only consecutive responses at the current level count toward a move.
        current_segment = []
        for entry in reversed(history):
            if entry["level"] != attempt.target_level:
                break
            current_segment.insert(0, entry)
        attempt.target_level = adapt_level(attempt.available_levels, attempt.target_level, current_segment)
        score = assessment_score(db, attempt)
        # Evidence checks for demo use the same policy without granting a profile estimate.
        enough = len(history) >= policy.MIN_QUESTIONS and (score["estimated_level"] is not None or score["suggested_level"] is not None)
        if len(history) < policy.MAX_QUESTIONS and not enough:
            used = set(attempt.questions)
            seen = {source for (source,) in db.query(PlacementAttemptItem.source_key).join(PlacementAttempt).filter(PlacementAttempt.user_id == attempt.user_id).all()}
            following = next_adaptive(attempt.bank, used, attempt.target_level, seen)
            if following:
                add_item(db, attempt, following)
    db.flush()
    return attempt


def public_assessment(db, attempt):
    rows = items_for(db, attempt)
    public_items = []
    for item in rows:
        public = dict(item.snapshot["public"])
        public.update(item_id=item.id, revision=item.revision, user_answer=item.user_answer)
        if item.snapshot.get("audio_path"):
            public["audio_url"] = f"/placement/attempts/{attempt.id}/media/{item.id}"
        public_items.append(public)
    pending = next((item for item in public_items if item["user_answer"] is None), None)
    return dict(id=attempt.id, status=attempt.status, language=attempt.language,
        assessment_mode=attempt.assessment_mode, selected_level=attempt.selected_level,
        answered_count=sum(item.answered_at is not None for item in rows), min_questions=policy.MIN_QUESTIONS,
        max_questions=policy.MAX_QUESTIONS, available_levels=attempt.available_levels, question=pending,
        items=public_items, ready_to_submit=pending is None, is_demo=any(item.snapshot.get("is_demo") for item in rows),
        result=attempt.result, created_at=utc_timestamp(attempt.created_at), completed_at=utc_timestamp(attempt.completed_at),
        confirmed_at=utc_timestamp(attempt.confirmed_at), expires_at=utc_timestamp(attempt.expires_at), server_time=now_utc(),
        scoring_version=attempt.scoring_version, estimation_version=attempt.estimation_version, revision=attempt.revision)
