from datetime import date, datetime
from zoneinfo import ZoneInfo

from .config import settings


def app_today() -> date:
    """Return today's calendar date in the configured application timezone."""
    return datetime.now(ZoneInfo(settings.app_timezone)).date()
