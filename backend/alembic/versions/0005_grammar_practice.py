"""Add grammar practice question bank and attempts.

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "grammar_questions" not in tables:
        op.create_table(
            "grammar_questions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("grammar_rule_id", sa.Integer(), sa.ForeignKey("grammar_rules.id", ondelete="SET NULL"), nullable=True),
            sa.Column("jlpt_level", sa.String(length=2), nullable=False),
            sa.Column("question_type", sa.String(length=20), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("correct_answer", sa.JSON(), nullable=False),
            sa.Column("accepted_answers", sa.JSON(), nullable=True),
            sa.Column("explanation_vi", sa.Text(), nullable=False),
            sa.Column("examples", sa.JSON(), nullable=False),
            sa.Column("source", sa.String(length=10), nullable=False, server_default="manual"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("question_type IN ('fill_blank', 'reorder', 'true_false', 'conjugation')", name="ck_grammar_question_type"),
            sa.CheckConstraint("source IN ('seed', 'ai', 'manual')", name="ck_grammar_question_source"),
            sa.UniqueConstraint("question_type", "prompt", name="uq_grammar_question_type_prompt"),
        )
        op.create_index("ix_grammar_questions_bank", "grammar_questions", ["jlpt_level", "question_type", "grammar_rule_id"])
    if "grammar_practice_attempts" not in tables:
        op.create_table(
            "grammar_practice_attempts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("learning_session_id", sa.Integer(), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("grammar_questions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("grammar_rule_id", sa.Integer(), sa.ForeignKey("grammar_rules.id", ondelete="SET NULL"), nullable=True),
            sa.Column("jlpt_level", sa.String(length=2), nullable=False),
            sa.Column("question_type", sa.String(length=20), nullable=False),
            sa.Column("user_answer", sa.JSON(), nullable=False),
            sa.Column("is_correct", sa.Boolean(), nullable=False),
            sa.Column("time_spent_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_grammar_practice_attempts_user_created", "grammar_practice_attempts", ["user_id", "created_at"])

    # create_all may have created these tables before this migration ran; repair indexes safely.
    inspector = inspect(op.get_bind())
    for table, index_name, columns in (
        ("grammar_questions", "ix_grammar_questions_bank", ["jlpt_level", "question_type", "grammar_rule_id"]),
        ("grammar_practice_attempts", "ix_grammar_practice_attempts_user_created", ["user_id", "created_at"]),
    ):
        existing_indexes = {index["name"] for index in inspector.get_indexes(table)}
        if index_name not in existing_indexes:
            op.create_index(index_name, table, columns)


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "grammar_practice_attempts" in tables:
        op.drop_table("grammar_practice_attempts")
    if "grammar_questions" in tables:
        op.drop_table("grammar_questions")
