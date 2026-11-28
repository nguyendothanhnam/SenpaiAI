"""Additive dictionary DTOs shared by web and future React Native callers."""
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
from .schemas import JlptLevel


class DictionarySource(BaseModel):
    name: str
    id: Optional[str] = None
    jmdict_id: Optional[int] = None
    dataset_version: Optional[str] = None
    license: Optional[str] = None
    url: Optional[str] = None
    community_level: bool = False
    source_level: Optional[JlptLevel] = None


class DictionaryMeaning(BaseModel):
    language: Literal['vi', 'en']
    text: str
    status: Literal['reviewed', 'automatic', 'missing', 'source']
    source: DictionarySource
    generation: Optional[dict[str, Any]] = None


class DictionaryEntry(BaseModel):
    id: int
    word: str
    reading: str
    romaji: Optional[str] = None
    jlpt_level: JlptLevel
    part_of_speech: Optional[str] = None
    pos: list[str] = Field(default_factory=list)
    meaning_vi: Optional[str] = None
    meaning_en: Optional[str] = None
    meaning_vi_status: Literal['reviewed', 'automatic', 'missing']
    display_meaning: str
    display_language: Literal['vi', 'en']
    meanings: list[DictionaryMeaning]
    source: DictionarySource
    notices: list[str]
    translation_enabled: bool
    examples: list[dict[str, Any]] = Field(default_factory=list)
    related_kanji: list[dict[str, Any]] = Field(default_factory=list)
    other_forms: list[str] = Field(default_factory=list)
    other_readings: list[str] = Field(default_factory=list)


class DictionaryPage(BaseModel):
    items: list[DictionaryEntry]
    total: int
    limit: int
    offset: int


class DictionaryTranslation(BaseModel):
    translation: Literal['cached', 'disabled', 'unavailable', 'generated']
    entry: DictionaryEntry
