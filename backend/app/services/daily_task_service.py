"""Daily task selection, safe payload construction, grading, and reward math."""
import random
from datetime import date, datetime, timezone
from typing import Any, Mapping, Sequence

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..core.rewards_config import (
    DAILY_BASE_POINTS,
    DAILY_ITEM_COUNT,
    DAILY_ITEM_DISTRIBUTION,
    PERFECT_BONUS,
    POINTS_PER_CORRECT,
    STREAK_BONUS_CAP_DAYS,
    STREAK_BONUS_PER_DAY,
    STREAK_MILESTONE_BONUSES,
)
from ..models.database import (
    DailyTask,
    DailyTaskItem,
    GrammarPracticeAttempt,
    GrammarQuestion,
    PointTransaction,
    StudyItemStat,
    Vocabulary,
)
from .grammar_practice_service import grade_answer, public_question
from .kanji_dictionary_service import kanji_dictionary_service
from .rewards_service import award_points, get_or_create_profile, update_streak_on_completion


class DailyTaskError(Exception):
    def __init__(self, code: str, status_code: int, message: str):
        self.code = code
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def weighted_sample(
    candidates: Sequence[Mapping[str, Any]],
    count: int,
    rng: Any = None,
) -> list[Mapping[str, Any]]:
    """Sample without replacement, making higher-weight weak items more likely."""
    chooser = rng or random
    pool = list(candidates)
    selected = []
    while pool and len(selected) < max(0, count):
        weights = [max(0.01, float(item.get("weight", 1))) for item in pool]
        item = chooser.choices(pool, weights=weights, k=1)[0]
        selected.append(item)
        pool.remove(item)
    return selected


def select_daily_items(
    pools: Mapping[str, Sequence[Mapping[str, Any]]],
    distribution: Mapping[str, int] = DAILY_ITEM_DISTRIBUTION,
    total_count: int = DAILY_ITEM_COUNT,
    rng: Any = None,
) -> list[Mapping[str, Any]]:
    """Fill configured category counts, then redistribute shortages to any source."""
    chooser = rng or random
    selected: list[Mapping[str, Any]] = []
    used = set()
    for item_type, requested in distribution.items():
        candidates = [item for item in pools.get(item_type, ()) if item.get("unique_key") not in used]
        chosen = weighted_sample(candidates, requested, chooser)
        selected.extend(chosen)
        used.update(item.get("unique_key") for item in chosen)
    if len(selected) < total_count:
        remaining = [
            item for candidates in pools.values() for item in candidates
            if item.get("unique_key") not in used
        ]
        selected.extend(weighted_sample(remaining, total_count - len(selected), chooser))
    chooser.shuffle(selected)
    return selected[:total_count]


def grade_daily_answer(item_type: str, question_type: str, answer: Any, answer_key: Mapping[str, Any]) -> bool:
    if item_type == "grammar":
        return grade_answer(question_type, answer, answer_key.get("correct_answer"), answer_key.get("accepted_answers"))
    if item_type == "flashcard":
        if isinstance(answer, bool):
            return answer
        return str(answer).strip().casefold() in {"remembered", "remember", "đã nhớ", "da nho", "true"}
    if not isinstance(answer, str):
        return False
    expected = answer_key.get("correct_answer")
    return " ".join(answer.casefold().split()) == " ".join(str(expected or "").casefold().split())


def calculate_reward_breakdown(correct_count: int, gradable_count: int, streak: int) -> dict[str, int]:
    base = DAILY_BASE_POINTS
    correct = max(0, correct_count) * POINTS_PER_CORRECT
    perfect = PERFECT_BONUS if gradable_count > 0 and correct_count == gradable_count else 0
    streak_bonus = min(max(0, streak), STREAK_BONUS_CAP_DAYS) * STREAK_BONUS_PER_DAY
    milestone = STREAK_MILESTONE_BONUSES.get(streak, 0)
    return {
        "base_points": base,
        "correct_points": correct,
        "perfect_bonus": perfect,
        "streak_bonus": streak_bonus,
        "streak_milestone_bonus": milestone,
        "total_points": base + correct + perfect + streak_bonus + milestone,
    }


def _wrong_counts(db: Session, user_id: int, item_type: str) -> dict[str, int]:
    if item_type in {"kanji", "vocab"}:
        return {
            str(item_id): int(wrong_count or 0)
            for item_id, wrong_count in db.query(StudyItemStat.item_id, StudyItemStat.wrong_count)
            .filter(StudyItemStat.user_id == user_id, StudyItemStat.item_type == item_type).all()
        }
    if item_type == "grammar":
        result: dict[str, int] = {}
        rows = db.query(GrammarPracticeAttempt.question_id, func.count(GrammarPracticeAttempt.id)).filter(
            GrammarPracticeAttempt.user_id == user_id,
            GrammarPracticeAttempt.question_id.isnot(None),
            GrammarPracticeAttempt.is_correct.is_(False),
        ).group_by(GrammarPracticeAttempt.question_id).all()
        for item_id, count in rows:
            result[str(item_id)] = int(count)
        # Daily grammar answers also contribute to identifying weak questions.
        from ..models.database import DailyTaskItem
        rows = db.query(DailyTaskItem.source_id, func.count(DailyTaskItem.id)).join(
            DailyTask, DailyTask.id == DailyTaskItem.daily_task_id
        ).filter(DailyTask.user_id == user_id, DailyTaskItem.item_type == "grammar",
                 DailyTaskItem.is_correct.is_(False)).group_by(DailyTaskItem.source_id).all()
        for item_id, count in rows:
            result[str(item_id)] = result.get(str(item_id), 0) + int(count)
        return result
    return {}


def _yesterday_sources(db: Session, user_id: int, task_date: date) -> set[tuple[str, str]]:
    previous = db.query(DailyTaskItem.item_type, DailyTaskItem.source_id).join(
        DailyTask, DailyTask.id == DailyTaskItem.daily_task_id
    ).filter(DailyTask.user_id == user_id, DailyTask.task_date == task_date.fromordinal(task_date.toordinal() - 1)).all()
    return {
        (("vocab-source" if item_type in {"vocab", "flashcard"} else item_type), str(source_id))
        for item_type, source_id in previous
    }


def _grammar_candidates(db: Session, user_id: int, level: str, yesterday: set[tuple[str, str]]):
    questions = db.query(GrammarQuestion).options(joinedload(GrammarQuestion.grammar_rule)).filter(
        GrammarQuestion.jlpt_level == level, GrammarQuestion.is_active.is_(True),
    ).all()
    weights = _wrong_counts(db, user_id, "grammar")
    candidates = []
    for question in questions:
        source_id = str(question.id)
        if ("grammar", source_id) in yesterday:
            continue
        public = public_question(question, question.grammar_rule)
        candidates.append({
            "item_type": "grammar", "source_id": source_id, "question_type": question.question_type,
            "payload": {key: value for key, value in public.items() if key != "id"},
            "answer_key": {"correct_answer": question.correct_answer,
                           "accepted_answers": question.accepted_answers or [],
                           "explanation": question.explanation_vi, "examples": question.examples or []},
            "weight": 1 + 3 * weights.get(source_id, 0), "unique_key": ("grammar", source_id),
        })
    return candidates


def _kanji_candidates(db: Session, user_id: int, level: str, yesterday: set[tuple[str, str]]):
    entries, _ = kanji_dictionary_service.list_entries(jlpt=level, limit=10000)
    weights = _wrong_counts(db, user_id, "kanji")
    candidates = []
    usable = [entry for entry in entries if entry.get("kanji")]
    for entry in usable:
        source_id = str(entry["kanji"])
        if ("kanji", source_id) in yesterday:
            continue
        meaning = str(entry.get("meaning") or entry.get("meaning_vi") or "").strip()
        readings = list(dict.fromkeys([*(entry.get("onyomi") or []), *(entry.get("kunyomi") or [])]))
        question_type = "kanji_reading" if readings and random.random() < 0.5 else "kanji_meaning"
        correct = random.choice(readings) if question_type == "kanji_reading" else meaning
        distractors = []
        for other in usable:
            if other.get("kanji") == entry.get("kanji"):
                continue
            if question_type == "kanji_reading":
                distractors.extend(other.get("onyomi") or [])
                distractors.extend(other.get("kunyomi") or [])
            else:
                distractors.append(str(other.get("meaning") or other.get("meaning_vi") or "").strip())
        distractors = list(dict.fromkeys(value for value in distractors if value and value != correct))
        if not correct or len(distractors) < 3:
            continue
        options = random.sample(distractors, 3) + [correct]
        random.shuffle(options)
        all_readings = "、".join(readings)
        explanation = f"{entry['kanji']} có nghĩa là {meaning}. Cách đọc: {all_readings}." if meaning else f"Cách đọc của {entry['kanji']}: {all_readings}."
        prompt = f"Chọn cách đọc đúng của {entry['kanji']}" if question_type == "kanji_reading" else f"Chọn nghĩa đúng của {entry['kanji']}"
        candidates.append({
            "item_type": "kanji", "source_id": source_id, "question_type": question_type,
            "payload": {"prompt": prompt, "kanji": entry["kanji"], "options": options, "jlpt_level": level},
            "answer_key": {"correct_answer": correct, "explanation": explanation},
            "weight": 1 + 3 * weights.get(source_id, 0), "unique_key": ("kanji", source_id),
        })
    return candidates


def _vocab_candidates(db: Session, user_id: int, level: str, yesterday: set[tuple[str, str]]):
    rows = db.query(Vocabulary).filter(Vocabulary.jlpt_level == level).all()
    weights = _wrong_counts(db, user_id, "vocab")
    meanings = list(dict.fromkeys(row.meaning.strip() for row in rows if row.meaning and row.meaning.strip()))
    candidates = []
    for row in rows:
        source_id = str(row.id)
        if ("vocab-source", source_id) in yesterday or not row.meaning:
            continue
        distractors = [meaning for meaning in meanings if meaning != row.meaning.strip()]
        if len(distractors) < 3:
            continue
        options = random.sample(distractors, 3) + [row.meaning.strip()]
        random.shuffle(options)
        candidates.append({
            "item_type": "vocab", "source_id": source_id, "question_type": "vocab_meaning",
            "payload": {"prompt": f"{row.japanese_word}（{row.reading}）có nghĩa là gì?", "word": row.japanese_word,
                        "reading": row.reading, "options": options, "jlpt_level": level},
            "answer_key": {"correct_answer": row.meaning.strip(),
                           "explanation": f"{row.japanese_word}（{row.reading}）có nghĩa là {row.meaning.strip()}."},
            "weight": 1 + 3 * weights.get(source_id, 0), "unique_key": ("vocab", source_id),
        })
    return candidates


def _flashcard_candidates(db: Session, user_id: int, level: str, yesterday: set[tuple[str, str]]):
    rows = db.query(Vocabulary).filter(Vocabulary.jlpt_level == level).all()
    weights = _wrong_counts(db, user_id, "vocab")
    candidates = []
    for row in rows:
        source_id = str(row.id)
        if ("vocab-source", source_id) in yesterday or not row.meaning:
            continue
        candidates.append({
            "item_type": "flashcard", "source_id": source_id, "question_type": "self_recall",
            "payload": {"prompt": "Bạn còn nhớ nghĩa của từ này không?", "word": row.japanese_word, "reading": row.reading,
                        "jlpt_level": level},
            "answer_key": {"correct_answer": "Đã nhớ", "explanation": f"{row.japanese_word}（{row.reading}）có nghĩa là {row.meaning.strip()}.",
                           "stats_item_type": "vocab"},
            "weight": 1 + 3 * weights.get(source_id, 0), "unique_key": ("flashcard", source_id),
        })
    return candidates


def create_daily_task(db: Session, user_id: int, task_date: date, jlpt_level: str) -> DailyTask:
    """Build and add a task to the session; the caller owns commit/rollback."""
    yesterday = _yesterday_sources(db, user_id, task_date)
    pools = {
        "grammar": _grammar_candidates(db, user_id, jlpt_level, yesterday),
        "kanji": _kanji_candidates(db, user_id, jlpt_level, yesterday),
        "vocab": _vocab_candidates(db, user_id, jlpt_level, yesterday),
        "flashcard": _flashcard_candidates(db, user_id, jlpt_level, yesterday),
    }
    # A vocabulary source appears at most once even if it could be a quiz and a card.
    for item in pools["flashcard"]:
        item["unique_key"] = ("vocab-source", item["source_id"])
    for item in pools["vocab"]:
        item["unique_key"] = ("vocab-source", item["source_id"])

    selected = select_daily_items(pools)
    if len(selected) < 5:
        raise DailyTaskError("not_enough_content", 409, "Chưa đủ nội dung để tạo nhiệm vụ hằng ngày.")

    task = DailyTask(user_id=user_id, task_date=task_date, status="in_progress", total_items=len(selected))
    db.add(task)
    db.flush()
    for position, candidate in enumerate(selected, start=1):
        db.add(DailyTaskItem(
            daily_task_id=task.id, position=position, item_type=candidate["item_type"],
            source_id=str(candidate["source_id"]), question_type=candidate["question_type"],
            payload=candidate["payload"], answer_key=candidate["answer_key"],
        ))
    db.flush()
    return task


def get_or_create_daily_task(db: Session, user_id: int, task_date: date, jlpt_level: str) -> tuple[DailyTask, bool]:
    existing = db.query(DailyTask).filter(DailyTask.user_id == user_id, DailyTask.task_date == task_date).first()
    if existing:
        return existing, False
    try:
        return create_daily_task(db, user_id, task_date, jlpt_level), True
    except IntegrityError:
        db.rollback()
        existing = db.query(DailyTask).filter(DailyTask.user_id == user_id, DailyTask.task_date == task_date).first()
        if existing:
            return existing, False
        raise


def task_reward_breakdown(db: Session, task: DailyTask) -> dict[str, int]:
    gradable_count = db.query(func.count(DailyTaskItem.id)).filter(
        DailyTaskItem.daily_task_id == task.id, DailyTaskItem.item_type != "flashcard",
    ).scalar() or 0
    return calculate_reward_breakdown(task.correct_count, gradable_count, task.streak_after)


def complete_daily_task(db: Session, task: DailyTask, user_id: int, task_date: date) -> dict[str, Any]:
    """Complete and award within the caller's transaction; never commits."""
    if task.status == "completed":
        profile = get_or_create_profile(db, user_id)
        final_transaction = db.query(PointTransaction).filter(
            PointTransaction.idempotency_key == f"streak:{task.id}"
        ).first()
        return {"points_awarded": task.points_awarded, "breakdown": task_reward_breakdown(db, task),
                "streak": task.streak_after,
                "balance": final_transaction.balance_after if final_transaction else profile.points_balance}
    answered_count = db.query(DailyTaskItem.id).filter(
        DailyTaskItem.daily_task_id == task.id, DailyTaskItem.answered_at.isnot(None),
    ).count()
    if answered_count != task.total_items:
        raise DailyTaskError("items_incomplete", 409, "Hãy trả lời hết các mục trước khi hoàn thành.")
    gradable_count = db.query(DailyTaskItem.id).filter(
        DailyTaskItem.daily_task_id == task.id, DailyTaskItem.item_type != "flashcard",
    ).count()
    profile = update_streak_on_completion(db, user_id, task_date)
    breakdown = calculate_reward_breakdown(task.correct_count, gradable_count, profile.current_streak)
    daily_points = breakdown["base_points"] + breakdown["correct_points"] + breakdown["perfect_bonus"]
    streak_points = breakdown["streak_bonus"] + breakdown["streak_milestone_bonus"]
    award_points(db, user_id, daily_points, "Hoàn thành nhiệm vụ hằng ngày", "daily_task", task.id,
                 f"daily:{task.id}")
    award_points(db, user_id, streak_points, "Thưởng streak nhiệm vụ hằng ngày", "daily_streak", task.id,
                 f"streak:{task.id}")
    task.status = "completed"
    task.points_awarded = breakdown["total_points"]
    task.streak_after = profile.current_streak
    task.completed_at = datetime.now(timezone.utc)
    db.flush()
    return {"points_awarded": task.points_awarded, "breakdown": breakdown,
            "streak": task.streak_after, "balance": profile.points_balance}


def update_study_stats(db: Session, user_id: int, item: DailyTaskItem, is_correct: bool, now: datetime | None = None) -> None:
    item_type = item.item_type
    item_id = item.source_id
    if item_type == "flashcard":
        item_type = (item.answer_key or {}).get("stats_item_type", "vocab")
    if item_type not in {"kanji", "vocab"}:
        return
    stat = db.query(StudyItemStat).filter_by(user_id=user_id, item_type=item_type, item_id=item_id).with_for_update().first()
    if stat is None:
        stat = StudyItemStat(user_id=user_id, item_type=item_type, item_id=item_id)
        db.add(stat)
    stat.attempts = (stat.attempts or 0) + 1
    stat.wrong_count = (stat.wrong_count or 0) + int(not is_correct)
    stat.last_seen_at = now or datetime.now(timezone.utc)
    if not is_correct:
        stat.last_wrong_at = now or datetime.now(timezone.utc)
