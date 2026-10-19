"""Link grammar questions and listening lessons to Library documents.

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def _add_source_document(table: str) -> None:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns(table)}
    if "source_document_id" not in columns:
        op.add_column(table, sa.Column(
            "source_document_id",
            sa.Integer(),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ))
    indexes = {index["name"] for index in inspect(op.get_bind()).get_indexes(table)}
    index_name = f"ix_{table}_source_document_id"
    if index_name not in indexes:
        op.create_index(index_name, table, ["source_document_id"], unique=False)


def upgrade() -> None:
    _add_source_document("grammar_questions")
    _add_source_document("listening_lessons")


def downgrade() -> None:
    for table in ("listening_lessons", "grammar_questions"):
        inspector = inspect(op.get_bind())
        if table not in inspector.get_table_names():
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "source_document_id" not in columns:
            continue
        index_name = f"ix_{table}_source_document_id"
        indexes = {index["name"] for index in inspector.get_indexes(table)}
        if index_name in indexes:
            op.drop_index(index_name, table_name=table)
        op.drop_column(table, "source_document_id")
