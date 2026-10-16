import random
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.database import (
    DailyTask,
    DailyTaskItem,
    PointTransaction,
    StudyItemStat,
    User,
    UserGameProfile,
)
from app.services.daily_task_service import (
    calculate_reward_breakdown,
    complete_daily_task,
    get_or_create_daily_task,
    grade_daily_answer,
    update_study_stats,
    weighted_sample,
)
from app.services.rewards_service import update_streak_on_completion


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    tables = [
        User.__table__, UserGameProfile.__table__, PointTransaction.__table__, DailyTask.__table__,
        DailyTaskItem.__table__, StudyItemStat.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine, autoflush=False)()
    user = User(email="daily@example.test", username="daily", hashed_password="test")
    session.add(user)
    session.commit()
    yield session, user.id
    session.close()
    Base.metadata.drop_all(engine, tables=tables)
    engine.dispose()


def test_weighted_sample_prefers_often_wrong_items():
    weak = {"id": "weak", "weight": 10}
    normal = {"id": "normal", "weight": 1}
    rng = random.Random(17)
    chosen_weak = sum(weighted_sample([weak, normal], 1, rng)[0]["id"] == "weak" for _ in range(100))
    assert chosen_weak > 75


@pytest.mark.parametrize(
    "item_type,question_type,answer,key,expected",
    [
        ("grammar", "fill_blank", "は", {"correct_answer": "は"}, True),
        ("grammar", "reorder", ["私", "は", "学生"], {"correct_answer": "私は学生"}, True),
        ("grammar", "true_false", True, {"correct_answer": True}, True),
        ("grammar", "conjugation", "ガクセイ", {"correct_answer": "がくせい"}, True),
        ("kanji", "kanji_meaning", "ngày", {"correct_answer": "ngày"}, True),
        ("vocab", "vocab_meaning", "giáo viên", {"correct_answer": "giáo viên"}, True),
        ("flashcard", "self_recall", "Đã nhớ", {"correct_answer": "Đã nhớ"}, True),
        ("flashcard", "self_recall", "Chưa nhớ", {"correct_answer": "Đã nhớ"}, False),
    ],
)
def test_grades_daily_question_types(item_type, question_type, answer, key, expected):
    assert grade_daily_answer(item_type, question_type, answer, key) is expected


def test_reward_breakdown_includes_perfect_streak_and_milestone():
    result = calculate_reward_breakdown(correct_count=6, gradable_count=6, streak=7)
    assert result == {
        "base_points": 20,
        "correct_points": 12,
        "perfect_bonus": 10,
        "streak_bonus": 14,
        "streak_milestone_bonus": 50,
        "total_points": 106,
    }
    assert calculate_reward_breakdown(2, 3, 1)["perfect_bonus"] == 0


def test_streak_transition_for_consecutive_completion(db):
    session, user_id = db
    profile = update_streak_on_completion(session, user_id, date(2026, 5, 1))
    assert profile.current_streak == 1
    profile = update_streak_on_completion(session, user_id, date(2026, 5, 2))
    assert profile.current_streak == 2
    profile = update_streak_on_completion(session, user_id, date(2026, 5, 2))
    assert profile.current_streak == 2
    profile = update_streak_on_completion(session, user_id, date(2026, 5, 4))
    assert profile.current_streak == 1
    assert profile.longest_streak == 2


def test_completing_same_task_twice_does_not_award_twice(db):
    session, user_id = db
    task = DailyTask(user_id=user_id, task_date=date(2026, 6, 3), status="in_progress", total_items=2, correct_count=1)
    session.add(task)
    session.flush()
    answered_at = datetime.now(timezone.utc)
    session.add_all([
        DailyTaskItem(daily_task_id=task.id, position=1, item_type="grammar", source_id="1",
                      question_type="fill_blank", payload={}, answer_key={}, user_answer="x",
                      is_correct=True, answered_at=answered_at),
        DailyTaskItem(daily_task_id=task.id, position=2, item_type="flashcard", source_id="2",
                      question_type="self_recall", payload={}, answer_key={}, user_answer="Chưa nhớ",
                      is_correct=False, answered_at=answered_at),
    ])
    session.flush()

    first = complete_daily_task(session, task, user_id, date(2026, 6, 3))
    balance_after_first = first["balance"]
    second = complete_daily_task(session, task, user_id, date(2026, 6, 3))
    assert task.status == "completed"
    assert second == first
    assert second["balance"] == balance_after_first
    assert session.query(PointTransaction).filter(PointTransaction.user_id == user_id).count() == 2


def test_get_or_create_returns_existing_task_for_same_date(db):
    session, user_id = db
    task = DailyTask(user_id=user_id, task_date=date(2026, 7, 4), status="in_progress", total_items=5)
    session.add(task)
    session.commit()
    found, created = get_or_create_daily_task(session, user_id, date(2026, 7, 4), "N5")
    assert found.id == task.id
    assert created is False
    assert session.query(DailyTask).filter_by(user_id=user_id, task_date=date(2026, 7, 4)).count() == 1


def test_unremembered_flashcard_updates_vocab_wrong_stats(db):
    session, user_id = db
    item = DailyTaskItem(
        item_type="flashcard", source_id="vocab-7", answer_key={"stats_item_type": "vocab"},
    )
    update_study_stats(session, user_id, item, is_correct=False)
    session.flush()
    stat = session.query(StudyItemStat).filter_by(user_id=user_id, item_type="vocab", item_id="vocab-7").one()
    assert stat.attempts == 1
    assert stat.wrong_count == 1
    assert stat.last_wrong_at is not None
