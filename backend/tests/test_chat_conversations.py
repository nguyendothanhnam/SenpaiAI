import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base
from app.models.database import ChatConversation, ChatFolder, ChatHistory, User, VoiceConversation
from app.models.schemas import (
    ChatConversationCreate, ChatConversationRename, ChatFolderCreate, ChatFolderUpdate, ChatHistory as ChatHistorySchema,
    ChatMessage,
)
from app.services.chat_conversations import build_recent_chat_context, group_legacy_chat_rows, normalize_title
from app.api import chat as chat_api
from app.api import chat_conversations as conversations_api


@pytest.fixture
def db_pair():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    tables = [User.__table__, ChatFolder.__table__, ChatConversation.__table__, ChatHistory.__table__, VoiceConversation.__table__]
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    first = User(email="chat-a@example.test", username="chat-a", hashed_password="test")
    second = User(email="chat-b@example.test", username="chat-b", hashed_password="test")
    session.add_all([first, second])
    session.commit()
    ids = first.id, second.id
    yield session, ids
    session.close()
    Base.metadata.drop_all(engine, tables=tables)
    engine.dispose()


def _history(user_id, conversation_id, question, created_at=None):
    return ChatHistory(
        user_id=user_id, conversation_id=conversation_id, question=question, answer=f"answer {question}",
        created_at=created_at or datetime.now(timezone.utc), input_mode="text",
        grammar_points=[], sources=[],
    )


def test_legacy_rows_group_by_user_and_strict_six_hour_gap():
    origin = datetime(2025, 1, 1, tzinfo=timezone.utc)
    rows = [
        SimpleNamespace(id=1, user_id=1, conversation_id=None, input_mode="text", created_at=origin,
                        question=" first\nsecond "),
        SimpleNamespace(id=2, user_id=1, conversation_id=None, input_mode="text", created_at=origin + timedelta(hours=6),
                        question="next"),
        SimpleNamespace(id=3, user_id=1, conversation_id=None, input_mode="text", created_at=origin + timedelta(hours=12, seconds=1),
                        question="later"),
        SimpleNamespace(id=4, user_id=2, conversation_id=None, input_mode="text", created_at=origin,
                        question="other user"),
        SimpleNamespace(id=5, user_id=1, conversation_id=uuid4(), input_mode="voice", created_at=origin,
                        question="voice"),
    ]

    groups = group_legacy_chat_rows(rows, gap_hours=6)

    assert [(group["user_id"], len(group["rows"])) for group in groups] == [(1, 2), (1, 1), (2, 1)]
    assert groups[0]["title"] == "first"


def test_title_is_derived_from_first_nonempty_line_and_truncated():
    assert normalize_title("\n  first   line \nsecond line", 20) == "first line"
    assert len(normalize_title("a" * 40, 20)) == 20


def test_context_uses_only_latest_turns_and_respects_character_limit():
    rows = [SimpleNamespace(question=f"q{i}", answer=f"a{i}") for i in range(5)]
    context = build_recent_chat_context(rows, max_turns=2, max_chars=100)
    assert "q2" not in context and "q3" in context and "q4" in context
    assert len(build_recent_chat_context(rows, max_turns=5, max_chars=15)) <= 15


def test_conversation_and_folder_access_is_scoped_to_owner(db_pair):
    db, (user_a_id, user_b_id) = db_pair
    user_a, user_b = db.get(User, user_a_id), db.get(User, user_b_id)
    conversation = ChatConversation(user_id=user_a_id, title="private", mode="text")
    db.add(conversation)
    db.commit()

    with pytest.raises(HTTPException) as error:
        conversations_api.rename_conversation(
            conversation.id, ChatConversationRename(title="taken"), user_b, db,
        )
    assert error.value.status_code == 404


    with pytest.raises(HTTPException) as error:
        conversations_api._owned_conversation(db, conversation.id, user_b.id)
    assert error.value.status_code == 404


def test_new_conversation_is_created_in_owned_folder_and_stays_there_on_first_message(db_pair):
    from uuid import UUID

    db, (user_id, other_id) = db_pair
    user = db.get(User, user_id)
    user.ui_language = 'vi'
    folder = conversations_api.create_folder(ChatFolderCreate(name='Japanese'), user, db)
    folder_id = UUID(folder['id'])
    created = conversations_api.create_conversation(ChatConversationCreate(folder_id=folder_id), user, db)
    assert created['folder_id'] == str(folder_id)
    assert created['title'] == 'Cuộc trò chuyện mới'
    conversation = chat_api._prepare_text_conversation(db, user, ChatMessage(
        message='First question', conversation_id=UUID(created['id']),
    ))
    db.commit()
    db.expire_all()
    assert conversation.folder_id == folder_id
    assert conversation.title == 'First question'
    assert db.query(ChatConversation).count() == 1
    with pytest.raises(HTTPException) as error:
        conversations_api.create_conversation(ChatConversationCreate(folder_id=folder_id), db.get(User, other_id), db)
    assert error.value.status_code == 404
def test_folder_rename_limits_and_folder_count_limit(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    monkeypatch.setattr(settings, "chat_max_folders", 1)
    monkeypatch.setattr(settings, "chat_folder_name_max_length", 5)
    folder = conversations_api.create_folder(ChatFolderCreate(name="Study"), user, db)
    assert folder["name"] == "Study"
    with pytest.raises(HTTPException) as error:
        conversations_api.create_folder(ChatFolderCreate(name="Other"), user, db)
    assert error.value.status_code == 400
    with pytest.raises(HTTPException) as error:
        conversations_api.rename_folder(__import__("uuid").UUID(folder["id"]), ChatFolderUpdate(name="Too long"), user, db)
    assert error.value.status_code == 422


def test_folder_delete_can_unfile_or_delete_conversations(db_pair):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    folder = ChatFolder(user_id=user_id, name="folder", sort_order=0)
    db.add(folder)
    db.flush()
    keep = ChatConversation(user_id=user_id, folder_id=folder.id, title="keep", mode="text")
    remove = ChatConversation(user_id=user_id, folder_id=folder.id, title="remove", mode="text")
    db.add_all([keep, remove])
    db.flush()
    db.add(_history(user_id, keep.id, "kept message"))
    db.add(_history(user_id, remove.id, "removed message"))
    db.commit()

    conversations_api.delete_folder(folder.id, False, user, db)
    assert db.get(ChatConversation, keep.id).folder_id is None
    assert db.query(ChatHistory).filter(ChatHistory.conversation_id == keep.id).count() == 1

    folder2 = ChatFolder(user_id=user_id, name="delete", sort_order=0)
    db.add(folder2)
    db.flush()
    doomed = ChatConversation(user_id=user_id, folder_id=folder2.id, title="doomed", mode="text")
    db.add(doomed)
    db.flush()
    db.add(_history(user_id, doomed.id, "gone"))
    db.commit()
    conversations_api.delete_folder(folder2.id, True, user, db)
    assert db.get(ChatConversation, doomed.id) is None
    assert db.query(ChatHistory).filter(ChatHistory.conversation_id == doomed.id).count() == 0


def test_message_pages_are_newest_first_with_has_more(db_pair):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    conversation = ChatConversation(user_id=user_id, title="paging", mode="text")
    db.add(conversation)
    db.flush()
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    db.add_all([_history(user_id, conversation.id, str(i), start + timedelta(minutes=i)) for i in range(4)])
    db.commit()

    first = conversations_api.get_conversation_messages(conversation.id, 2, 0, user, db)
    second = conversations_api.get_conversation_messages(conversation.id, 2, 2, user, db)
    assert [item["question"] for item in first["items"]] == ["3", "2"]
    assert first["has_more"] is True
    assert [item["question"] for item in second["items"]] == ["1", "0"]
    assert second["has_more"] is False


def test_legacy_send_creates_conversation_and_context_never_crosses_conversations(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    contexts = []
    monkeypatch.setattr(chat_api, "deterministic_chat_answer", lambda _message: None)
    monkeypatch.setattr(chat_api, "find_single_kanji_request", lambda _message: None)
    monkeypatch.setattr(chat_api.vocab_mcq_service, "try_answer", lambda _message: None)
    monkeypatch.setattr(chat_api.chroma_service, "search_documents", lambda *args, **kwargs: [])
    monkeypatch.setattr(chat_api, "contains_japanese", lambda _text: False)

    async def fake_chat_response(**kwargs):
        contexts.append(kwargs["context"])
        return {"answer": "A plain answer.", "jlpt_level": "N5"}

    monkeypatch.setattr(chat_api.japanese_service, "chat_response", fake_chat_response)

    first = asyncio.run(chat_api.send_message(ChatMessage(message="first question"), user, db))
    second = asyncio.run(chat_api.send_message(
        ChatMessage(message="follow up", conversation_id=first.conversation_id), user, db,
    ))
    separate = asyncio.run(chat_api.send_message(ChatMessage(message="separate topic"), user, db))

    assert first.conversation_id is not None
    assert second.conversation_id == first.conversation_id
    assert separate.conversation_id != first.conversation_id
    assert "first question" in contexts[1]
    assert "first question" not in contexts[2]


def test_sentence_meaning_reaches_llm_and_saves_its_answer(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    question = "今日は何をしましたか。 có nghĩa là gì"
    expected = "Hôm nay bạn đã làm gì?"
    calls = []
    monkeypatch.setattr(chat_api.chroma_service, "search_documents", lambda *args, **kwargs: [])

    async def fake_chat_response(**kwargs):
        calls.append(kwargs)
        return {"answer": expected, "jlpt_level": "N5"}

    monkeypatch.setattr(chat_api.japanese_service, "chat_response", fake_chat_response)
    response = asyncio.run(chat_api.send_message(ChatMessage(message=question), user, db))
    assert len(calls) == 1
    assert calls[0]["question"] == question
    assert expected in response.answer
    assert [source['type'] for source in response.sources] == ['reviewed_translation']
    saved = db.query(ChatHistory).filter(ChatHistory.conversation_id == response.conversation_id).one()
    assert saved.answer == response.answer


def test_legacy_chat_response_schema_remains_compatible():
    response = ChatHistorySchema(
        id=1, question="q", answer="a", created_at=datetime.now(timezone.utc),
    )
    assert response.conversation_id is None


def test_delete_one_chat_turn_preserves_conversation_and_other_turns(db_pair):
    db, (user_id, other_id) = db_pair
    user = db.get(User, user_id)
    other_user = db.get(User, other_id)
    conversation = conversations_api.create_conversation(ChatConversationCreate(title="Keep me"), user, db)
    first = _history(user_id, conversation["id"], "first")
    second = _history(user_id, conversation["id"], "second")
    # ORM UUID columns expect UUID values, not serialized API identifiers.
    from uuid import UUID
    first.conversation_id = second.conversation_id = UUID(conversation["id"])
    db.add_all([first, second])
    db.commit()
    first_id, second_id = first.id, second.id
    with pytest.raises(HTTPException) as error:
        asyncio.run(chat_api.delete_chat_entry(first_id, other_user, db))
    assert error.value.status_code == 404
    assert db.get(ChatHistory, first_id) is not None
    asyncio.run(chat_api.delete_chat_entry(first_id, user, db))
    assert db.get(ChatHistory, first_id) is None
    assert db.get(ChatHistory, second_id).question == "second"
    remaining = conversations_api.get_conversation(UUID(conversation["id"]), user, db)
    assert remaining["message_count"] == 1


def test_particle_question_uses_reviewed_context_without_second_analysis(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    calls = []

    async def generate(**kwargs):
        calls.append(kwargs)
        return {"answer": "**Intent:** GRAMMAR_EXPLANATION\n\n**は** đánh dấu chủ đề; **が** đánh dấu chủ ngữ.", "jlpt_level": "N4"}

    def unexpected(*args, **kwargs):
        pytest.fail("Reviewed particle explanation must not retrieve unrelated material or analyze its own output")

    monkeypatch.setattr(chat_api.japanese_service, "chat_response", generate)
    monkeypatch.setattr(chat_api.japanese_service, "analyze_grammar", unexpected)
    monkeypatch.setattr(chat_api.chroma_service, "search_documents", unexpected)
    response = asyncio.run(chat_api.send_message(ChatMessage(message="Hãy giải thích sự khác nhau giữa は và が."), user, db))
    assert "đánh dấu chủ đề" in calls[0]["context"]
    assert "đánh dấu chủ ngữ" in calls[0]["context"]
    assert "Intent" not in response.answer
    assert response.grammar_points == []
    assert [source["type"] for source in response.sources] == ["grammar_reference"]


def test_english_message_overrides_vietnamese_ui_and_old_conversation(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    user.ui_language = 'vi'
    conversation = conversations_api.create_conversation(ChatConversationCreate(title='Bilingual'), user, db)
    from uuid import UUID
    old = _history(user_id, UUID(conversation['id']), 'Unrelated old question')
    old.answer = 'OLD WRONG ANSWER'
    db.add(old)
    db.commit()
    calls = []

    async def generate(**kwargs):
        calls.append(kwargs)
        return {'answer': 'は marks the topic. が marks the subject.', 'jlpt_level': 'N4'}

    monkeypatch.setattr(chat_api.japanese_service, 'chat_response', generate)
    response = asyncio.run(chat_api.send_message(ChatMessage(
        message='Explain the difference between は and が.',
        conversation_id=UUID(conversation['id']), response_language='vi',
    ), user, db))
    assert calls[0]['response_language'] == 'en'
    assert 'OLD WRONG ANSWER' not in calls[0]['context']
    assert 'marks the topic' in response.answer
    assert 'chủ đề' not in response.answer


def test_failed_generation_does_not_save_an_apology_as_answer(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    monkeypatch.setattr(chat_api.chroma_service, 'search_documents', lambda *args, **kwargs: [])

    async def fail(**kwargs):
        raise RuntimeError('chat_generation_failed')

    monkeypatch.setattr(chat_api.japanese_service, 'chat_response', fail)
    with pytest.raises(HTTPException) as error:
        asyncio.run(chat_api.send_message(ChatMessage(message='Giải thích giúp tôi'), user, db))
    assert error.value.status_code == 503
    assert error.value.detail == 'chat_generation_failed'
    assert db.query(ChatHistory).count() == 0
    assert db.query(ChatConversation).count() == 0


def test_text_conversation_list_does_not_offer_legacy_voice_sessions(db_pair):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    now = datetime.now(timezone.utc)
    db.add(ChatConversation(id=uuid4(), user_id=user_id, title='Voice archive', mode='voice',
                            created_at=now, last_activity_at=now))
    text = ChatConversation(id=uuid4(), user_id=user_id, title='Text', mode='text',
                            created_at=now, last_activity_at=now)
    db.add(text)
    db.commit()
    # Call with explicit values because FastAPI parameter defaults are Query objects.
    result = conversations_api.list_conversations(None, False, False, None, 30, 0, user, db)
    assert result['total'] == 1
    assert [item['id'] for item in result['items']] == [str(text.id)]
    assert db.query(ChatConversation).count() == 2


def test_english_message_overrides_vietnamese_ui_and_old_conversation(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    user.ui_language = 'vi'
    conversation = conversations_api.create_conversation(ChatConversationCreate(title='Bilingual'), user, db)
    from uuid import UUID
    old = _history(user_id, UUID(conversation['id']), 'Unrelated old question')
    old.answer = 'OLD WRONG ANSWER'
    db.add(old)
    db.commit()
    calls = []

    async def generate(**kwargs):
        calls.append(kwargs)
        return {'answer': 'は marks the topic. が marks the subject.', 'jlpt_level': 'N4'}

    monkeypatch.setattr(chat_api.japanese_service, 'chat_response', generate)
    response = asyncio.run(chat_api.send_message(ChatMessage(
        message='Explain the difference between は and が.',
        conversation_id=UUID(conversation['id']), response_language='vi',
    ), user, db))
    assert calls[0]['response_language'] == 'en'
    assert 'OLD WRONG ANSWER' not in calls[0]['context']
    assert 'marks the topic' in response.answer
    assert 'chủ đề' not in response.answer


def test_failed_generation_does_not_save_an_apology_as_answer(db_pair, monkeypatch):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    monkeypatch.setattr(chat_api.chroma_service, 'search_documents', lambda *args, **kwargs: [])

    async def fail(**kwargs):
        raise RuntimeError('chat_generation_failed')

    monkeypatch.setattr(chat_api.japanese_service, 'chat_response', fail)
    with pytest.raises(HTTPException) as error:
        asyncio.run(chat_api.send_message(ChatMessage(message='Giải thích giúp tôi'), user, db))
    assert error.value.status_code == 503
    assert error.value.detail == 'chat_generation_failed'
    assert db.query(ChatHistory).count() == 0
    assert db.query(ChatConversation).count() == 0


def test_text_conversation_list_does_not_offer_legacy_voice_sessions(db_pair):
    db, (user_id, _) = db_pair
    user = db.get(User, user_id)
    now = datetime.now(timezone.utc)
    db.add(ChatConversation(id=uuid4(), user_id=user_id, title='Voice archive', mode='voice',
                            created_at=now, last_activity_at=now))
    text = ChatConversation(id=uuid4(), user_id=user_id, title='Text', mode='text',
                            created_at=now, last_activity_at=now)
    db.add(text)
    db.commit()
    # Call with explicit values because FastAPI parameter defaults are Query objects.
    result = conversations_api.list_conversations(None, False, False, None, 30, 0, user, db)
    assert result['total'] == 1
    assert [item['id'] for item in result['items']] == [str(text.id)]
    assert db.query(ChatConversation).count() == 2
