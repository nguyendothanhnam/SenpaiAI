"""Add persistent exercise points to users.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("exercise_points", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "exercise_points")
