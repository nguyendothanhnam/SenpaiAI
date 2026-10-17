from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Boolean,
    String,
    Text,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # User preferences
    current_jlpt_level = Column(String, default="N5")  # N5, N4, N3, N2, N1
    learning_goals = Column(JSON, default=list)
    exercise_points = Column(Integer, default=0, server_default="0", nullable=False)
    ui_language = Column(String(2), nullable=True)

    # Relationships
    chat_history = relationship("ChatHistory", back_populates="user")
    learning_sessions = relationship("LearningSession", back_populates="user")


class UserGameProfile(Base):
    __tablename__ = "user_game_profiles"
    __table_args__ = (CheckConstraint("points_balance >= 0", name="ck_user_game_profiles_balance_nonnegative"),)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    points_balance = Column(Integer, nullable=False, default=0, server_default="0")
    current_streak = Column(Integer, nullable=False, default=0, server_default="0")
    longest_streak = Column(Integer, nullable=False, default=0, server_default="0")
    last_completed_date = Column(Date, nullable=True)
    active_theme_id = Column(String, nullable=False, default="classic", server_default="classic")
    active_background_id = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class PointTransaction(Base):
    __tablename__ = "point_transactions"
    __table_args__ = (
        CheckConstraint("amount <> 0", name="ck_point_transactions_amount_nonzero"),
        UniqueConstraint("idempotency_key", name="uq_point_transactions_idempotency_key"),
        Index("ix_point_transactions_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    ref_type = Column(String, nullable=True)
    ref_id = Column(String, nullable=True)
    idempotency_key = Column(String, nullable=False)
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserUnlockedItem(Base):
    __tablename__ = "user_unlocked_items"
    __table_args__ = (
        CheckConstraint("item_type IN ('theme', 'background')", name="ck_user_unlocked_items_type"),
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_unlocked_item"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String, nullable=False)
    item_id = Column(String, nullable=False)
    price_paid = Column(Integer, nullable=False)
    unlocked_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DailyTask(Base):
    __tablename__ = "daily_tasks"
    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed')", name="ck_daily_tasks_status"),
        UniqueConstraint("user_id", "task_date", name="uq_daily_tasks_user_date"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="in_progress", server_default="in_progress")
    total_items = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False, default=0, server_default="0")
    points_awarded = Column(Integer, nullable=False, default=0, server_default="0")
    streak_after = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class DailyTaskItem(Base):
    __tablename__ = "daily_task_items"
    __table_args__ = (
        CheckConstraint("item_type IN ('grammar', 'kanji', 'vocab', 'flashcard')", name="ck_daily_task_items_type"),
        UniqueConstraint("daily_task_id", "position", name="uq_daily_task_item_position"),
    )

    id = Column(Integer, primary_key=True)
    daily_task_id = Column(Integer, ForeignKey("daily_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    item_type = Column(String(20), nullable=False)
    source_id = Column(String, nullable=False)
    question_type = Column(String(30), nullable=False)
    payload = Column(JSON, nullable=False)
    answer_key = Column(JSON, nullable=False)
    user_answer = Column(JSON, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    time_spent_ms = Column(Integer, nullable=False, default=0, server_default="0")
    answered_at = Column(DateTime(timezone=True), nullable=True)


class StudyItemStat(Base):
    __tablename__ = "study_item_stats"
    __table_args__ = (
        CheckConstraint("item_type IN ('kanji', 'vocab')", name="ck_study_item_stats_type"),
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_study_item_stat"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String(10), nullable=False)
    item_id = Column(String, nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    wrong_count = Column(Integer, nullable=False, default=0, server_default="0")
    last_wrong_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)


class ReminderSettings(Base):
    __tablename__ = "reminder_settings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    timezone = Column(String(100), nullable=False, default="Asia/Ho_Chi_Minh", server_default="Asia/Ho_Chi_Minh")
    reminder_time = Column(String(5), nullable=False, default="20:00", server_default="20:00")
    days_of_week = Column(JSON, nullable=False, default=lambda: list(range(7)))
    types = Column(JSON, nullable=False, default=lambda: ["daily_task", "streak_risk", "review_due"])
    quiet_start = Column(String(5), nullable=False, default="22:00", server_default="22:00")
    quiet_end = Column(String(5), nullable=False, default="07:00", server_default="07:00")
    push_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    max_per_day = Column(Integer, nullable=False, default=3, server_default="3")
    snooze_until = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_notifications_dedupe_key"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(40), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    url = Column(String(500), nullable=False, default="/daily", server_default="/daily")
    data = Column(JSON, nullable=False, default=dict)
    dedupe_key = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    push_sent_at = Column(DateTime(timezone=True), nullable=True)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    failed_count = Column(Integer, nullable=False, default=0, server_default="0")


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    jlpt_level = Column(String)  # Predicted JLPT level
    grammar_points = Column(JSON)  # Extracted grammar points
    translation = Column(Text)  # Vietnamese translation if requested
    sources = Column(JSON)  # RAG sources used
    input_mode = Column(String(20), nullable=True, default="text", server_default="text")
    conversation_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    scenario = Column(String(80), nullable=True)
    feedback = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="chat_history")


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_type = Column(String, nullable=False)  # "chat", "grammar", "translation", "quiz"
    topic = Column(String)
    difficulty_level = Column(String)  # N5-N1
    duration_minutes = Column(Integer)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="learning_sessions")


class VoiceConversation(Base):
    __tablename__ = "voice_conversations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_id = Column(String(80), nullable=False)
    jlpt_level = Column(String(2), nullable=False)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    summary = Column(JSON, nullable=True)


class ListeningLesson(Base):
    __tablename__ = "listening_lessons"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    jlpt_level = Column(String(2), nullable=False, index=True)
    topic = Column(String(80), nullable=False, index=True)
    description = Column(Text, nullable=True)
    segments = Column(JSON, nullable=False)
    audio_path = Column(String(255), nullable=True)
    duration_ms = Column(Integer, nullable=False, default=0, server_default="0")
    source = Column(String(20), nullable=False, default="seed", server_default="seed")
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ListeningAttempt(Base):
    __tablename__ = "listening_attempts"
    __table_args__ = (
        CheckConstraint("mode IN ('dictation', 'comprehension', 'cloze')", name="ck_listening_attempts_mode"),
        Index("ix_listening_attempts_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("listening_lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String(20), nullable=False)
    score = Column(Float, nullable=False)
    details = Column(JSON, nullable=True)
    duration_ms = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    document_type = Column(String, nullable=False)  # "grammar", "vocabulary", "lesson", "example"
    jlpt_level = Column(String)  # N5-N1
    tags = Column(JSON, default=list)
    source_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Vector embedding metadata
    embedding_id = Column(String)  # ChromaDB document ID
    chunk_index = Column(Integer, default=0)


class GrammarRule(Base):
    __tablename__ = "grammar_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, nullable=False)
    japanese_pattern = Column(String, nullable=False)
    meaning = Column(Text, nullable=False)
    usage_notes = Column(Text)
    examples = Column(JSON, default=list)  # List of example sentences
    jlpt_level = Column(String, nullable=False)
    difficulty_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GrammarQuestion(Base):
    __tablename__ = "grammar_questions"
    __table_args__ = (
        CheckConstraint("question_type IN ('fill_blank', 'reorder', 'true_false', 'conjugation')", name="ck_grammar_question_type"),
        CheckConstraint("source IN ('seed', 'ai', 'manual')", name="ck_grammar_question_source"),
        UniqueConstraint("question_type", "prompt", name="uq_grammar_question_type_prompt"),
        Index("ix_grammar_questions_bank", "jlpt_level", "question_type", "grammar_rule_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    grammar_rule_id = Column(Integer, ForeignKey("grammar_rules.id", ondelete="SET NULL"), nullable=True)
    jlpt_level = Column(String(2), nullable=False)
    question_type = Column(String(20), nullable=False)
    prompt = Column(Text, nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
    correct_answer = Column(JSON, nullable=False)
    accepted_answers = Column(JSON)
    explanation_vi = Column(Text, nullable=False)
    examples = Column(JSON, nullable=False, default=list)
    source = Column(String(10), nullable=False, default="manual")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    grammar_rule = relationship("GrammarRule")


class GrammarPracticeAttempt(Base):
    __tablename__ = "grammar_practice_attempts"
    __table_args__ = (Index("ix_grammar_practice_attempts_user_created", "user_id", "created_at"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    learning_session_id = Column(Integer, ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("grammar_questions.id", ondelete="SET NULL"), nullable=True)
    grammar_rule_id = Column(Integer, ForeignKey("grammar_rules.id", ondelete="SET NULL"), nullable=True)
    jlpt_level = Column(String(2), nullable=False)
    question_type = Column(String(20), nullable=False)
    user_answer = Column(JSON, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_spent_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    grammar_rule = relationship("GrammarRule")
    question = relationship("GrammarQuestion")


class Kanji(Base):
    __tablename__ = "kanji"
    __table_args__ = (
        CheckConstraint("char_length(character) = 1", name="ck_kanji_single_character"),
        CheckConstraint("jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')", name="ck_kanji_jlpt_level"),
    )

    id = Column(Integer, primary_key=True, index=True)
    character = Column(String(1), unique=True, index=True, nullable=False)
    meaning_vi = Column(Text, nullable=False)
    jlpt_level = Column(String(2), nullable=False, index=True)
    stroke_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    readings = relationship(
        "KanjiReading",
        back_populates="kanji",
        cascade="all, delete-orphan",
        order_by="KanjiReading.id",
    )
    examples = relationship(
        "KanjiExample",
        back_populates="kanji",
        cascade="all, delete-orphan",
        order_by="KanjiExample.id",
    )
    vocabulary_links = relationship("VocabularyKanji", back_populates="kanji")


class KanjiReading(Base):
    __tablename__ = "kanji_readings"
    __table_args__ = (
        UniqueConstraint("kanji_id", "reading_type", "reading", name="uq_kanji_reading"),
        CheckConstraint("reading_type IN ('onyomi', 'kunyomi')", name="ck_kanji_reading_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    kanji_id = Column(Integer, ForeignKey("kanji.id", ondelete="CASCADE"), nullable=False, index=True)
    reading_type = Column(String(10), nullable=False, index=True)
    reading = Column(String, nullable=False, index=True)
    romaji = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    kanji = relationship("Kanji", back_populates="readings")


class KanjiExample(Base):
    __tablename__ = "kanji_examples"

    id = Column(Integer, primary_key=True, index=True)
    kanji_id = Column(Integer, ForeignKey("kanji.id", ondelete="CASCADE"), nullable=False, index=True)
    sentence = Column(Text, nullable=False)
    reading = Column(Text, nullable=False)
    romaji = Column(Text)
    meaning_vi = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    kanji = relationship("Kanji", back_populates="examples")


class Vocabulary(Base):
    __tablename__ = "vocabulary"
    __table_args__ = (
        UniqueConstraint("japanese_word", "reading", name="uq_vocabulary_word_reading"),
        CheckConstraint("jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')", name="ck_vocabulary_jlpt_level"),
    )

    id = Column(Integer, primary_key=True, index=True)
    japanese_word = Column(String, nullable=False, index=True)
    reading = Column(String, nullable=False, index=True)  # Hiragana/Katakana reading
    romaji = Column(String)
    meaning = Column(Text, nullable=False)
    part_of_speech = Column(String)  # noun, verb, adjective, etc.
    jlpt_level = Column(String, nullable=False, index=True)
    example_sentences = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    kanji_links = relationship(
        "VocabularyKanji",
        back_populates="vocabulary",
        cascade="all, delete-orphan",
        order_by="VocabularyKanji.position_in_word",
    )


class VocabularyKanji(Base):
    __tablename__ = "vocabulary_kanji"
    __table_args__ = (
        UniqueConstraint("vocabulary_id", "kanji_id", "position_in_word", name="uq_vocabulary_kanji_position"),
        CheckConstraint("position_in_word > 0", name="ck_vocabulary_kanji_position_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    vocabulary_id = Column(
        Integer,
        ForeignKey("vocabulary.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kanji_id = Column(Integer, ForeignKey("kanji.id", ondelete="RESTRICT"), nullable=False, index=True)
    position_in_word = Column(Integer, nullable=False)

    vocabulary = relationship("Vocabulary", back_populates="kanji_links")
    kanji = relationship("Kanji", back_populates="vocabulary_links")

