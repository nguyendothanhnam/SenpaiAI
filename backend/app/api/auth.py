from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta, datetime

from ..core.database import get_db
from ..core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user
)
from ..core.config import settings
from ..models.database import User as UserDB
from ..models.schemas import (
    UserCreate,
    UserLogin,
    User,
    UserUpdate,
    Token
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    try:
        # Check if user already exists
        db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Check if username already exists
        db_user = db.query(UserDB).filter(UserDB.username == user.username).first()
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

        # Create new user
        hashed_password = get_password_hash(user.password)
        db_user = UserDB(
            email=user.email,
            username=user.username,
            hashed_password=hashed_password,
            current_jlpt_level="N5",
            learning_goals=[]
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        return db_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token."""

    # Authenticate user
    user = db.query(UserDB).filter(UserDB.email == user_credentials.email).first()

    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


@router.put("/me", response_model=User)
async def update_current_user(
        user_update: UserUpdate,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Update current user information."""

    try:
        # Get fresh user from database
        db_user = db.query(UserDB).filter(UserDB.id == current_user.id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Update user fields
        if user_update.username is not None:
            # Check if username is already taken
            existing_user = db.query(UserDB).filter(
                UserDB.username == user_update.username,
                UserDB.id != db_user.id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
            db_user.username = user_update.username

        if user_update.current_jlpt_level is not None:
            db_user.current_jlpt_level = user_update.current_jlpt_level

        if user_update.learning_goals is not None:
            db_user.learning_goals = user_update.learning_goals

        if user_update.ui_language is not None:
            db_user.ui_language = user_update.ui_language

        db.commit()
        db.refresh(db_user)

        return db_user

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user: {str(e)}"
        )


@router.get("/me/export")
async def export_user_data(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Export all user learning data."""
    from ..models.database import ChatHistory, LearningSession

    try:
        # Get chat history
        chat_history = db.query(ChatHistory) \
            .filter(ChatHistory.user_id == current_user.id) \
            .order_by(ChatHistory.created_at.desc()) \
            .all()

        # Get learning sessions
        learning_sessions = db.query(LearningSession) \
            .filter(LearningSession.user_id == current_user.id) \
            .order_by(LearningSession.created_at.desc()) \
            .all()

        from ..models.database import DailyTask
        recent_daily_tasks = db.query(DailyTask).filter(DailyTask.user_id == current_user.id) \
            .order_by(DailyTask.task_date.desc()).limit(30).all()

        from ..models.database import PointTransaction, UserGameProfile, UserUnlockedItem
        rewards_profile = db.query(UserGameProfile).filter(UserGameProfile.user_id == current_user.id).first()
        point_transactions = db.query(PointTransaction).filter(PointTransaction.user_id == current_user.id) \
            .order_by(PointTransaction.created_at.desc(), PointTransaction.id.desc()).limit(100).all()
        unlocked_items = db.query(UserUnlockedItem).filter(UserUnlockedItem.user_id == current_user.id).all()
        from ..models.database import ReminderSettings
        reminder_settings = db.query(ReminderSettings).filter(ReminderSettings.user_id == current_user.id).first()

        # Format data for export
        export_data = {
            "user_profile": {
                "username": current_user.username,
                "email": current_user.email,
                "current_jlpt_level": current_user.current_jlpt_level,
                "learning_goals": current_user.learning_goals,
                "ui_language": current_user.ui_language,
                "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            },
            "chat_history": [
                {
                    "id": chat.id,
                    "question": chat.question,
                    "answer": chat.answer,
                    "jlpt_level": chat.jlpt_level,
                    "grammar_points": chat.grammar_points,
                    "translation": chat.translation,
                    "sources": chat.sources,
                    "input_mode": chat.input_mode,
                    "conversation_id": str(chat.conversation_id) if chat.conversation_id else None,
                    "scenario": chat.scenario,
                    "feedback": chat.feedback,
                    "created_at": chat.created_at.isoformat() if chat.created_at else None,
                }
                for chat in chat_history
            ],
            "learning_sessions": [
                {
                    "id": session.id,
                    "session_type": session.session_type,
                    "topic": session.topic,
                    "difficulty_level": session.difficulty_level,
                    "duration_minutes": session.duration_minutes,
                    "questions_answered": session.questions_answered,
                    "correct_answers": session.correct_answers,
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                }
                for session in learning_sessions
            ],
            "recent_daily_tasks": [
                {"date": task.task_date.isoformat(), "status": task.status,
                 "total_items": task.total_items, "correct_count": task.correct_count,
                 "points_awarded": task.points_awarded, "streak_after": task.streak_after,
                 "completed_at": task.completed_at.isoformat() if task.completed_at else None}
                for task in recent_daily_tasks
            ],
            "rewards": {
                "profile": ({"points_balance": rewards_profile.points_balance,
                             "current_streak": rewards_profile.current_streak,
                             "longest_streak": rewards_profile.longest_streak,
                             "last_completed_date": rewards_profile.last_completed_date.isoformat() if rewards_profile.last_completed_date else None,
                             "active_theme_id": rewards_profile.active_theme_id,
                             "active_background_id": rewards_profile.active_background_id}
                            if rewards_profile else None),
                "recent_transactions": [
                    {"id": t.id, "amount": t.amount, "reason": t.reason, "ref_type": t.ref_type,
                     "ref_id": t.ref_id, "balance_after": t.balance_after,
                     "created_at": t.created_at.isoformat() if t.created_at else None}
                    for t in point_transactions
                ],
                "unlocked_items": [
                    {"item_type": x.item_type, "item_id": x.item_id, "price_paid": x.price_paid,
                     "unlocked_at": x.unlocked_at.isoformat() if x.unlocked_at else None}
                    for x in unlocked_items
                ],
            },
            "reminder_settings": ({
                "enabled": reminder_settings.enabled,
                "timezone": reminder_settings.timezone,
                "reminder_time": reminder_settings.reminder_time,
                "days_of_week": reminder_settings.days_of_week,
                "types": reminder_settings.types,
                "quiet_start": reminder_settings.quiet_start,
                "quiet_end": reminder_settings.quiet_end,
                "push_enabled": reminder_settings.push_enabled,
                "max_per_day": reminder_settings.max_per_day,
                "snooze_until": reminder_settings.snooze_until.isoformat() if reminder_settings.snooze_until else None,
            } if reminder_settings else None),
            "export_date": datetime.utcnow().isoformat(),
            "total_chat_messages": len(chat_history),
            "total_learning_sessions": len(learning_sessions),
        }

        return export_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting user data: {str(e)}"
        )


@router.post("/me/reset-progress", status_code=status.HTTP_200_OK)
async def reset_user_progress(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Reset user's learning progress (chat history, learning sessions)."""
    from ..models.database import ChatHistory, LearningSession, GrammarPracticeAttempt, VoiceConversation

    try:
        # Delete chat history
        db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
        db.query(VoiceConversation).filter(VoiceConversation.user_id == current_user.id).delete(synchronize_session=False)

        # Explicit deletion also supports databases where FK cascade enforcement is disabled.
        db.query(GrammarPracticeAttempt).filter(GrammarPracticeAttempt.user_id == current_user.id).delete(synchronize_session=False)

        # Delete learning sessions
        db.query(LearningSession).filter(LearningSession.user_id == current_user.id).delete()

        # Keep rewards progress: resetting lessons must not allow users to replay them for points.

        # Reset learning goals (optional - you can keep them or reset)
        # current_user.learning_goals = []

        db.commit()

        return {
            "message": "Progress reset successfully",
            "reset_items": ["chat_history", "voice_conversations", "learning_sessions", "grammar_practice_attempts"],
            "preserved_items": ["rewards", "daily_tasks", "study_item_stats", "reminder_settings", "push_subscriptions"],
            "preserved_reason": "Giữ điểm, nhiệm vụ và thống kê học để tránh làm lại nhằm nhận điểm lần nữa.",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting progress: {str(e)}"
        )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Delete current user account."""
    try:
        from ..models.database import (ChatHistory, LearningSession, GrammarPracticeAttempt, PointTransaction, VoiceConversation, ListeningAttempt,
                                       UserGameProfile, UserUnlockedItem, DailyTask, DailyTaskItem, StudyItemStat,
                                       ReminderSettings, Notification, PushSubscription)

        # Delete related data first
        db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
        db.query(VoiceConversation).filter(VoiceConversation.user_id == current_user.id).delete(synchronize_session=False)
        db.query(ListeningAttempt).filter(ListeningAttempt.user_id == current_user.id).delete(synchronize_session=False)
        db.query(GrammarPracticeAttempt).filter(GrammarPracticeAttempt.user_id == current_user.id).delete(synchronize_session=False)
        db.query(LearningSession).filter(LearningSession.user_id == current_user.id).delete()

        # Explicitly remove reward rows for databases with FK cascade enforcement disabled.
        db.query(PointTransaction).filter(PointTransaction.user_id == current_user.id).delete(synchronize_session=False)
        db.query(UserUnlockedItem).filter(UserUnlockedItem.user_id == current_user.id).delete(synchronize_session=False)
        db.query(UserGameProfile).filter(UserGameProfile.user_id == current_user.id).delete(synchronize_session=False)
        task_ids = db.query(DailyTask.id).filter(DailyTask.user_id == current_user.id)
        db.query(DailyTaskItem).filter(DailyTaskItem.daily_task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(DailyTask).filter(DailyTask.user_id == current_user.id).delete(synchronize_session=False)
        db.query(StudyItemStat).filter(StudyItemStat.user_id == current_user.id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == current_user.id).delete(synchronize_session=False)
        db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).delete(synchronize_session=False)
        db.query(ReminderSettings).filter(ReminderSettings.user_id == current_user.id).delete(synchronize_session=False)

        # Delete user
        db.delete(current_user)
        db.commit()

        return None

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

