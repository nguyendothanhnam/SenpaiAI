from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo
from pydantic import ValidationError
import pytest

from app.api.reminders import ReminderSettingsUpdate
from app.services.reminder_service import (
    can_send_now,
    is_daily_task_due,
    is_quiet_time,
    is_streak_risk_due,
    make_dedupe_key,
    review_due_candidates,
    should_send_review_reminder,
    suggested_learning_time,
    validate_settings_timezone,
)


def test_daily_task_reminder_allows_missed_tick_for_fifteen_minutes():
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime(2026, 4, 6, 20, 14, tzinfo=tz)  # Monday
    assert is_daily_task_due(now, "20:00", [0, 1, 2, 3, 4, 5, 6], completed=False)
    assert not is_daily_task_due(now + timedelta(minutes=2), "20:00", list(range(7)), completed=False)
    assert not is_daily_task_due(now, "20:00", list(range(7)), completed=True)
    assert not is_daily_task_due(now, "20:00", [1, 2, 3], completed=False)


def test_streak_risk_starts_at_later_of_nineteen_or_reminder_time():
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    assert not is_streak_risk_due(datetime(2026, 4, 6, 18, 59, tzinfo=tz), "18:00", [0], 3, False)
    assert is_streak_risk_due(datetime(2026, 4, 6, 19, 0, tzinfo=tz), "18:00", [0], 3, False)
    assert not is_streak_risk_due(datetime(2026, 4, 6, 20, 0, tzinfo=tz), "20:30", [0], 3, False)
    assert not is_streak_risk_due(datetime(2026, 4, 6, 20, 0, tzinfo=tz), "18:00", [0], 1, False)


def test_quiet_hours_support_overnight_and_same_time_all_day():
    assert is_quiet_time(datetime.strptime("23:15", "%H:%M").time(), "22:00", "07:00")
    assert is_quiet_time(datetime.strptime("06:59", "%H:%M").time(), "22:00", "07:00")
    assert not is_quiet_time(datetime.strptime("07:00", "%H:%M").time(), "22:00", "07:00")
    assert is_quiet_time(datetime.strptime("12:00", "%H:%M").time(), "12:00", "12:00")


def test_common_send_rules_enforce_snooze_daily_limit_and_recent_activity():
    local_now = datetime(2026, 4, 6, 20, 0, tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
    assert can_send_now(local_now, "22:00", "07:00", None, 2, 3)
    assert not can_send_now(local_now, "22:00", "07:00", None, 3, 3)
    assert not can_send_now(local_now, "22:00", "07:00", datetime(2026, 4, 6, 14, 0, tzinfo=timezone.utc), 0, 3)
    recent = datetime(2026, 4, 6, 12, 30, tzinfo=timezone.utc)
    assert not can_send_now(local_now, "22:00", "07:00", None, 0, 3, recent)


def test_review_due_requires_two_wrong_attempts_and_three_days_without_review():
    now = datetime(2026, 4, 10, 12, tzinfo=timezone.utc)
    candidates = [
        SimpleNamespace(wrong_count=2, last_seen_at=now - timedelta(days=4), last_wrong_at=None),
        SimpleNamespace(wrong_count=1, last_seen_at=now - timedelta(days=6), last_wrong_at=None),
        SimpleNamespace(wrong_count=3, last_seen_at=now - timedelta(days=2), last_wrong_at=None),
        SimpleNamespace(wrong_count=2, last_seen_at=None, last_wrong_at=now - timedelta(days=5)),
    ]
    assert review_due_candidates(candidates, now) == [candidates[0], candidates[3]]
    assert should_send_review_reminder(candidates, now) == (False, 2)


def test_review_reminder_needs_at_least_five_due_items():
    now = datetime(2026, 4, 10, 12, tzinfo=timezone.utc)
    due = [SimpleNamespace(wrong_count=2, last_seen_at=now - timedelta(days=4), last_wrong_at=None)
           for _ in range(5)]
    assert should_send_review_reminder(due[:4], now) == (False, 4)
    assert should_send_review_reminder(due, now) == (True, 5)


def test_suggested_time_uses_local_hour_and_requires_five_recent_samples():
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    local_times = [datetime(2026, 4, day, 21, minute, tzinfo=tz).astimezone(timezone.utc)
                   for day, minute in ((1, 0), (2, 10), (3, 20), (4, 30), (5, 40))]
    assert suggested_learning_time(local_times[:4], "Asia/Ho_Chi_Minh", datetime(2026, 4, 10, tzinfo=timezone.utc)) is None
    suggestion = suggested_learning_time(local_times, "Asia/Ho_Chi_Minh", datetime(2026, 4, 10, tzinfo=timezone.utc))
    assert suggestion == {"time": "21:00", "sample_count": 5, "hour_count": 5}


def test_suggested_time_ignores_activity_older_than_thirty_days():
    now = datetime(2026, 4, 10, tzinfo=timezone.utc)
    old = [now - timedelta(days=31 - index) for index in range(5)]
    assert suggested_learning_time(old, "UTC", now) is None


def test_dedupe_key_scopes_type_user_and_local_calendar_day():
    day = date(2026, 4, 10)
    assert make_dedupe_key("daily_task", 41, day) == "daily_task:41:2026-04-10"
    assert make_dedupe_key("daily_task", 42, day) != make_dedupe_key("daily_task", 41, day)
    assert make_dedupe_key("streak_risk", 41, day) != make_dedupe_key("daily_task", 41, day)


def test_settings_validate_clock_day_timezone_and_snooze_values():
    assert ReminderSettingsUpdate(reminder_time="21:15", days_of_week=[0, 2], timezone="Asia/Tokyo")
    for payload in ({"reminder_time": "25:00"}, {"days_of_week": [0, 0]},
                    {"days_of_week": [7]}, {"types": ["unknown"]},
                    {"snooze_until": "2026-04-10T10:00:00"}):
        with pytest.raises(ValidationError):
            ReminderSettingsUpdate(**payload)
    with pytest.raises(ValueError):
        validate_settings_timezone("Invalid/Timezone")
