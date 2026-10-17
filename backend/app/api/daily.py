from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..core.timezone import app_today
from ..models.database import DailyTask, DailyTaskItem, User
from ..services.daily_task_service import (
    DailyTaskError,
    complete_daily_task,
    get_or_create_daily_task,
    grade_daily_answer,
    task_reward_breakdown,
    update_study_stats,
)

router = APIRouter(prefix="/daily", tags=["daily tasks"])


class AnswerRequest(BaseModel):
    answer: Any
    time_spent_ms: int = Field(default=0, ge=0, le=3600000)


def _raise_daily_error(exc: DailyTaskError):
    raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


def _read_task(db: Session, task: DailyTask) -> dict[str, Any]:
    items = db.query(DailyTaskItem).filter(DailyTaskItem.daily_task_id == task.id).order_by(DailyTaskItem.position).all()
    answered = sum(item.answered_at is not None for item in items)
    result_items = []
    for item in items:
        record = {
            "id": item.id,
            "position": item.position,
            "item_type": item.item_type,
            "question_type": item.question_type,
            "payload": item.payload,
            "answered": item.answered_at is not None,
        }
        if item.answered_at is not None:
            key = item.answer_key or {}
            record.update({
                "user_answer": item.user_answer,
                "is_correct": item.is_correct,
                "correct_answer": None if item.item_type == "flashcard" else key.get("correct_answer"),
                "explanation": key.get("explanation", ""),
                "examples": key.get("examples", []),
            })
        result_items.append(record)
    response = {
        "task_id": task.id,
        "date": task.task_date.isoformat(),
        "status": task.status,
        "items": result_items,
        "progress": {
            "total_items": task.total_items,
            "answered_items": answered,
            "correct_count": task.correct_count,
            "all_answered": answered == task.total_items,
        },
    }
    if task.status == "completed":
        response["reward"] = {
            "points_awarded": task.points_awarded,
            "breakdown": task_reward_breakdown(db, task),
            "streak": task.streak_after,
        }
    return response


@router.get("/today")
def get_today(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    today = app_today()
    task = db.query(DailyTask).filter(DailyTask.user_id == current_user.id, DailyTask.task_date == today).first()
    if task is None:
        try:
            task, created = get_or_create_daily_task(db, current_user.id, today, current_user.current_jlpt_level or "N5")
            if created:
                db.commit()
                db.refresh(task)
        except DailyTaskError as exc:
            db.rollback()
            _raise_daily_error(exc)
        except IntegrityError:
            db.rollback()
            task = db.query(DailyTask).filter(DailyTask.user_id == current_user.id, DailyTask.task_date == today).first()
            if task is None:
                raise HTTPException(status_code=409, detail={"code": "task_creation_conflict", "message": "Không thể tạo nhiệm vụ, vui lòng thử lại."})
    return _read_task(db, task)


@router.post("/items/{item_id}/answer")
def answer_item(item_id: int, payload: AnswerRequest, current_user: User = Depends(get_current_active_user),
                db: Session = Depends(get_db)):
    joined = db.query(DailyTaskItem, DailyTask).join(DailyTask, DailyTask.id == DailyTaskItem.daily_task_id).filter(
        DailyTaskItem.id == item_id, DailyTask.user_id == current_user.id,
    ).first()
    if joined is None:
        raise HTTPException(status_code=404, detail={"code": "daily_task_not_found", "message": "Nhiệm vụ không tồn tại"})
    item, task_snapshot = joined
    task = db.query(DailyTask).filter(DailyTask.id == task_snapshot.id, DailyTask.user_id == current_user.id).with_for_update().first()
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "daily_task_not_found", "message": "Nhiệm vụ không tồn tại"})
    if task.task_date != app_today():
        raise HTTPException(status_code=409, detail={"code": "task_expired", "message": "Nhiệm vụ này đã hết hạn."})
    if task.status != "in_progress":
        raise HTTPException(status_code=409, detail={"code": "task_completed", "message": "Nhiệm vụ đã hoàn thành"})
    item = db.query(DailyTaskItem).filter(DailyTaskItem.id == item_id, DailyTaskItem.daily_task_id == task.id).with_for_update().first()
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "daily_item_not_found", "message": "Mục nhiệm vụ không tồn tại"})
    if item.answered_at is not None:
        raise HTTPException(status_code=409, detail={"code": "item_already_answered", "message": "Bạn đã trả lời mục này rồi"})

    is_correct = grade_daily_answer(item.item_type, item.question_type, payload.answer, item.answer_key or {})
    now = datetime.now(timezone.utc)
    item.user_answer = payload.answer
    item.is_correct = is_correct
    item.time_spent_ms = payload.time_spent_ms
    item.answered_at = now
    if item.item_type != "flashcard" and is_correct:
        task.correct_count = (task.correct_count or 0) + 1
    update_study_stats(db, current_user.id, item, is_correct, now)
    db.flush()
    unanswered = db.query(DailyTaskItem.id).filter(
        DailyTaskItem.daily_task_id == task.id, DailyTaskItem.answered_at.is_(None),
    ).count()
    key = item.answer_key or {}
    response = {
        "is_correct": is_correct,
        "correct_answer": None if item.item_type == "flashcard" else key.get("correct_answer"),
        "explanation": key.get("explanation", ""),
        "all_answered": unanswered == 0,
    }
    if key.get("examples"):
        response["examples"] = key["examples"]
    db.commit()
    return response


@router.post("/complete")
def complete_today(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    today = app_today()
    task = db.query(DailyTask).filter(DailyTask.user_id == current_user.id, DailyTask.task_date == today).with_for_update().first()
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "daily_task_not_found", "message": "Chưa có nhiệm vụ hôm nay"})
    if task.task_date != today:
        raise HTTPException(status_code=409, detail={"code": "task_expired", "message": "Nhiệm vụ này đã hết hạn."})
    try:
        result = complete_daily_task(db, task, current_user.id, today)
        db.commit()
        return result
    except DailyTaskError as exc:
        db.rollback()
        _raise_daily_error(exc)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.get("/history")
def get_history(days: int = Query(default=30, ge=1, le=365), current_user: User = Depends(get_current_active_user),
                db: Session = Depends(get_db)):
    today = app_today()
    since = today - timedelta(days=days - 1)
    rows = db.query(DailyTask).filter(
        DailyTask.user_id == current_user.id,
        DailyTask.task_date >= since,
        DailyTask.task_date <= today,
        DailyTask.status == "completed",
    ).order_by(DailyTask.task_date.desc()).all()
    return [{"date": row.task_date.isoformat(), "points_awarded": row.points_awarded,
             "streak": row.streak_after, "correct_count": row.correct_count,
             "total_items": row.total_items} for row in rows]
