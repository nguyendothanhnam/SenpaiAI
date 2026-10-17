"""Add reminder settings, notifications, and push subscriptions.

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _ensure_index(table: str, name: str, columns: list[str]) -> None:
    inspector = inspect(op.get_bind())
    if name not in {index["name"] for index in inspector.get_indexes(table)}:
        op.create_index(name, table, columns)


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "reminder_settings" not in tables:
        op.create_table(
            "reminder_settings",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("timezone", sa.String(100), nullable=False, server_default="Asia/Ho_Chi_Minh"),
            sa.Column("reminder_time", sa.String(5), nullable=False, server_default="20:00"),
            sa.Column("days_of_week", sa.JSON(), nullable=False),
            sa.Column("types", sa.JSON(), nullable=False),
            sa.Column("quiet_start", sa.String(5), nullable=False, server_default="22:00"),
            sa.Column("quiet_end", sa.String(5), nullable=False, server_default="07:00"),
            sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("max_per_day", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("snooze_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    tables = set(inspect(bind).get_table_names())
    if "notifications" not in tables:
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(40), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("url", sa.String(500), nullable=False, server_default="/daily"),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("dedupe_key", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("push_sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("dedupe_key", name="uq_notifications_dedupe_key"),
        )
    tables = set(inspect(bind).get_table_names())
    if "push_subscriptions" not in tables:
        op.create_table(
            "push_subscriptions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("endpoint", sa.Text(), nullable=False),
            sa.Column("p256dh", sa.Text(), nullable=False),
            sa.Column("auth", sa.Text(), nullable=False),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
            sa.UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),
        )
    tables = set(inspect(bind).get_table_names())
    if "notifications" in tables:
        _ensure_index("notifications", "ix_notifications_user_created", ["user_id", "created_at"])
    if "push_subscriptions" in tables:
        _ensure_index("push_subscriptions", "ix_push_subscriptions_user_id", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    for table, index in (("notifications", "ix_notifications_user_created"),
                         ("push_subscriptions", "ix_push_subscriptions_user_id")):
        if table in tables and index in {item["name"] for item in inspect(bind).get_indexes(table)}:
            op.drop_index(index, table_name=table)
    for table in ("push_subscriptions", "notifications", "reminder_settings"):
        if table in tables:
            op.drop_table(table)
