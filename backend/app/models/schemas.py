from pydantic import BaseModel, EmailStr, Field, field_validator
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
    description: Optional[str] = None
    content: str
    document_type: str
    jlpt_level: Optional[str]
    tags: List[str] = Field(default_factory=list)
    source_url: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None
    relevance_score: Optional[float] = None

    class Config:
        from_attributes = True


class DocumentSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    document_type: Optional[str] = None
    jlpt_level: Optional[str] = None
    limit: int = 10
    offset: int = 0


class DocumentSearchResult(BaseModel):
    id: int
    title: str
    document_type: str
    jlpt_level: Optional[str] = None
    content_preview: str
    content: str
    tags: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    relevance_score: float = Field(..., ge=0, le=1)


class LibrarySearchResponse(BaseModel):
    results: List[DocumentSearchResult]


class DocumentListResponse(BaseModel):
    items: List[Document]
    total: int
    limit: int
    offset: int


class LibraryCategoriesResponse(BaseModel):
    document_types: List[str]
    jlpt_levels: List[str]


class LibraryStatsResponse(BaseModel):
    total_documents: int
    document_types: Dict[str, int] = Field(default_factory=dict)
    jlpt_levels: Dict[str, int] = Field(default_factory=dict)
    vector_chunks: int


class DocumentFetchUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)


class DocumentFetchUrlResponse(BaseModel):
    title: str
    content: str
    source_url: str


class DocumentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: str
    document_type: str
    jlpt_level: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, value: str) -> str:
        allowed = {"vocabulary", "grammar", "lesson", "culture", "example"}
        if value not in allowed:
            raise ValueError("Invalid document type")
        return value

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        if not value.startswith(("http://", "https://")):
            raise ValueError("Source URL must be a valid URL")
        return value


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    document_type: Optional[str] = None
    jlpt_level: Optional[str] = None
    tags: Optional[List[str]] = None
    source_url: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_update_document_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"vocabulary", "grammar", "lesson", "culture", "example"}
        if value not in allowed:
            raise ValueError("Invalid document type")
        return value

    @field_validator("source_url")
    @classmethod
    def validate_update_source_url(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        if not value.startswith(("http://", "https://")):
            raise ValueError("Source URL must be a valid URL")
        return value


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
    timestamp: Optional[int] = None
    time: Optional[int] = None
    pressure: Optional[float] = Field(default=0.5, ge=0, le=1)
    strokeId: Optional[Any] = None


class KanjiRecognitionRequest(BaseModel):
    image_data: Optional[str] = None
    strokes: Optional[List[List[KanjiStrokePoint]]] = None
    target_kanji: Optional[str] = None
    jlpt_level: Optional[JlptLevel] = None


class KanjiCorrectionRequest(BaseModel):
    image_data: str = Field(..., min_length=1)
    strokes: List[List[KanjiStrokePoint]] = Field(default_factory=list)
    predicted_kanji: Optional[str] = None
    correct_kanji: str = Field(..., min_length=1, max_length=1)
    jlpt_level: Optional[JlptLevel] = None


class KanjiRecognitionPrediction(BaseModel):
    kanji: str
    confidence: float = Field(..., ge=0, le=1)
    meaning: str = "Unknown"
    onyomi: List[str] = Field(default_factory=list)
    kunyomi: List[str] = Field(default_factory=list)
    strokes: Optional[int] = None
    stroke_count: Optional[int] = None
    jlpt: Optional[JlptLevel] = None
    radical: Optional[str] = None
    structure: Optional[str] = None
    reason: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)


class KanjiRecognitionResponse(BaseModel):
    success: bool = True
    predictions: List[KanjiRecognitionPrediction]
    engine: str
    isDemo: bool = False
    sample_id: Optional[str] = None
    message: Optional[str] = None
    low_confidence: bool = False


class KanjiModelInfoResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    engine: str
    available: bool = False
    model_loaded: bool
    total_classes: int = 0
    classes_count: int
    model_path: Optional[str] = None
    label_map_path: Optional[str] = None
    missing_files: List[str] = Field(default_factory=list)
    message: Optional[str] = None
    supported_jlpt: List[JlptLevel]
    supported_kanji: List[str]
    dictionary_classes: int = 0


class KanjiVGStroke(BaseModel):
    index: int
    path: str
    type: Optional[str] = None


class KanjiVGStrokeData(BaseModel):
    kanji: str
    viewBox: str = "0 0 109 109"
    strokes: List[KanjiVGStroke] = Field(default_factory=list)
    stroke_count: int
    jlpt: Optional[JlptLevel] = None
    meaning_vi: Optional[str] = None
    onyomi: List[str] = Field(default_factory=list)
    kunyomi: List[str] = Field(default_factory=list)
    source: str = "KanjiVG"
    license: str = "CC BY-SA 3.0"
    source_url: str = "https://kanjivg.tagaini.net"


class KanjiVGMetadata(BaseModel):
    kanji: str
    stroke_count: int
    jlpt: Optional[JlptLevel] = None
    meaning_vi: Optional[str] = None
    onyomi: List[str] = Field(default_factory=list)
    kunyomi: List[str] = Field(default_factory=list)
    source: str = "KanjiVG"
    license: str = "CC BY-SA 3.0"
    source_url: str = "https://kanjivg.tagaini.net"


class SupportedKanjiVGResponse(BaseModel):
    kanji: List[str]
    total: int
    source: str = "KanjiVG"
    license: str = "CC BY-SA 3.0"
    source_url: str = "https://kanjivg.tagaini.net"


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
