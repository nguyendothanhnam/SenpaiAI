from fastapi import APIRouter, Depends, HTTPException, status, Query
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

    # Authenticate user by email or username
    user = db.query(UserDB).filter(
        (UserDB.email == user_credentials.email) | (UserDB.username == user_credentials.email)
    ).first()

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
    if getattr(current_user, "learning_goals", None) is None:
        current_user.learning_goals = []
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

        # Retain the existing request field for older clients, but only a
        # confirmed placement attempt may change the stored JLPT level.
        if user_update.current_jlpt_level is not None and user_update.current_jlpt_level != db_user.current_jlpt_level:
            raise HTTPException(status_code=403, detail="jlpt_level_requires_placement")

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


@router.get("/me/export/download")
def download_personal_data(
        format: str = Query("json", pattern="^(json|zip)$"),
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)):
    from ..services.personal_export import build_archive
    return build_archive(db, current_user, format)


@router.get("/me/export/report")
def personal_learning_report(
        language: str = Query("vi", pattern="^(vi|en)$"),
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)):
    from fastapi.responses import Response
    from ..services.personal_export import report_html, export_day
    return Response(report_html(db, current_user, language), media_type="text/html",
                    headers={"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="senpaiai-{export_day()}.html"',
                             "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff"})


@router.get("/me/export")
async def export_user_data(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Export all user learning data."""
    from ..models.database import ChatConversation, ChatFolder, ChatHistory, LearningSession, VoiceConversation, KanjiWritingAttempt, KanjiWritingReport, ChatAnswerFeedback, UserKanjiNote, MinigameLearningEvent
    from ..services.placement_profile import profile_summary
    from ..services.exercise_selection import export_history
    from ..services.learning_history import LearningSnapshot
    from ..services.learning_progress import export_progress

    try:
        # Get chat history
        chat_history = db.query(ChatHistory) \
            .filter(ChatHistory.user_id == current_user.id) \
            .order_by(ChatHistory.created_at.desc()) \
            .all()

        chat_conversations = db.query(ChatConversation).filter(
            ChatConversation.user_id == current_user.id
        ).order_by(ChatConversation.created_at.asc()).all()
        chat_folders = db.query(ChatFolder).filter(
            ChatFolder.user_id == current_user.id
        ).order_by(ChatFolder.sort_order, ChatFolder.created_at).all()
        voice_conversations = db.query(VoiceConversation).filter(
            VoiceConversation.user_id == current_user.id
        ).all()
        voice_by_id = {conversation.id: conversation for conversation in voice_conversations}

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

        from ..services.flashcards import export_data as export_flashcards
        # Format data for export
        export_data = {
            "flashcards": export_flashcards(db, current_user.id),
            "learning_progress": export_progress(LearningSnapshot(db, current_user)),
            "minigame_learning_events": [{"event_id":row.event_key,"game":row.game,"source_type":row.source_type,"source_id":row.source_id,"action":row.action,"answer":row.answer,"level":row.jlpt_level,"created_at":row.created_at.isoformat()}
                for row in db.query(MinigameLearningEvent).filter_by(user_id=current_user.id).order_by(MinigameLearningEvent.id).all()],
            "kanji_notes": [{"kanji":row.kanji,"sino_vietnamese":row.sino_vietnamese,"meaning_vi":row.meaning_vi,"mnemonic":row.mnemonic,"updated_at":row.updated_at.isoformat()}
                for row in db.query(UserKanjiNote).filter_by(user_id=current_user.id).order_by(UserKanjiNote.kanji).all()],
            "chat_answer_feedback": [{"message_id":row.chat_history_id,"conversation_id":str(row.conversation_id) if row.conversation_id else None,
                "rating":row.rating,"comment":row.comment,"created_at":row.created_at.isoformat(),"updated_at":row.updated_at.isoformat()}
                for row in db.query(ChatAnswerFeedback).filter_by(user_id=current_user.id).order_by(ChatAnswerFeedback.id).all()],
            "kanji_writing_reports": [{"report_id":row.report_key,"attempt_id":row.attempt_key,"kanji":row.kanji,"strokes":row.strokes,"result":row.result,"comment":row.comment,"created_at":row.created_at.isoformat()}
                for row in db.query(KanjiWritingReport).filter_by(user_id=current_user.id).order_by(KanjiWritingReport.id).all()],
            "kanji_writing_attempts": [{"attempt_id": row.attempt_key, "kanji": row.kanji,
                "level": row.jlpt_level, "mode": row.mode, "result": row.result,
                "elapsed_seconds": row.elapsed_seconds, "created_at": row.created_at.isoformat()}
                for row in db.query(KanjiWritingAttempt).filter_by(user_id=current_user.id).order_by(KanjiWritingAttempt.created_at).all()],
            "exercise_history": export_history(db, current_user.id),
            "placement": profile_summary(db, current_user),
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
            "chat_conversations": [
                {
                    "id": str(conversation.id),
                    "folder_id": str(conversation.folder_id) if conversation.folder_id else None,
                    "title": conversation.title,
                    "title_is_auto": conversation.title_is_auto,
                    "is_pinned": conversation.is_pinned,
                    "mode": conversation.mode,
                    "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
                    "last_activity_at": conversation.last_activity_at.isoformat() if conversation.last_activity_at else None,
                    "voice": ({
                        "scenario_id": voice_by_id[conversation.id].scenario_id,
                        "jlpt_level": voice_by_id[conversation.id].jlpt_level,
                        "status": voice_by_id[conversation.id].status,
                        "started_at": voice_by_id[conversation.id].started_at.isoformat() if voice_by_id[conversation.id].started_at else None,
                        "ended_at": voice_by_id[conversation.id].ended_at.isoformat() if voice_by_id[conversation.id].ended_at else None,
                        "summary": voice_by_id[conversation.id].summary,
                    } if conversation.id in voice_by_id else None),
                }
                for conversation in chat_conversations
            ],
            "chat_folders": [
                {
                    "id": str(folder.id), "name": folder.name,
                    "sort_order": folder.sort_order,
                    "created_at": folder.created_at.isoformat() if folder.created_at else None,
                }
                for folder in chat_folders
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
    from ..models.database import ChatConversation, ChatHistory, LearningSession, GrammarPracticeAttempt, VoiceConversation, KanjiWritingAttempt, KanjiWritingReport, ChatAnswerFeedback, MinigameLearningEvent
    from ..services.exercise_selection import clear_history

    try:
        clear_history(db, current_user.id)
        from ..services.flashcards import clear_data
        clear_data(db, current_user.id)
        db.query(KanjiWritingReport).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(KanjiWritingAttempt).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(MinigameLearningEvent).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(ChatAnswerFeedback).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        # Delete chat history
        db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
        db.query(VoiceConversation).filter(VoiceConversation.user_id == current_user.id).delete(synchronize_session=False)
        db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id).delete(synchronize_session=False)

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
            "reset_items": ["chat_history", "chat_conversations", "voice_conversations", "learning_sessions", "grammar_practice_attempts", "exercise_history", "kanji_writing_attempts", "kanji_writing_reports", "chat_answer_feedback", "minigame_learning_events", "flashcard_progress", "flashcard_sessions", "flashcard_assessments"],
            "preserved_chat_items": ["chat_folders"],
            "preserved_items": ["rewards", "daily_tasks", "study_item_stats", "reminder_settings", "push_subscriptions", "flashcard_decks", "flashcard_cards", "flashcard_transfers"],
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
    from ..services.exercise_selection import clear_history
    try:
        clear_history(db, current_user.id)
        from ..services.flashcards import clear_data
        clear_data(db, current_user.id, decks=True)
        from ..models.database import (ChatConversation, ChatFolder, ChatHistory, LearningSession, GrammarPracticeAttempt, PointTransaction, VoiceConversation, ListeningAttempt,
                                       UserGameProfile, UserUnlockedItem, DailyTask, DailyTaskItem, StudyItemStat,
                                       ReminderSettings, Notification, PushSubscription, PlacementAttempt, PlacementAttemptItem, WeeklyLearningGoal, KanjiWritingAttempt, KanjiWritingReport, ChatAnswerFeedback, UserKanjiNote, MinigameLearningEvent)

        # Delete related data first
        db.query(MinigameLearningEvent).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(UserKanjiNote).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(ChatAnswerFeedback).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(KanjiWritingReport).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(KanjiWritingAttempt).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
        db.query(VoiceConversation).filter(VoiceConversation.user_id == current_user.id).delete(synchronize_session=False)
        db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id).delete(synchronize_session=False)
        db.query(ChatFolder).filter(ChatFolder.user_id == current_user.id).delete(synchronize_session=False)
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

        placement_ids = db.query(PlacementAttempt.id).filter(PlacementAttempt.user_id == current_user.id)
        db.query(PlacementAttemptItem).filter(PlacementAttemptItem.attempt_id.in_(placement_ids)).delete(synchronize_session=False)
        db.query(PlacementAttempt).filter(PlacementAttempt.user_id == current_user.id).delete(synchronize_session=False)

        # Delete user
        db.query(WeeklyLearningGoal).filter_by(user_id=current_user.id).delete(synchronize_session=False)
        db.delete(current_user)
        db.commit()

        return None

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

