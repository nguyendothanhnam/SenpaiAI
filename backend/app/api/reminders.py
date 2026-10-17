from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import ReminderSettings, User
from ..services.reminder_service import get_or_create_settings, get_suggested_time

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderSettingsUpdate(BaseModel):
    enabled: bool | None = None
    timezone: str | None = None
    reminder_time: str | None = None
    days_of_week: list[int] | None = None
    types: list[Literal["daily_task", "streak_risk", "review_due"]] | None = None
    quiet_start: str | None = None
    quiet_end: str | None = None
    push_enabled: bool | None = None
    max_per_day: int | None = Field(default=None, ge=1, le=20)
    snooze_until: datetime | None = None

    @field_validator("reminder_time", "quiet_start", "quiet_end")
    @classmethod
    def validate_hhmm(cls, value):
        if value is not None:
            from ..services.reminder_service import parse_time
            parse_time(value)
        return value

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, value):
        if value is not None and (len(value) != len(set(value)) or any(day < 0 or day > 6 for day in value)):
            raise ValueError("days_of_week phải là danh sách ngày không trùng, từ 0 đến 6")
        return value

    @field_validator("snooze_until")
    @classmethod
    def validate_snooze_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("snooze_until phải có múi giờ hoặc offset")
        return value


def _as_response(row: ReminderSettings) -> dict:
    return {
        "enabled": row.enabled,
        "timezone": row.timezone,
        "reminder_time": row.reminder_time,
        "days_of_week": row.days_of_week or [],
        "types": row.types or [],
        "quiet_start": row.quiet_start,
        "quiet_end": row.quiet_end,
        "push_enabled": row.push_enabled,
        "max_per_day": row.max_per_day,
        "snooze_until": row.snooze_until.isoformat() if row.snooze_until else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _validate_timezone(value: str) -> None:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Múi giờ không hợp lệ")


@router.get("/settings")
def read_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = get_or_create_settings(db, current_user.id)
    db.commit()
    db.refresh(row)
    return _as_response(row)


@router.put("/settings")
def update_settings(payload: ReminderSettingsUpdate, current_user: User = Depends(get_current_active_user),
                    db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    nullable_fields = {"snooze_until"}
    null_values = [key for key, value in data.items() if value is None and key not in nullable_fields]
    if null_values:
        raise HTTPException(status_code=422, detail=f"Các trường này không được null: {', '.join(null_values)}")
    if "timezone" in data:
        _validate_timezone(data["timezone"])
    row = get_or_create_settings(db, current_user.id)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _as_response(row)


@router.get("/suggested-time")
def suggested_time(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = db.query(ReminderSettings).filter(ReminderSettings.user_id == current_user.id).first()
    tz_name = row.timezone if row else "Asia/Ho_Chi_Minh"
    _validate_timezone(tz_name)
    result = get_suggested_time(db, current_user.id, tz_name)
    return {"suggested_time": result["time"] if result else None,
            "sample_count": result["sample_count"] if result else 0,
            "hour_count": result["hour_count"] if result else 0,
            "timezone": tz_name}
