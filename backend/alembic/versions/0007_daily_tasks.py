"""Add daily tasks, task items, and study statistics.

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _ensure_index(table: str, name: str, columns: list[str]) -> None:
    inspector = inspect(op.get_bind())
    existing = {index["name"] for index in inspector.get_indexes(table)}
    if name not in existing:
        op.create_index(name, table, columns)


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "daily_tasks" not in tables:
        op.create_table(
            "daily_tasks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("task_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="in_progress"),
            sa.Column("total_items", sa.Integer(), nullable=False),
            sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("points_awarded", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("streak_after", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("status IN ('in_progress', 'completed')", name="ck_daily_tasks_status"),
            sa.UniqueConstraint("user_id", "task_date", name="uq_daily_tasks_user_date"),
        )
    tables = set(inspect(bind).get_table_names())
    if "daily_task_items" not in tables:
        op.create_table(
            "daily_task_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("daily_task_id", sa.Integer(), sa.ForeignKey("daily_tasks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("item_type", sa.String(length=20), nullable=False),
            sa.Column("source_id", sa.String(), nullable=False),
            sa.Column("question_type", sa.String(length=30), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("answer_key", sa.JSON(), nullable=False),
            sa.Column("user_answer", sa.JSON(), nullable=True),
            sa.Column("is_correct", sa.Boolean(), nullable=True),
            sa.Column("time_spent_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("item_type IN ('grammar', 'kanji', 'vocab', 'flashcard')", name="ck_daily_task_items_type"),
            sa.UniqueConstraint("daily_task_id", "position", name="uq_daily_task_item_position"),
        )
    tables = set(inspect(bind).get_table_names())
    if "study_item_stats" not in tables:
        op.create_table(
            "study_item_stats",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_type", sa.String(length=10), nullable=False),
            sa.Column("item_id", sa.String(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("wrong_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_wrong_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("item_type IN ('kanji', 'vocab')", name="ck_study_item_stats_type"),
            sa.UniqueConstraint("user_id", "item_type", "item_id", name="uq_study_item_stat"),
        )

    for table, name, columns in (
        ("daily_tasks", "ix_daily_tasks_user_id", ["user_id"]),
        ("daily_task_items", "ix_daily_task_items_daily_task_id", ["daily_task_id"]),
        ("study_item_stats", "ix_study_item_stats_user_id", ["user_id"]),
    ):
        _ensure_index(table, name, columns)


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    for table, index in (
        ("study_item_stats", "ix_study_item_stats_user_id"),
        ("daily_task_items", "ix_daily_task_items_daily_task_id"),
        ("daily_tasks", "ix_daily_tasks_user_id"),
    ):
        if table in tables and index in {item["name"] for item in inspect(bind).get_indexes(table)}:
            op.drop_index(index, table_name=table)
    for table in ("study_item_stats", "daily_task_items", "daily_tasks"):
        if table in tables:
            op.drop_table(table)
