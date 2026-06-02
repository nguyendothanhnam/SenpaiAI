"""Add document description

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "description")
