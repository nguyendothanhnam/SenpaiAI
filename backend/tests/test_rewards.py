from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.database import User, UserGameProfile
from app.services.rewards_service import (
    RewardsError,
    award_points,
    display_streak,
    equip,
    get_or_create_profile,
    purchase_item,
    update_streak_on_completion,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    tables = [User.__table__, UserGameProfile.__table__]
    from app.models.database import PointTransaction, UserUnlockedItem
    tables.extend([PointTransaction.__table__, UserUnlockedItem.__table__])
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine, autoflush=False)()
    user = User(email="rewards@example.test", username="rewards", hashed_password="test")
    session.add(user)
    session.commit()
    yield session, user.id
    session.close()
    Base.metadata.drop_all(engine, tables=tables)
    engine.dispose()


def test_streak_consecutive_gap_and_same_day(db):
    session, user_id = db
    profile = update_streak_on_completion(session, user_id, date(2026, 1, 1))
    assert profile.current_streak == 1
    profile = update_streak_on_completion(session, user_id, date(2026, 1, 2))
    assert profile.current_streak == 2
    profile = update_streak_on_completion(session, user_id, date(2026, 1, 2))
    assert profile.current_streak == 2
    profile = update_streak_on_completion(session, user_id, date(2026, 1, 4))
    assert profile.current_streak == 1
    assert profile.longest_streak == 2


def test_display_streak_expires_after_yesterday(db):
    session, user_id = db
    profile = UserGameProfile(user_id=user_id, current_streak=5, longest_streak=5,
                              last_completed_date=date(2026, 2, 9))
    session.add(profile)
    session.flush()
    assert display_streak(profile, date(2026, 2, 10)) == 5
    assert display_streak(profile, date(2026, 2, 11)) == 0
    assert display_streak(profile, date(2026, 2, 12)) == 0


def test_award_points_is_idempotent(db):
    session, user_id = db
    first = award_points(session, user_id, 20, "test", "test", "1", "same-key")
    again = award_points(session, user_id, 20, "test", "test", "1", "same-key")
    assert first.id == again.id
    assert get_or_create_profile(session, user_id).points_balance == 20
    assert session.query(type(first)).filter_by(user_id=user_id).count() == 1


def test_purchase_insufficient_owned_and_unknown(db):
    session, user_id = db
    with pytest.raises(RewardsError) as error:
        purchase_item(session, user_id, "theme", "sakura")
    assert error.value.code == "insufficient_points"

    profile = get_or_create_profile(session, user_id)
    profile.points_balance = 500
    session.flush()
    purchase_item(session, user_id, "theme", "sakura")
    with pytest.raises(RewardsError) as error:
        purchase_item(session, user_id, "theme", "sakura")
    assert error.value.status_code == 409

    with pytest.raises(RewardsError) as error:
        purchase_item(session, user_id, "theme", "not-a-theme")
    assert error.value.status_code == 404


def test_equip_unowned_item_is_rejected(db):
    session, user_id = db
    with pytest.raises(RewardsError) as error:
        equip(session, user_id, theme_id="than-khe")
    assert error.value.code == "not_owned"
    assert equip(session, user_id, theme_id="classic").active_theme_id == "classic"
