"""Add voice conversation metadata and conversations table.

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "chat_history" in tables:
        columns = {c["name"] for c in inspector.get_columns("chat_history")}
        with op.batch_alter_table("chat_history") as batch:
            if "input_mode" not in columns:
                batch.add_column(sa.Column("input_mode", sa.String(20), nullable=True, server_default="text"))
            if "conversation_id" not in columns:
                batch.add_column(sa.Column("conversation_id", sa.Uuid(), nullable=True))
            if "scenario" not in columns:
                batch.add_column(sa.Column("scenario", sa.String(80), nullable=True))
            if "feedback" not in columns:
                batch.add_column(sa.Column("feedback", sa.JSON(), nullable=True))
        if "ix_chat_history_conversation_id" not in {i["name"] for i in inspect(bind).get_indexes("chat_history")}:
            op.create_index("ix_chat_history_conversation_id", "chat_history", ["conversation_id"])
    if "voice_conversations" not in tables:
        op.create_table(
            "voice_conversations",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("scenario_id", sa.String(80), nullable=False),
            sa.Column("jlpt_level", sa.String(2), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("summary", sa.JSON(), nullable=True),
        )
        op.create_index("ix_voice_conversations_user_id", "voice_conversations", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "voice_conversations" in tables:
        op.drop_table("voice_conversations")
    if "chat_history" in tables:
        cols = {c["name"] for c in inspect(bind).get_columns("chat_history")}
        if "ix_chat_history_conversation_id" in {i["name"] for i in inspect(bind).get_indexes("chat_history")}:
            op.drop_index("ix_chat_history_conversation_id", table_name="chat_history")
        with op.batch_alter_table("chat_history") as batch:
            for name in ("feedback", "scenario", "conversation_id", "input_mode"):
                if name in cols:
                    batch.drop_column(name)
