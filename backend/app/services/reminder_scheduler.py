"""AsyncIO scheduler lifecycle; database work runs in the default executor."""
import logging

from ..core.config import settings
from .reminder_service import run_reminder_tick

logger = logging.getLogger(__name__)
_scheduler = None


def start_reminder_scheduler() -> None:
    global _scheduler
    if not settings.reminders_enabled:
        logger.info("Reminder scheduler is disabled by REMINDERS_ENABLED")
        return
    if _scheduler is not None and _scheduler.running:
        return
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
    except ImportError:
        logger.exception("APScheduler is not installed; reminder scheduler was not started")
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(run_reminder_tick, "interval", minutes=1,
                       id="senpaiai-reminder-tick", max_instances=1,
                       coalesce=True, misfire_grace_time=55)
    _scheduler.start()
    logger.info("Reminder scheduler started (one-minute interval)")


def stop_reminder_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")
    _scheduler = None
