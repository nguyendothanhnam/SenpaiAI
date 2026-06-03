from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Boolean,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
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

    # Relationships
    chat_history = relationship("ChatHistory", back_populates="user")
    learning_sessions = relationship("LearningSession", back_populates="user")


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    jlpt_level = Column(String)  # Predicted JLPT level
    grammar_points = Column(JSON)  # Extracted grammar points
    translation = Column(Text)  # Vietnamese translation if requested
    sources = Column(JSON)  # RAG sources used
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

