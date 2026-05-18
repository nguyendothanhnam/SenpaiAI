"""Add kanji and normalized vocabulary relations

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.add_column("vocabulary", sa.Column("romaji", sa.String(), nullable=True))
    op.add_column("vocabulary", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("vocabulary", "reading", existing_type=sa.String(), nullable=False)
    op.create_index(op.f("ix_vocabulary_japanese_word"), "vocabulary", ["japanese_word"], unique=False)
    op.create_index(op.f("ix_vocabulary_jlpt_level"), "vocabulary", ["jlpt_level"], unique=False)
    op.create_index(op.f("ix_vocabulary_reading"), "vocabulary", ["reading"], unique=False)
    op.create_unique_constraint("uq_vocabulary_word_reading", "vocabulary", ["japanese_word", "reading"])
    op.create_check_constraint(
        "ck_vocabulary_jlpt_level",
        "vocabulary",
        "jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')",
    )

    op.create_table(
        "kanji",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character", sa.String(length=1), nullable=False),
        sa.Column("meaning_vi", sa.Text(), nullable=False),
        sa.Column("jlpt_level", sa.String(length=2), nullable=False),
        sa.Column("stroke_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_length(character) = 1", name="ck_kanji_single_character"),
        sa.CheckConstraint("jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')", name="ck_kanji_jlpt_level"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_kanji_character"), "kanji", ["character"], unique=True)
    op.create_index(op.f("ix_kanji_id"), "kanji", ["id"], unique=False)
    op.create_index(op.f("ix_kanji_jlpt_level"), "kanji", ["jlpt_level"], unique=False)

    op.create_table(
        "kanji_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kanji_id", sa.Integer(), nullable=False),
        sa.Column("reading_type", sa.String(length=10), nullable=False),
        sa.Column("reading", sa.String(), nullable=False),
        sa.Column("romaji", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.CheckConstraint("reading_type IN ('onyomi', 'kunyomi')", name="ck_kanji_reading_type"),
        sa.ForeignKeyConstraint(["kanji_id"], ["kanji.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kanji_id", "reading_type", "reading", name="uq_kanji_reading"),
    )
    op.create_index(op.f("ix_kanji_readings_id"), "kanji_readings", ["id"], unique=False)
    op.create_index(op.f("ix_kanji_readings_kanji_id"), "kanji_readings", ["kanji_id"], unique=False)
    op.create_index(op.f("ix_kanji_readings_reading"), "kanji_readings", ["reading"], unique=False)
    op.create_index(op.f("ix_kanji_readings_reading_type"), "kanji_readings", ["reading_type"], unique=False)

    op.create_table(
        "kanji_examples",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kanji_id", sa.Integer(), nullable=False),
        sa.Column("sentence", sa.Text(), nullable=False),
        sa.Column("reading", sa.Text(), nullable=False),
        sa.Column("romaji", sa.Text(), nullable=True),
        sa.Column("meaning_vi", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["kanji_id"], ["kanji.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_kanji_examples_id"), "kanji_examples", ["id"], unique=False)
    op.create_index(op.f("ix_kanji_examples_kanji_id"), "kanji_examples", ["kanji_id"], unique=False)

    op.create_table(
        "vocabulary_kanji",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vocabulary_id", sa.Integer(), nullable=False),
        sa.Column("kanji_id", sa.Integer(), nullable=False),
        sa.Column("position_in_word", sa.Integer(), nullable=False),
        sa.CheckConstraint("position_in_word > 0", name="ck_vocabulary_kanji_position_positive"),
        sa.ForeignKeyConstraint(["kanji_id"], ["kanji.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["vocabulary_id"], ["vocabulary.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "vocabulary_id",
            "kanji_id",
            "position_in_word",
            name="uq_vocabulary_kanji_position",
        ),
    )
    op.create_index(op.f("ix_vocabulary_kanji_id"), "vocabulary_kanji", ["id"], unique=False)
    op.create_index(op.f("ix_vocabulary_kanji_kanji_id"), "vocabulary_kanji", ["kanji_id"], unique=False)
    op.create_index(op.f("ix_vocabulary_kanji_vocabulary_id"), "vocabulary_kanji", ["vocabulary_id"], unique=False)

    op.execute("CREATE INDEX ix_kanji_meaning_vi_trgm ON kanji USING gin (meaning_vi gin_trgm_ops)")
    op.execute("CREATE INDEX ix_kanji_readings_reading_trgm ON kanji_readings USING gin (reading gin_trgm_ops)")
    op.execute("CREATE INDEX ix_kanji_readings_romaji_trgm ON kanji_readings USING gin (romaji gin_trgm_ops)")
    op.execute("CREATE INDEX ix_vocabulary_japanese_word_trgm ON vocabulary USING gin (japanese_word gin_trgm_ops)")
    op.execute("CREATE INDEX ix_vocabulary_reading_trgm ON vocabulary USING gin (reading gin_trgm_ops)")
    op.execute("CREATE INDEX ix_vocabulary_meaning_trgm ON vocabulary USING gin (meaning gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vocabulary_meaning_trgm")
    op.execute("DROP INDEX IF EXISTS ix_vocabulary_reading_trgm")
    op.execute("DROP INDEX IF EXISTS ix_vocabulary_japanese_word_trgm")
    op.execute("DROP INDEX IF EXISTS ix_kanji_readings_romaji_trgm")
    op.execute("DROP INDEX IF EXISTS ix_kanji_readings_reading_trgm")
    op.execute("DROP INDEX IF EXISTS ix_kanji_meaning_vi_trgm")

    op.drop_index(op.f("ix_vocabulary_kanji_vocabulary_id"), table_name="vocabulary_kanji")
    op.drop_index(op.f("ix_vocabulary_kanji_kanji_id"), table_name="vocabulary_kanji")
    op.drop_index(op.f("ix_vocabulary_kanji_id"), table_name="vocabulary_kanji")
    op.drop_table("vocabulary_kanji")

    op.drop_index(op.f("ix_kanji_examples_kanji_id"), table_name="kanji_examples")
    op.drop_index(op.f("ix_kanji_examples_id"), table_name="kanji_examples")
    op.drop_table("kanji_examples")

    op.drop_index(op.f("ix_kanji_readings_reading_type"), table_name="kanji_readings")
    op.drop_index(op.f("ix_kanji_readings_reading"), table_name="kanji_readings")
    op.drop_index(op.f("ix_kanji_readings_kanji_id"), table_name="kanji_readings")
    op.drop_index(op.f("ix_kanji_readings_id"), table_name="kanji_readings")
    op.drop_table("kanji_readings")

    op.drop_index(op.f("ix_kanji_jlpt_level"), table_name="kanji")
    op.drop_index(op.f("ix_kanji_id"), table_name="kanji")
    op.drop_index(op.f("ix_kanji_character"), table_name="kanji")
    op.drop_table("kanji")

    op.drop_constraint("ck_vocabulary_jlpt_level", "vocabulary", type_="check")
    op.drop_constraint("uq_vocabulary_word_reading", "vocabulary", type_="unique")
    op.drop_index(op.f("ix_vocabulary_reading"), table_name="vocabulary")
    op.drop_index(op.f("ix_vocabulary_jlpt_level"), table_name="vocabulary")
    op.drop_index(op.f("ix_vocabulary_japanese_word"), table_name="vocabulary")
    op.alter_column("vocabulary", "reading", existing_type=sa.String(), nullable=True)
    op.drop_column("vocabulary", "updated_at")
    op.drop_column("vocabulary", "romaji")
