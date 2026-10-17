"""Reminder eligibility, notification persistence, Web Push and study-time suggestions."""
import json
import logging
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.config import settings as app_settings
from ..core.database import SessionLocal
from ..models.database import (
    DailyTask, DailyTaskItem, GrammarPracticeAttempt, LearningSession, Notification,
    PushSubscription, ReminderSettings, StudyItemStat, User, UserGameProfile,
)

logger = logging.getLogger(__name__)
REMINDER_TYPES = {"daily_task", "streak_risk", "review_due"}
HHMM_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def parse_time(value: str) -> time:
    if not isinstance(value, str) or not HHMM_RE.fullmatch(value):
        raise ValueError("Giờ phải có định dạng HH:MM")
    hour, minute = map(int, value.split(":"))
    return time(hour, minute)


def is_quiet_time(local_time: time, quiet_start: str, quiet_end: str) -> bool:
    start, end = parse_time(quiet_start), parse_time(quiet_end)
    current = local_time.replace(tzinfo=None)
    if start == end:
        return True
    if start < end:
        return start <= current < end
    return current >= start or current < end


def is_daily_task_due(local_now: datetime, reminder_time: str, days_of_week: list[int], completed: bool) -> bool:
    if completed or local_now.weekday() not in days_of_week:
        return False
    target = datetime.combine(local_now.date(), parse_time(reminder_time), tzinfo=local_now.tzinfo)
    delta = local_now - target
    return timedelta(0) <= delta <= timedelta(minutes=15)


def is_streak_risk_due(local_now: datetime, reminder_time: str, days_of_week: list[int],
                       streak: int, completed: bool) -> bool:
    if completed or streak < 2 or local_now.weekday() not in days_of_week:
        return False
    threshold = max(time(19, 0), parse_time(reminder_time))
    return local_now.time().replace(tzinfo=None) >= threshold


def review_due_candidates(stats: Iterable[Any], now_utc: datetime) -> list[Any]:
    cutoff = now_utc - timedelta(days=3)
    result = []
    for stat in stats:
        last_seen = stat.last_seen_at or stat.last_wrong_at
        if stat.wrong_count >= 2 and last_seen is not None:
            if _as_utc(last_seen) < cutoff:
                result.append(stat)
    return result


def should_send_review_reminder(stats: Iterable[Any], now_utc: datetime) -> tuple[bool, int]:
    due_count = len(review_due_candidates(stats, now_utc))
    return due_count >= 5, due_count


def can_send_now(local_now: datetime, quiet_start: str, quiet_end: str,
                 snooze_until: datetime | None, notifications_today: int, max_per_day: int,
                 last_activity_utc: datetime | None = None) -> bool:
    if is_quiet_time(local_now.timetz(), quiet_start, quiet_end):
        return False
    now_utc = local_now.astimezone(timezone.utc)
    if snooze_until and _as_utc(snooze_until) > now_utc:
        return False
    if notifications_today >= max_per_day:
        return False
    if last_activity_utc and now_utc - _as_utc(last_activity_utc) < timedelta(hours=2):
        return False
    return True


def make_dedupe_key(notification_type: str, user_id: int, local_date: date) -> str:
    return f"{notification_type}:{user_id}:{local_date.isoformat()}"


def suggested_learning_time(timestamps: Iterable[datetime], timezone_name: str,
                            now_utc: datetime | None = None) -> dict[str, Any] | None:
    tz = ZoneInfo(timezone_name)
    now = _as_utc(now_utc or datetime.now(timezone.utc))
    cutoff = now - timedelta(days=30)
    hours: dict[int, int] = {}
    count = 0
    for stamp in timestamps:
        if stamp is None:
            continue
        stamp_utc = _as_utc(stamp)
        if cutoff <= stamp_utc <= now:
            local_hour = stamp_utc.astimezone(tz).hour
            hours[local_hour] = hours.get(local_hour, 0) + 1
            count += 1
    if count < 5:
        return None
    hour = max(range(24), key=lambda value: (hours.get(value, 0), -value))
    return {"time": f"{hour:02d}:00", "sample_count": count, "hour_count": hours[hour]}


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def default_settings(user_id: int) -> ReminderSettings:
    return ReminderSettings(user_id=user_id)


def get_or_create_settings(db: Session, user_id: int) -> ReminderSettings:
    row = db.query(ReminderSettings).filter(ReminderSettings.user_id == user_id).first()
    if row:
        return row
    row = default_settings(user_id)
    db.add(row)
    try:
        db.flush()
        return row
    except IntegrityError:
        db.rollback()
        row = db.query(ReminderSettings).filter(ReminderSettings.user_id == user_id).first()
        if row is None:
            raise
        return row


def validate_settings_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, TypeError, ValueError) as exc:
        raise ValueError("Múi giờ không hợp lệ") from exc


def _latest_activity(db: Session, user_id: int) -> datetime | None:
    values = [
        db.query(func.max(DailyTaskItem.answered_at)).join(
            DailyTask, DailyTask.id == DailyTaskItem.daily_task_id
        ).filter(DailyTask.user_id == user_id).scalar(),
        db.query(func.max(GrammarPracticeAttempt.created_at)).filter(
            GrammarPracticeAttempt.user_id == user_id
        ).scalar(),
        db.query(func.max(func.coalesce(LearningSession.completed_at, LearningSession.created_at))).filter(
            LearningSession.user_id == user_id
        ).scalar(),
    ]
    values = [value for value in values if value is not None]
    return max(values, key=_as_utc) if values else None


def _recent_notification_count(db: Session, user_id: int, local_now: datetime) -> int:
    start_local = datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo)
    end_local = start_local + timedelta(days=1)
    return db.query(Notification.id).filter(
        Notification.user_id == user_id,
        Notification.type.in_(tuple(REMINDER_TYPES)),
        Notification.created_at >= start_local.astimezone(timezone.utc),
        Notification.created_at < end_local.astimezone(timezone.utc),
    ).count()


def get_review_due_items(db: Session, user_id: int, now_utc: datetime) -> list[StudyItemStat]:
    """Heuristic provider boundary; replace this function when an SRS provider is available."""
    return review_due_candidates(db.query(StudyItemStat).filter(
        StudyItemStat.user_id == user_id,
        StudyItemStat.item_type.in_(("kanji", "vocab")),
        StudyItemStat.wrong_count >= 2,
    ).all(), now_utc)


def _candidate_notifications(db: Session, user: User, preferences: ReminderSettings,
                             local_now: datetime, tz: ZoneInfo) -> list[dict[str, Any]]:
    today = local_now.date()
    completed_today = db.query(DailyTask.id).filter(
        DailyTask.user_id == user.id, DailyTask.task_date == today, DailyTask.status == "completed"
    ).first() is not None
    candidates = []
    selected_days = preferences.days_of_week or []
    if "daily_task" in (preferences.types or []) and is_daily_task_due(
        local_now, preferences.reminder_time, selected_days, completed_today
    ):
        candidates.append({
            "type": "daily_task", "title": "Nhiệm vụ hôm nay đang chờ bạn",
            "body": "Dành vài phút ôn tiếng Nhật nhé. Tiến độ sẽ được lưu khi bạn trả lời.",
            "url": "/daily", "data": {"date": today.isoformat()},
        })

    profile = db.query(UserGameProfile).filter(UserGameProfile.user_id == user.id).first()
    streak = profile.current_streak if profile else 0
    if "streak_risk" in (preferences.types or []) and is_streak_risk_due(
        local_now, preferences.reminder_time, selected_days, streak, completed_today
    ):
        candidates.append({
            "type": "streak_risk", "title": "Giữ chuỗi học tập nhé!",
            "body": f"Bạn đang có chuỗi {streak} ngày. Hoàn thành nhiệm vụ hôm nay để tiếp tục.",
            "url": "/daily", "data": {"date": today.isoformat(), "streak": streak},
        })

    if "review_due" in (preferences.types or []):
        review_items = get_review_due_items(db, user.id, local_now.astimezone(timezone.utc))
        should_remind, review_count = should_send_review_reminder(review_items, local_now.astimezone(timezone.utc))
        if should_remind:
            candidates.append({
                "type": "review_due", "title": "Đến lúc ôn lại một chút rồi",
                "body": f"Có {review_count} từ và kanji bạn từng nhầm đang chờ được ôn lại.",
                "url": "/daily", "data": {"review_count": review_count},
            })
    return candidates


def _insert_notification(db: Session, user_id: int, candidate: dict[str, Any], dedupe_key: str) -> Notification | None:
    notification = Notification(user_id=user_id, dedupe_key=dedupe_key, **candidate)
    db.add(notification)
    try:
        db.commit()
        db.refresh(notification)
        return notification
    except IntegrityError:
        db.rollback()
        return None


def _push_configured() -> bool:
    return bool(app_settings.vapid_public_key and app_settings.vapid_private_key)


def send_push_for_notification(db: Session, notification: Notification) -> int:
    if not _push_configured():
        return 0
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush is not installed; in-app reminders remain enabled")
        return 0
    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == notification.user_id).all()
    if not subscriptions:
        return 0
    payload = json.dumps({"title": notification.title, "body": notification.body,
                          "url": notification.url, "data": notification.data or {}})
    successes = 0
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": subscription.endpoint,
                                   "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                data=payload,
                vapid_private_key=app_settings.vapid_private_key,
                vapid_claims={"sub": app_settings.vapid_subject},
            )
            subscription.last_success_at = datetime.now(timezone.utc)
            subscription.failed_count = 0
            successes += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                db.delete(subscription)
            else:
                subscription.failed_count += 1
            logger.info("Push delivery failed (status=%s)", status_code)
        except Exception:
            subscription.failed_count += 1
            logger.exception("Push delivery failed")
    if successes:
        notification.push_sent_at = datetime.now(timezone.utc)
    db.commit()
    return successes


def create_user_notification(db: Session, user_id: int, notification_type: str,
                             title: str, body: str, url: str, data: dict[str, Any] | None = None,
                             dedupe_key: str | None = None) -> Notification | None:
    key = dedupe_key or f"{notification_type}:{user_id}:manual:{datetime.now(timezone.utc).timestamp()}"
    return _insert_notification(db, user_id, {
        "type": notification_type, "title": title, "body": body, "url": url, "data": data or {},
    }, key)


def send_test_push_sync(user_id: int) -> dict[str, int]:
    db = SessionLocal()
    try:
        subscriptions_count = db.query(PushSubscription.id).filter(PushSubscription.user_id == user_id).count()
        notification = create_user_notification(
            db, user_id, "push_test", "Thông báo thử SenpaiAI",
            "Web Push đã được kết nối. Chúc bạn học vui!", "/settings/reminders",
        )
        if notification is None:
            return {"sent": 0, "subscriptions": subscriptions_count}
        sent = send_push_for_notification(db, notification)
        return {"sent": sent, "subscriptions": subscriptions_count}
    finally:
        db.close()


def _run_reminder_tick_sync(now_utc: datetime | None = None) -> int:
    now_utc = _as_utc(now_utc or datetime.now(timezone.utc))
    db = SessionLocal()
    created_count = 0
    try:
        users = db.query(User).filter(User.is_active.is_(True)).all()
        for user in users:
            preferences = get_or_create_settings(db, user.id)
            if not preferences.enabled:
                continue
            try:
                tz = validate_settings_timezone(preferences.timezone)
                local_now = now_utc.astimezone(tz)
            except ValueError:
                logger.warning("Skipping reminders for user %s with invalid timezone", user.id)
                continue
            recent_count = _recent_notification_count(db, user.id, local_now)
            activity = _latest_activity(db, user.id)
            if not can_send_now(local_now, preferences.quiet_start, preferences.quiet_end,
                                preferences.snooze_until, recent_count, preferences.max_per_day, activity):
                continue
            for candidate in _candidate_notifications(db, user, preferences, local_now, tz):
                if recent_count >= preferences.max_per_day:
                    break
                key = make_dedupe_key(candidate["type"], user.id, local_now.date())
                notification = _insert_notification(db, user.id, candidate, key)
                if notification is None:
                    continue
                created_count += 1
                recent_count += 1
                if preferences.push_enabled:
                    send_push_for_notification(db, notification)
        db.commit()
        return created_count
    except Exception:
        db.rollback()
        logger.exception("Reminder scheduler tick failed")
        return created_count
    finally:
        db.close()


async def run_reminder_tick() -> int:
    """Run all synchronous database and push work in the default thread executor."""
    import asyncio
    return await asyncio.to_thread(_run_reminder_tick_sync)


def get_suggested_time(db: Session, user_id: int, timezone_name: str) -> dict[str, Any] | None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    timestamps = []
    timestamps.extend(value for (value,) in db.query(DailyTaskItem.answered_at).join(
        DailyTask, DailyTask.id == DailyTaskItem.daily_task_id
    ).filter(DailyTask.user_id == user_id, DailyTaskItem.answered_at >= cutoff).all())
    timestamps.extend(value for (value,) in db.query(GrammarPracticeAttempt.created_at).filter(
        GrammarPracticeAttempt.user_id == user_id, GrammarPracticeAttempt.created_at >= cutoff
    ).all())
    timestamps.extend(value for (value,) in db.query(func.coalesce(
        LearningSession.completed_at, LearningSession.created_at
    )).filter(LearningSession.user_id == user_id,
              func.coalesce(LearningSession.completed_at, LearningSession.created_at) >= cutoff).all())
    return suggested_learning_time(timestamps, timezone_name)
