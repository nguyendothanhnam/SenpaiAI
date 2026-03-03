from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: int
    is_active: bool
    current_jlpt_level: str
    learning_goals: List[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    current_jlpt_level: Optional[str] = None
    learning_goals: Optional[List[str]] = None


# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# Chat Schemas
class ChatMessage(BaseModel):
    message: str
    context: Optional[str] = None
    jlpt_level: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    jlpt_level: Optional[str] = None
    grammar_points: Optional[List[Dict[str, Any]]] = None
    translation: Optional[str] = None
    sources: Optional[List[Dict[str, Any]]] = None  # Changed to Any to allow numbers in relevance
    response_time: float


class ChatHistory(BaseModel):
    id: int
    question: str
    answer: str
    jlpt_level: Optional[str] = None
    grammar_points: Optional[List[Dict[str, Any]]] = None
    translation: Optional[str] = None
    sources: Optional[List[Dict[str, Any]]] = None  # Changed from Dict[str, str] to Dict[str, Any] to allow numbers
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


# Grammar Analysis Schemas
class GrammarAnalysisRequest(BaseModel):
    text: str
    include_translation: bool = False


class GrammarAnalysisResponse(BaseModel):
    text: str
    jlpt_level: str
    grammar_points: List[Dict[str, Any]]
    translation: Optional[str] = None
    difficulty_score: float
    suggestions: List[str]


# Translation Schemas
class TranslationRequest(BaseModel):
    text: str
    source_lang: str  # "ja" or "vi"
    target_lang: str  # "ja" or "vi"


class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    confidence: float


# Document Schemas
class Document(BaseModel):
    id: int
    title: str
    content: str
    document_type: str
    jlpt_level: Optional[str]
    tags: List[str]
    source_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentSearchRequest(BaseModel):
    query: str
    document_type: Optional[str] = None
    jlpt_level: Optional[str] = None
    limit: int = 10


class DocumentCreate(BaseModel):
    title: str
    content: str
    document_type: str
    jlpt_level: Optional[str] = None
    tags: List[str] = []
    source_url: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    document_type: Optional[str] = None
    jlpt_level: Optional[str] = None
    tags: Optional[List[str]] = None
    source_url: Optional[str] = None


class DocumentSearchResponse(BaseModel):
    documents: List[Document]
    total_count: int
    query: str


# Learning Session Schemas
class LearningSession(BaseModel):
    id: int
    session_type: str
    topic: Optional[str]
    difficulty_level: Optional[str]
    duration_minutes: Optional[int]
    questions_answered: int
    correct_answers: int
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class LearningSessionCreate(BaseModel):
    session_type: str
    topic: Optional[str] = None
    difficulty_level: Optional[str] = None


class LearningSessionUpdate(BaseModel):
    duration_minutes: Optional[int] = None
    questions_answered: Optional[int] = None
    correct_answers: Optional[int] = None
    completed_at: Optional[datetime] = None


# Error Schemas
class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None

