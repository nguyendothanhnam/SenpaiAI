from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from typing import Literal


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


JlptLevel = Literal["N5", "N4", "N3", "N2", "N1"]
KanjiReadingType = Literal["onyomi", "kunyomi"]


class KanjiReadingBase(BaseModel):
    reading_type: KanjiReadingType
    reading: str = Field(..., min_length=1)
    romaji: Optional[str] = None


class KanjiReadingCreate(KanjiReadingBase):
    pass


class KanjiReading(KanjiReadingBase):
    id: int

    class Config:
        from_attributes = True


class KanjiExampleBase(BaseModel):
    sentence: str = Field(..., min_length=1)
    reading: str = Field(..., min_length=1)
    romaji: Optional[str] = None
    meaning_vi: Optional[str] = None


class KanjiExampleCreate(KanjiExampleBase):
    pass


class KanjiExample(KanjiExampleBase):
    id: int

    class Config:
        from_attributes = True


class KanjiCreate(BaseModel):
    character: str = Field(..., min_length=1, max_length=1)
    meaning_vi: str = Field(..., min_length=1)
    jlpt_level: JlptLevel
    stroke_count: Optional[int] = Field(default=None, gt=0)
    readings: List[KanjiReadingCreate] = Field(default_factory=list)
    examples: List[KanjiExampleCreate] = Field(default_factory=list)


class Kanji(BaseModel):
    id: int
    character: str
    meaning_vi: str
    jlpt_level: JlptLevel
    stroke_count: Optional[int] = None
    readings: List[KanjiReading] = Field(default_factory=list)
    examples: List[KanjiExample] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VocabularyKanjiBrief(BaseModel):
    id: int
    character: str
    meaning_vi: str
    jlpt_level: JlptLevel

    class Config:
        from_attributes = True


class VocabularyCreate(BaseModel):
    word: str = Field(..., min_length=1)
    reading: str = Field(..., min_length=1)
    romaji: Optional[str] = None
    meaning_vi: str = Field(..., min_length=1)
    jlpt_level: JlptLevel
    part_of_speech: Optional[str] = None
    example_sentences: List[Any] = Field(default_factory=list)
    kanji_ids: List[int] = Field(default_factory=list)


class Vocabulary(BaseModel):
    id: int
    word: str
    reading: str
    romaji: Optional[str] = None
    meaning_vi: str
    jlpt_level: JlptLevel
    part_of_speech: Optional[str] = None
    example_sentences: List[Any] = Field(default_factory=list)
    related_kanji: List[VocabularyKanjiBrief] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None


class VocabularyListResponse(BaseModel):
    items: List[Vocabulary]
    total: int
    limit: int
    offset: int


class KanjiListResponse(BaseModel):
    items: List[Kanji]
    total: int
    limit: int
    offset: int


class KanjiStrokePoint(BaseModel):
    x: float
    y: float
    time: Optional[int] = None


class KanjiRecognitionRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)
    strokes: List[List[KanjiStrokePoint]] = Field(default_factory=list)
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)


class KanjiRecognitionPrediction(BaseModel):
    kanji: str
    confidence: float = Field(..., ge=0, le=1)
    meaning: str
    onyomi: Optional[str] = None
    kunyomi: Optional[str] = None
    strokes: Optional[int] = None


class KanjiRecognitionResponse(BaseModel):
    predictions: List[KanjiRecognitionPrediction]
    engine: str
    isDemo: bool = False


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
