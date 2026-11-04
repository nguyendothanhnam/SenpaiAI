import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def _load_migration():
    path = Path(__file__).parents[1] / "alembic" / "versions" / "0013_chat_conversations.py"
    spec = importlib.util.spec_from_file_location("chat_conversations_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_backfill_is_repeatable_and_preserves_voice_ids():
    migration = _load_migration()
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    users = sa.Table("users", metadata, sa.Column("id", sa.Integer, primary_key=True))
    chat = sa.Table(
        "chat_history", metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("answer", sa.Text, nullable=False),
        sa.Column("input_mode", sa.String(20)),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    voice = sa.Table(
        "voice_conversations", metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("scenario_id", sa.String(80)),
        sa.Column("jlpt_level", sa.String(2)),
        sa.Column("status", sa.String(20)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("summary", sa.JSON),
    )
    metadata.create_all(engine)
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    voice_id = uuid4()
    with engine.begin() as connection:
        connection.execute(users.insert(), [{"id": 1}])
        connection.execute(voice.insert(), [{
            "id": voice_id, "user_id": 1, "scenario_id": "free", "jlpt_level": "N5",
            "status": "ended", "started_at": start, "ended_at": start + timedelta(minutes=5),
        }])
        connection.execute(chat.insert(), [
            {"id": 1, "user_id": 1, "question": "First question\nmore", "answer": "a", "input_mode": "text", "conversation_id": None, "created_at": start},
            {"id": 2, "user_id": 1, "question": "Follow up", "answer": "a", "input_mode": "text", "conversation_id": None, "created_at": start + timedelta(hours=6)},
            {"id": 3, "user_id": 1, "question": "Later", "answer": "a", "input_mode": "text", "conversation_id": None, "created_at": start + timedelta(hours=12, seconds=1)},
            {"id": 4, "user_id": 1, "question": "Spoken", "answer": "a", "input_mode": "voice", "conversation_id": voice_id, "created_at": start + timedelta(minutes=1)},
        ])

        original_op = migration.op
        migration.op = Operations(MigrationContext.configure(connection))
        try:
            migration.upgrade()
            migration.upgrade()
        finally:
            migration.op = original_op

        conversations = sa.Table("chat_conversations", sa.MetaData(), autoload_with=connection)
        result = connection.execute(sa.select(conversations)).mappings().all()
        assigned = connection.execute(sa.select(chat.c.id, chat.c.conversation_id)).all()

    assert len(result) == 3
    assert len({row["id"] for row in result}) == 3
    voice_record = next(row for row in result if row["mode"] == "voice")
    assert str(voice_record["id"]).replace("-", "") == voice_id.hex
    assert voice_record["created_at"].replace(tzinfo=timezone.utc) == start
    assert all(row[1] is not None for row in assigned)
    engine.dispose()
