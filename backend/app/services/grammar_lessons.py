"""Validated, repeatable imports of supplied lesson content."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from ..models.database import GrammarLesson, GrammarRule


class ExampleToken(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=200)
    reading: str = Field(default='', max_length=200)


class LessonExample(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ja: str = Field(min_length=1, max_length=2000)
    vi: str = Field(default='', max_length=2000)
    en: str = Field(default='', max_length=2000)
    romaji: str = Field(default='', max_length=4000)
    tokens: list[ExampleToken] = Field(default_factory=list, max_length=200)

    @field_validator('tokens')
    @classmethod
    def bounded_tokens(cls, value):
        return value

    @model_validator(mode='after')
    def has_translation(self):
        if not self.vi.strip() and not self.en.strip():
            raise ValueError('An example needs a Vietnamese or English translation')
        return self


class LessonInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source_key: str = Field(min_length=1, max_length=160, pattern=r'^[A-Za-z0-9_.-]+$')
    grammar_rule_id: int = Field(gt=0)
    jlpt_level: Literal['N5', 'N4', 'N3', 'N2', 'N1']
    sort_order: int = Field(ge=0, le=1000000)
    formation: str = Field(min_length=1, max_length=4000)
    meaning: str = Field(min_length=1, max_length=4000)
    usage_notes: str = Field(default='', max_length=10000)
    examples: list[LessonExample] = Field(default_factory=list, max_length=50)
    common_errors: list[str] = Field(default_factory=list, max_length=50)
    comparisons: list[str] = Field(default_factory=list, max_length=50)

    @field_validator('formation', 'meaning')
    @classmethod
    def nonempty(cls, value):
        if not value.strip(): raise ValueError('content must not be blank')
        return value.strip()

    @field_validator('common_errors', 'comparisons')
    @classmethod
    def valid_notes(cls, value):
        if any(not text.strip() or len(text) > 4000 for text in value):
            raise ValueError('Each note must contain 1–4000 characters')
        return value


def import_lessons(db: Session, raw):
    if not isinstance(raw, list) or len(raw) > 5000:
        raise ValueError('Expected an array of at most 5000 lessons')
    lessons = [LessonInput.model_validate(item) for item in raw]
    if len({x.source_key for x in lessons}) != len(lessons) or len({x.grammar_rule_id for x in lessons}) != len(lessons):
        raise ValueError('Duplicate lesson key or rule in input')
    for lesson in lessons:
        rule = db.get(GrammarRule, lesson.grammar_rule_id)
        if not rule or rule.jlpt_level != lesson.jlpt_level:
            raise ValueError(f'Unknown rule or mismatched level: {lesson.source_key}')
        existing = db.query(GrammarLesson).filter_by(source_key=lesson.source_key).first()
        if existing and existing.grammar_rule_id != lesson.grammar_rule_id:
            raise ValueError(f'Cannot reassign an existing lesson to a different rule: {lesson.source_key}')
        for example in lesson.examples:
            if example.tokens and ''.join(token.text for token in example.tokens) != example.ja:
                raise ValueError(f'Furigana tokens do not match example: {lesson.source_key}')
        conflict = db.query(GrammarLesson).filter(GrammarLesson.grammar_rule_id == lesson.grammar_rule_id, GrammarLesson.source_key != lesson.source_key).first()
        if conflict:
            raise ValueError(f'Rule already belongs to another lesson: {lesson.source_key}')
    created = updated = 0
    for lesson in lessons:
        row = db.query(GrammarLesson).filter_by(source_key=lesson.source_key).first()
        values = lesson.model_dump()
        if row is None:
            db.add(GrammarLesson(**values)); created += 1
        elif any(getattr(row, key) != value for key, value in values.items()):
            for key, value in values.items(): setattr(row, key, value)
            updated += 1
    db.flush()
    return {'created': created, 'updated': updated, 'unchanged': len(lessons) - created - updated}
