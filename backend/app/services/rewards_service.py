from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from ..core.rewards_config import catalog_item
from ..models.database import PointTransaction, UserGameProfile, UserUnlockedItem


class RewardsError(Exception):
    def __init__(self, code: str, status_code: int, message: str):
        self.code = code
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def get_or_create_profile(db: Session, user_id: int, for_update: bool = False) -> UserGameProfile:
    query = db.query(UserGameProfile).filter(UserGameProfile.user_id == user_id)
    if for_update:
        query = query.with_for_update()
    profile = query.first()
    if profile:
        return profile
    profile = UserGameProfile(user_id=user_id)
    db.add(profile)
    db.flush()
    if for_update:
        profile = db.query(UserGameProfile).filter(UserGameProfile.user_id == user_id).with_for_update().one()
    return profile


def award_points(db: Session, user_id: int, amount: int, reason: str, ref_type: str,
                 ref_id, idempotency_key: str) -> PointTransaction:
    if not amount:
        raise ValueError("amount must not be zero")
    profile = get_or_create_profile(db, user_id, for_update=True)
    existing = db.query(PointTransaction).filter(PointTransaction.idempotency_key == idempotency_key).first()
    if existing:
        return existing
    new_balance = profile.points_balance + amount
    if new_balance < 0:
        raise RewardsError("insufficient_points", 400, "insufficient_points")
    profile.points_balance = new_balance
    transaction = PointTransaction(
        user_id=user_id, amount=amount, reason=reason, ref_type=ref_type,
        ref_id=str(ref_id) if ref_id is not None else None,
        idempotency_key=idempotency_key, balance_after=new_balance,
    )
    db.add(transaction)
    db.flush()
    return transaction


def _is_owned(db: Session, user_id: int, item_type: str, item_id: str) -> bool:
    return item_type == "theme" and item_id == "classic" or db.query(UserUnlockedItem.id).filter_by(
        user_id=user_id, item_type=item_type, item_id=item_id
    ).first() is not None


def purchase_item(db: Session, user_id: int, item_type: str, item_id: str, equip: bool = True):
    item = catalog_item(item_type, item_id)
    if item is None:
        raise RewardsError("item_not_found", 404, "Mục cửa hàng không tồn tại")
    profile = get_or_create_profile(db, user_id, for_update=True)
    if _is_owned(db, user_id, item_type, item_id):
        raise RewardsError("already_owned", 409, "Bạn đã sở hữu mục này")
    if profile.points_balance < item["price"]:
        raise RewardsError("insufficient_points", 400, "insufficient_points")
    tx = award_points(
        db, user_id, -item["price"], f"Mua {item['name']}", "purchase", item_id,
        f"purchase:{user_id}:{item_type}:{item_id}",
    )
    unlocked = UserUnlockedItem(user_id=user_id, item_type=item_type, item_id=item_id, price_paid=item["price"])
    db.add(unlocked)
    if equip:
        if item_type == "theme":
            profile.active_theme_id = item_id
        else:
            profile.active_background_id = item_id
    db.flush()
    return {"transaction": tx, "unlocked_item": unlocked, "profile": profile, "catalog_item": item}


def equip(db: Session, user_id: int, theme_id: str | None = None,
          background_id: str | None = None) -> UserGameProfile:
    profile = get_or_create_profile(db, user_id, for_update=True)
    if theme_id is not None:
        if catalog_item("theme", theme_id) is None:
            raise RewardsError("item_not_found", 404, "Theme không tồn tại")
        if not _is_owned(db, user_id, "theme", theme_id):
            raise RewardsError("not_owned", 409, "Bạn chưa sở hữu theme này")
        profile.active_theme_id = theme_id
    if background_id is not None:
        if catalog_item("background", background_id) is None:
            raise RewardsError("item_not_found", 404, "Hình nền không tồn tại")
        if not _is_owned(db, user_id, "background", background_id):
            raise RewardsError("not_owned", 409, "Bạn chưa sở hữu hình nền này")
        profile.active_background_id = background_id
    db.flush()
    return profile


def update_streak_on_completion(db: Session, user_id: int, completed_date: date) -> UserGameProfile:
    profile = get_or_create_profile(db, user_id, for_update=True)
    previous = profile.last_completed_date
    if previous == completed_date:
        return profile
    if previous == completed_date - timedelta(days=1):
        profile.current_streak += 1
    else:
        profile.current_streak = 1
    profile.last_completed_date = completed_date
    profile.longest_streak = max(profile.longest_streak, profile.current_streak)
    db.flush()
    return profile


def display_streak(profile: UserGameProfile, today: date) -> int:
    if profile.last_completed_date is None or profile.last_completed_date < today - timedelta(days=1):
        return 0
    return profile.current_streak


def dev_grant(db: Session, user_id: int, amount: int) -> PointTransaction:
    if amount <= 0:
        raise RewardsError("invalid_amount", 400, "amount phải lớn hơn 0")
    return award_points(db, user_id, amount, "Cộng điểm thử nghiệm", "dev_grant", None,
                        f"dev:{user_id}:{uuid4()}")
