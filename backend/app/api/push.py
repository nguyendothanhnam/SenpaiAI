import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.database import get_db
from ..models.database import PushSubscription, User
from ..services.reminder_service import send_test_push_sync

router = APIRouter(prefix="/push", tags=["web push"])


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=500)
    auth: str = Field(min_length=1, max_length=500)


class SubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10, max_length=4000)
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10, max_length=4000)


@router.get("/vapid-public-key")
def vapid_public_key():
    return {"enabled": bool(settings.vapid_public_key and settings.vapid_private_key),
            "public_key": settings.vapid_public_key or None}


@router.post("/subscribe")
def subscribe(payload: SubscribeRequest, request: Request, current_user: User = Depends(get_current_active_user),
              db: Session = Depends(get_db)):
    if not settings.vapid_public_key or not settings.vapid_private_key:
        raise HTTPException(status_code=503, detail="Web Push chưa được cấu hình trên máy chủ")
    if not payload.endpoint.startswith("https://"):
        raise HTTPException(status_code=422, detail="Push endpoint phải dùng HTTPS")
    row = db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    if row and row.user_id != current_user.id:
        raise HTTPException(status_code=409, detail="Subscription này đã được liên kết với tài khoản khác")
    if row is None:
        row = PushSubscription(user_id=current_user.id, endpoint=payload.endpoint,
                               p256dh=payload.keys.p256dh, auth=payload.keys.auth,
                               user_agent=request.headers.get("user-agent"))
        db.add(row)
    else:
        row.p256dh = payload.keys.p256dh
        row.auth = payload.keys.auth
        row.user_agent = request.headers.get("user-agent")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subscription đã được đăng ký")
    return {"subscribed": True}


@router.delete("/subscribe")
def unsubscribe(payload: UnsubscribeRequest, current_user: User = Depends(get_current_active_user),
                db: Session = Depends(get_db)):
    deleted = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id,
                                                PushSubscription.endpoint == payload.endpoint).delete(synchronize_session=False)
    db.commit()
    return {"unsubscribed": bool(deleted)}


@router.post("/test")
async def test_push(current_user: User = Depends(get_current_active_user)):
    if not settings.vapid_public_key or not settings.vapid_private_key:
        raise HTTPException(status_code=503, detail="Web Push chưa được cấu hình trên máy chủ")
    result = await asyncio.to_thread(send_test_push_sync, current_user.id)
    return {"message": "Đã gửi thông báo thử", **result}
