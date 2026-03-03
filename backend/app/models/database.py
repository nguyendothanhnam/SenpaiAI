from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
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


class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id = Column(Integer, primary_key=True, index=True)
    japanese_word = Column(String, nullable=False)
    reading = Column(String)  # Hiragana/Katakana reading
    meaning = Column(Text, nullable=False)
    part_of_speech = Column(String)  # noun, verb, adjective, etc.
    jlpt_level = Column(String, nullable=False)
    example_sentences = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

