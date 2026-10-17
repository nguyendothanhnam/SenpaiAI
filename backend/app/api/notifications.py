from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(row: Notification) -> dict:
    return {"id": row.id, "type": row.type, "title": row.title, "body": row.body,
            "url": row.url, "data": row.data or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "read_at": row.read_at.isoformat() if row.read_at else None}


@router.get("")
@router.get("/")
def list_notifications(limit: int = Query(default=20, ge=1, le=100), unread_only: bool = False,
                       current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    rows = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()
    return [_serialize(row) for row in rows]


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    count = db.query(Notification.id).filter(Notification.user_id == current_user.id,
                                             Notification.read_at.is_(None)).count()
    return {"unread_count": count}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, current_user: User = Depends(get_current_active_user),
              db: Session = Depends(get_db)):
    row = db.query(Notification).filter(Notification.id == notification_id,
                                        Notification.user_id == current_user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Thông báo không tồn tại")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
    return _serialize(row)


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    changed = db.query(Notification).filter(Notification.user_id == current_user.id,
                                             Notification.read_at.is_(None)).update(
        {Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return {"updated": changed}


@router.delete("/{notification_id}", status_code=204)
def delete_notification(notification_id: int, current_user: User = Depends(get_current_active_user),
                        db: Session = Depends(get_db)):
    row = db.query(Notification).filter(Notification.id == notification_id,
                                        Notification.user_id == current_user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Thông báo không tồn tại")
    db.delete(row)
    db.commit()
    return None
