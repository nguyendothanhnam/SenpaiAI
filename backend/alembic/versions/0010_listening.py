"""Add listening lesson catalog and attempts.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "listening_lessons" not in tables:
        op.create_table(
            "listening_lessons",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("jlpt_level", sa.String(2), nullable=False),
            sa.Column("topic", sa.String(80), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("segments", sa.JSON(), nullable=False),
            sa.Column("audio_path", sa.String(255), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("source", sa.String(20), nullable=False, server_default="seed"),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    tables = set(inspect(bind).get_table_names())
    if "listening_attempts" not in tables:
        op.create_table(
            "listening_attempts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("listening_lessons.id", ondelete="CASCADE"), nullable=False),
            sa.Column("mode", sa.String(20), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("mode IN ('dictation', 'comprehension', 'cloze')", name="ck_listening_attempts_mode"),
        )
    tables = set(inspect(bind).get_table_names())
    if "listening_lessons" in tables:
        indexes = {i["name"] for i in inspect(bind).get_indexes("listening_lessons")}
        for name, col in (("ix_listening_lessons_jlpt_level", "jlpt_level"), ("ix_listening_lessons_topic", "topic")):
            if name not in indexes:
                op.create_index(name, "listening_lessons", [col])
    if "listening_attempts" in tables:
        indexes = {i["name"] for i in inspect(bind).get_indexes("listening_attempts")}
        for name, columns in (
            ("ix_listening_attempts_user_id", ["user_id"]),
            ("ix_listening_attempts_lesson_id", ["lesson_id"]),
            ("ix_listening_attempts_user_created", ["user_id", "created_at"]),
        ):
            if name not in indexes:
                op.create_index(name, "listening_attempts", columns)


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "listening_attempts" in tables:
        op.drop_table("listening_attempts")
    if "listening_lessons" in tables:
        op.drop_table("listening_lessons")
