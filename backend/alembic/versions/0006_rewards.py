"""Add points, streak profiles, transactions, and unlocked shop items.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "user_game_profiles" not in tables:
        op.create_table(
            "user_game_profiles",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("points_balance", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_completed_date", sa.Date(), nullable=True),
            sa.Column("active_theme_id", sa.String(), nullable=False, server_default="classic"),
            sa.Column("active_background_id", sa.String(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("points_balance >= 0", name="ck_user_game_profiles_balance_nonnegative"),
        )
    tables = set(inspect(bind).get_table_names())
    if "point_transactions" not in tables:
        op.create_table(
            "point_transactions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(), nullable=False),
            sa.Column("ref_type", sa.String(), nullable=True),
            sa.Column("ref_id", sa.String(), nullable=True),
            sa.Column("idempotency_key", sa.String(), nullable=False),
            sa.Column("balance_after", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("amount <> 0", name="ck_point_transactions_amount_nonzero"),
            sa.UniqueConstraint("idempotency_key", name="uq_point_transactions_idempotency_key"),
        )
    tables = set(inspect(bind).get_table_names())
    if "user_unlocked_items" not in tables:
        op.create_table(
            "user_unlocked_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_type", sa.String(), nullable=False),
            sa.Column("item_id", sa.String(), nullable=False),
            sa.Column("price_paid", sa.Integer(), nullable=False),
            sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("item_type IN ('theme', 'background')", name="ck_user_unlocked_items_type"),
            sa.UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_unlocked_item"),
        )
    indexes = {i["name"] for i in inspect(bind).get_indexes("point_transactions")}
    if "ix_point_transactions_user_created" not in indexes:
        op.create_index("ix_point_transactions_user_created", "point_transactions", ["user_id", "created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "user_unlocked_items" in tables:
        op.drop_table("user_unlocked_items")
    if "point_transactions" in tables:
        indexes = {i["name"] for i in inspect(bind).get_indexes("point_transactions")}
        if "ix_point_transactions_user_created" in indexes:
            op.drop_index("ix_point_transactions_user_created", table_name="point_transactions")
        op.drop_table("point_transactions")
    if "user_game_profiles" in tables:
        op.drop_table("user_game_profiles")
