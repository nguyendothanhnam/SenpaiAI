"""Add shared chat conversations/folders and group legacy chat history.

Revision ID: 0013
Revises: 0012
"""
from datetime import datetime, timezone
from types import SimpleNamespace

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.core.config import settings
from app.services.chat_conversations import group_legacy_chat_rows
from app.services.voice_scenarios import SCENARIOS

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _uuid_for_database(connection, value):
    # Reflected SQLite UUID columns are CHAR(32); PostgreSQL uses native UUID.
    return value.hex if connection.dialect.name == "sqlite" and hasattr(value, "hex") else value


def _ensure_index(table: str, name: str, columns: list[str]) -> None:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return
    indexes = {item["name"] for item in inspector.get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, unique=False)


def _create_tables() -> None:
    inspector = inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "chat_folders" not in tables:
        op.create_table(
            "chat_folders",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    if "chat_conversations" not in tables:
        op.create_table(
            "chat_conversations",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("folder_id", sa.Uuid(), sa.ForeignKey("chat_folders.id", ondelete="SET NULL"), nullable=True),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("title_is_auto", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("mode", sa.String(10), nullable=False, server_default="text"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    _ensure_index("chat_folders", "ix_chat_folders_user_id", ["user_id"])
    for name, columns in (
        ("ix_chat_conversations_user_id", ["user_id"]),
        ("ix_chat_conversations_folder_id", ["folder_id"]),
        ("ix_chat_conversations_user_activity", ["user_id", "last_activity_at"]),
        ("ix_chat_conversations_user_folder", ["user_id", "folder_id"]),
        ("ix_chat_conversations_user_pinned", ["user_id", "is_pinned"]),
    ):
        _ensure_index("chat_conversations", name, columns)

    inspector = inspect(op.get_bind())
    if "chat_history" in inspector.get_table_names():
        indexes = {item["name"] for item in inspector.get_indexes("chat_history")}
        if "ix_chat_history_conversation_time" not in indexes:
            op.create_index(
                "ix_chat_history_conversation_time", "chat_history",
                ["conversation_id", "created_at", "id"], unique=False,
            )


def _backfill_voice_conversations(connection) -> None:
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    if "voice_conversations" not in tables:
        return
    voice = sa.Table("voice_conversations", sa.MetaData(), autoload_with=connection)
    chat = sa.Table("chat_history", sa.MetaData(), autoload_with=connection)
    conversations = sa.Table("chat_conversations", sa.MetaData(), autoload_with=connection)
    existing = {row.id for row in connection.execute(sa.select(conversations.c.id))}
    voice_rows = connection.execute(sa.select(voice)).mappings().all()
    for row in voice_rows:
        conversation_id = row["id"]
        if conversation_id in existing:
            continue
        turns = connection.execute(sa.select(chat.c.created_at).where(
            chat.c.user_id == row["user_id"], chat.c.conversation_id == conversation_id
        ).order_by(chat.c.created_at.desc(), chat.c.id.desc())).all()
        last_activity = turns[0][0] if turns else row["started_at"]
        scenario_id = row.get("scenario_id") or ""
        scenario_title = SCENARIOS.get(scenario_id, {}).get("name") or scenario_id.replace("_", " ").strip() or "Voice conversation"
        connection.execute(conversations.insert().values(
            id=_uuid_for_database(connection, conversation_id),
            user_id=row["user_id"],
            folder_id=None,
            title=scenario_title[:settings.chat_conversation_title_max_length] or "Voice conversation",
            title_is_auto=False,
            is_pinned=False,
            mode="voice",
            created_at=row["started_at"] or datetime.now(timezone.utc),
            last_activity_at=last_activity or row["started_at"] or datetime.now(timezone.utc),
        ))
        existing.add(conversation_id)

    # Preserve orphaned legacy voice turns too, using their existing UUID.
    rows = connection.execute(sa.select(chat).where(
        chat.c.conversation_id.is_not(None), chat.c.input_mode == "voice"
    )).mappings().all()
    for row in rows:
        conversation_id = row["conversation_id"]
        if conversation_id in existing:
            continue
        connection.execute(conversations.insert().values(
            id=_uuid_for_database(connection, conversation_id), user_id=row["user_id"], folder_id=None,
            title="Voice conversation", title_is_auto=False, is_pinned=False,
            mode="voice", created_at=row["created_at"], last_activity_at=row["created_at"],
        ))
        existing.add(conversation_id)


def _backfill_legacy_text(connection) -> None:
    chat = sa.Table("chat_history", sa.MetaData(), autoload_with=connection)
    conversations = sa.Table("chat_conversations", sa.MetaData(), autoload_with=connection)
    rows = [SimpleNamespace(**dict(row)) for row in connection.execute(
        sa.select(chat).where(chat.c.conversation_id.is_(None))
    ).mappings().all()]
    groups = group_legacy_chat_rows(rows)
    for group in groups:
        connection.execute(conversations.insert().values(
            id=_uuid_for_database(connection, group["id"]), user_id=group["user_id"], folder_id=None,
            title=group["title"][:settings.chat_conversation_title_max_length], title_is_auto=True, is_pinned=False,
            mode=group["mode"], created_at=group["created_at"], last_activity_at=group["last_activity_at"],
        ))
        connection.execute(chat.update().where(
            chat.c.id.in_([row.id for row in group["rows"]])
        ).values(conversation_id=_uuid_for_database(connection, group["id"])))


def upgrade() -> None:
    _create_tables()
    connection = op.get_bind()
    _backfill_voice_conversations(connection)
    _backfill_legacy_text(connection)


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "chat_history" in tables:
        indexes = {item["name"] for item in inspect(op.get_bind()).get_indexes("chat_history")}
        if "ix_chat_history_conversation_time" in indexes:
            op.drop_index("ix_chat_history_conversation_time", table_name="chat_history")
    if "chat_conversations" in tables:
        if "chat_history" in tables:
            chat = sa.Table("chat_history", sa.MetaData(), autoload_with=op.get_bind())
            conversations = sa.Table("chat_conversations", sa.MetaData(), autoload_with=op.get_bind())
            text_ids = sa.select(conversations.c.id).where(conversations.c.mode == "text")
            op.get_bind().execute(chat.update().where(chat.c.conversation_id.in_(text_ids)).values(conversation_id=None))
        for index in (
            "ix_chat_conversations_user_pinned", "ix_chat_conversations_user_folder",
            "ix_chat_conversations_user_activity", "ix_chat_conversations_folder_id",
            "ix_chat_conversations_user_id",
        ):
            indexes = {item["name"] for item in inspect(op.get_bind()).get_indexes("chat_conversations")}
            if index in indexes:
                op.drop_index(index, table_name="chat_conversations")
        op.drop_table("chat_conversations")
    if "chat_folders" in tables:
        indexes = {item["name"] for item in inspect(op.get_bind()).get_indexes("chat_folders")}
        if "ix_chat_folders_user_id" in indexes:
            op.drop_index("ix_chat_folders_user_id", table_name="chat_folders")
        op.drop_table("chat_folders")
