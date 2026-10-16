from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.config import settings
from ..core.database import get_db
from ..core.rewards_config import SHOP_CATALOG
from ..core.timezone import app_today
from ..models.database import PointTransaction, User, UserUnlockedItem
from ..services import rewards_service
from ..services.rewards_service import RewardsError

router = APIRouter(prefix="/rewards", tags=["rewards"])


class PurchaseRequest(BaseModel):
    item_type: str
    item_id: str
    equip: bool = True


class EquipRequest(BaseModel):
    theme_id: str | None = None
    background_id: str | None = None


class GrantRequest(BaseModel):
    amount: int = Field(gt=0)


def _error(exc: RewardsError):
    raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


def _profile_payload(db: Session, user_id: int):
    profile = rewards_service.get_or_create_profile(db, user_id)
    unlocked = db.query(UserUnlockedItem).filter(UserUnlockedItem.user_id == user_id).all()
    themes = {"classic"} | {item.item_id for item in unlocked if item.item_type == "theme"}
    backgrounds = {item.item_id for item in unlocked if item.item_type == "background"}
    db.commit()
    return profile, {"themes": sorted(themes), "backgrounds": sorted(backgrounds)}


@router.get("/me")
async def get_rewards_me(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    profile, unlocked = _profile_payload(db, current_user.id)
    return {
        "points_balance": profile.points_balance,
        "current_streak": rewards_service.display_streak(profile, app_today()),
        "longest_streak": profile.longest_streak,
        "last_completed_date": profile.last_completed_date,
        "active_theme_id": profile.active_theme_id,
        "active_background_id": profile.active_background_id,
        "unlocked": unlocked,
    }


@router.get("/transactions")
async def get_transactions(limit: int = Query(default=50, ge=1, le=200),
                           current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    rows = db.query(PointTransaction).filter(PointTransaction.user_id == current_user.id).order_by(
        PointTransaction.created_at.desc(), PointTransaction.id.desc()
    ).limit(limit).all()
    return [{"id": x.id, "amount": x.amount, "reason": x.reason, "ref_type": x.ref_type,
             "ref_id": x.ref_id, "balance_after": x.balance_after, "created_at": x.created_at} for x in rows]


@router.get("/shop")
async def get_shop(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    profile, unlocked = _profile_payload(db, current_user.id)
    output = {}
    for item_type, key in (("theme", "themes"), ("background", "backgrounds")):
        owned = set(unlocked[key])
        active = profile.active_theme_id if item_type == "theme" else profile.active_background_id
        output[key] = [
            {**item, "item_type": item_type, "owned": item["id"] in owned,
             "equipped": item["id"] == active}
            for item in SHOP_CATALOG[key]
        ]
    return output


@router.post("/shop/purchase")
async def buy_item(payload: PurchaseRequest, current_user: User = Depends(get_current_active_user),
                   db: Session = Depends(get_db)):
    try:
        result = rewards_service.purchase_item(db, current_user.id, payload.item_type, payload.item_id, payload.equip)
        db.commit()
        return {"points_balance": result["profile"].points_balance,
                "purchased": {"item_type": result["unlocked_item"].item_type,
                              "item_id": result["unlocked_item"].item_id,
                              "price_paid": result["unlocked_item"].price_paid,
                              "equipped": payload.equip}}
    except RewardsError as exc:
        db.rollback()
        _error(exc)
    except Exception:
        db.rollback()
        raise


@router.put("/equip")
async def equip_items(payload: EquipRequest, current_user: User = Depends(get_current_active_user),
                      db: Session = Depends(get_db)):
    try:
        updates = payload.model_fields_set
        profile = rewards_service.equip(
            db, current_user.id,
            theme_id=payload.theme_id if "theme_id" in updates else None,
            background_id=payload.background_id if "background_id" in updates and payload.background_id is not None else None,
        )
        if "background_id" in updates and payload.background_id is None:
            profile.active_background_id = None
        db.commit()
        return {"active_theme_id": profile.active_theme_id, "active_background_id": profile.active_background_id}
    except RewardsError as exc:
        db.rollback()
        _error(exc)


@router.post("/dev/grant")
async def grant_points(payload: GrantRequest, current_user: User = Depends(get_current_active_user),
                      db: Session = Depends(get_db)):
    if not settings.enable_dev_rewards:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        transaction = rewards_service.dev_grant(db, current_user.id, payload.amount)
        db.commit()
        return {"points_balance": transaction.balance_after, "transaction_id": transaction.id}
    except RewardsError as exc:
        db.rollback()
        _error(exc)
