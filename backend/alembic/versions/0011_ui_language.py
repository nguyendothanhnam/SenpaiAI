"""Persist a user's preferred interface language.

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("users")}
    if "ui_language" not in columns:
        op.add_column("users", sa.Column("ui_language", sa.String(length=2), nullable=True))


def downgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("users")}
    if "ui_language" in columns:
        op.drop_column("users", "ui_language")
