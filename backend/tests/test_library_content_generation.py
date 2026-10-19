import asyncio
import json
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import grammar_practice, listening
from app.core.database import Base
from app.models.database import Document, GrammarQuestion, ListeningLesson, User
from app.services import grammar_practice_service


@pytest.fixture
def db_user():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    tables = [User.__table__, Document.__table__, GrammarQuestion.__table__, ListeningLesson.__table__]
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine, autoflush=False)()
    user = User(email="library@example.test", username="library", hashed_password="test", current_jlpt_level="N4")
    session.add(user)
    session.flush()
    document = Document(title="Particles", content="A lesson about は and が.", document_type="grammar", jlpt_level="N5")
    session.add(document)
    session.commit()
    yield session, user, document
    session.close()
    Base.metadata.drop_all(engine, tables=tables)
    engine.dispose()


def fill_blank_json(prompt="私は____学生です。"):
    return json.dumps({"questions": [{
        "question_type": "fill_blank", "prompt": prompt,
        "payload": {"options": ["は", "が", "を", "に"]}, "correct_answer": "は",
        "explanation_vi": "は đánh dấu chủ đề trong câu.",
    }]}, ensure_ascii=False)


def test_document_question_generator_uses_configured_ollama_provider(monkeypatch):
    import app.services.ollama_service as ollama_module
    monkeypatch.setattr(grammar_practice_service, "settings_provider", lambda: "ollama")
    monkeypatch.setattr(ollama_module.ollama_service, "_call_ollama", lambda prompt, system: fill_blank_json())
    raw = asyncio.run(grammar_practice_service.generate_raw_questions_from_document("N5", "fill_blank", 1, "は topic marker"))
    parsed, rejected = grammar_practice_service.parse_generated_questions(raw, "N5", "fill_blank")
    assert len(parsed) == 1 and rejected == 0


def test_grammar_from_library_not_found(db_user):
    db, user, _ = db_user
    with pytest.raises(HTTPException) as error:
        asyncio.run(grammar_practice.generate_questions_from_library(
            grammar_practice.LibraryGenerateRequest(document_id=999, jlpt_level="N4", question_type="fill_blank", count=5), user, db))
    assert error.value.status_code == 404


def test_grammar_from_library_rejects_bad_json(db_user, monkeypatch):
    db, user, document = db_user
    async def malformed(*_args): return "{broken"
    monkeypatch.setattr(grammar_practice_service, "generate_raw_questions_from_document", malformed)
    result = asyncio.run(grammar_practice.generate_questions_from_library(
        grammar_practice.LibraryGenerateRequest(document_id=document.id, jlpt_level="N4", question_type="fill_blank", count=1), user, db))
    assert result["saved"] == 0 and result["rejected"] == 1


def test_grammar_from_library_deduplicates_and_persists_source(db_user, monkeypatch):
    db, user, document = db_user
    async def generated(*_args): return fill_blank_json()
    monkeypatch.setattr(grammar_practice_service, "generate_raw_questions_from_document", generated)
    body = grammar_practice.LibraryGenerateRequest(document_id=document.id, jlpt_level="N4", question_type="fill_blank", count=1)
    first = asyncio.run(grammar_practice.generate_questions_from_library(body, user, db))
    second = asyncio.run(grammar_practice.generate_questions_from_library(body, user, db))
    question = db.query(GrammarQuestion).filter_by(id=first["question_ids"][0]).one()
    assert first["saved"] == 1 and second["saved"] == 0 and second["rejected"] == 1
    assert question.source == "ai" and question.source_document_id == document.id
    assert question.created_by_user_id == user.id and question.jlpt_level == "N5"


def test_grammar_from_library_obeys_hourly_limit(db_user, monkeypatch):
    db, user, document = db_user
    for index in range(30):
        db.add(GrammarQuestion(jlpt_level="N5", question_type="fill_blank", prompt=f"old {index}",
            payload={"options": ["a", "b", "c", "d"]}, correct_answer="a", explanation_vi="valid explanation",
            source="ai", created_by_user_id=user.id, created_at=datetime.now(timezone.utc)))
    db.commit()
    async def should_not_run(*_args): raise AssertionError("LLM should not be called after rate limit")
    monkeypatch.setattr(grammar_practice_service, "generate_raw_questions_from_document", should_not_run)
    result = asyncio.run(grammar_practice.generate_questions_from_library(
        grammar_practice.LibraryGenerateRequest(document_id=document.id, jlpt_level="N5", question_type="fill_blank", count=2), user, db))
    assert result["limited"] is True and result["saved"] == 0


def test_listening_draft_validates_segments(monkeypatch):
    import app.services.listening_from_library as service
    monkeypatch.setattr(service.settings, "llm_provider", "ollama")
    import app.services.ollama_service as ollama_module
    raw = json.dumps({"title": "At school", "description": "A dialogue", "segments": [{"ja": f"日本語{i}", "vi": f"Câu {i}"} for i in range(6)]}, ensure_ascii=False)
    monkeypatch.setattr(ollama_module.ollama_service, "_call_ollama", lambda *_args: raw)
    draft = asyncio.run(service.generate_listening_draft("lesson context", "N5", "school"))
    assert len(draft["segments"]) == 6 and draft["segments"][0]["idx"] == 1
    monkeypatch.setattr(ollama_module.ollama_service, "_call_ollama", lambda *_args: "not json")
    with pytest.raises(ValueError):
        asyncio.run(service.generate_listening_draft("lesson context", "N5", "school"))


def test_listening_library_draft_and_save_and_visibility(db_user, monkeypatch):
    db, user, document = db_user
    async def make_draft(*_args):
        return {"title": "Dialogue", "description": "Short", "segments": [{"idx": i, "ja": f"日{i}", "vi": f"Câu {i}"} for i in range(1, 7)]}
    monkeypatch.setattr(listening, "generate_listening_draft", make_draft)
    draft = asyncio.run(listening.create_library_draft(listening.LibraryDraftRequest(document_id=document.id), user, db))
    saved = listening.save_library_lesson(listening.LibraryLessonSaveRequest(
        document_id=document.id, title=draft["title"], description=draft["description"], jlpt_level=draft["jlpt_level"],
        topic=draft["topic"], segments=draft["segments"]), user, db)
    lesson = db.query(ListeningLesson).filter_by(id=saved["id"]).one()
    other = User(email="other@example.test", username="other", hashed_password="test")
    db.add(other); db.commit()
    assert lesson.source == "library" and lesson.source_document_id == document.id and lesson.created_by == user.id
    assert lesson.is_published and lesson.audio_path is None
    assert listening._library_lesson_visible(lesson, user)
    assert not listening._library_lesson_visible(lesson, other)
    assert not listening._library_lesson_visible(lesson, None)
    seed = ListeningLesson(title="Seed", jlpt_level="N5", topic="General", segments=[], source="seed", is_published=True)
    assert listening._library_lesson_visible(seed, None)


def test_listening_library_document_missing(db_user):
    db, user, _ = db_user
    with pytest.raises(HTTPException) as error:
        asyncio.run(listening.create_library_draft(listening.LibraryDraftRequest(document_id=999), user, db))
    assert error.value.status_code == 404
