"""Shared exercise history, separate from reward anti-replay records."""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "exercise_history" not in tables:
        op.create_table("exercise_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_type", sa.String(32), nullable=False), sa.Column("source_id", sa.String(160), nullable=False),
            sa.Column("fingerprint", sa.String(64), nullable=False), sa.Column("normalized_content", sa.Text(), nullable=False),
            sa.Column("jlpt_level", sa.String(2), nullable=False), sa.Column("skill", sa.String(24), nullable=False),
            sa.Column("served_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_served_at", sa.DateTime(timezone=True), nullable=False), sa.Column("last_result", sa.Boolean()),
            sa.Column("last_answered_at", sa.DateTime(timezone=True)),
            sa.Column("correct_streak", sa.Integer(), nullable=False, server_default="0"), sa.Column("due_at", sa.DateTime(timezone=True)),
            sa.Column("last_context", sa.String(32), nullable=False),
            sa.UniqueConstraint("user_id", "source_type", "source_id", name="uq_exercise_history_source"))
    if "exercise_deliveries" not in tables:
        op.create_table("exercise_deliveries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("history_id", sa.Integer(), sa.ForeignKey("exercise_history.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_type", sa.String(32), nullable=False), sa.Column("source_id", sa.String(160), nullable=False),
            sa.Column("context", sa.String(32), nullable=False), sa.Column("context_ref", sa.String(160), nullable=False),
            sa.Column("served_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("answered_at", sa.DateTime(timezone=True)), sa.Column("result", sa.Boolean()),
            sa.UniqueConstraint("user_id", "context", "context_ref", "source_type", "source_id", name="uq_exercise_delivery_ref"))
    for table, name, columns in (
        ("exercise_history", "ix_exercise_history_user_fingerprint", ["user_id", "fingerprint"]),
        ("exercise_history", "ix_exercise_history_user_last_served", ["user_id", "last_served_at"]),
        ("exercise_deliveries", "ix_exercise_deliveries_user_context", ["user_id", "context", "context_ref"]),
        ("exercise_deliveries", "ix_exercise_deliveries_history", ["history_id"]),
    ):
        if name not in {index["name"] for index in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    for table in ("exercise_deliveries", "exercise_history"):
        if table in tables and bind.execute(sa.text(f"SELECT 1 FROM {table} LIMIT 1")).first():
            raise RuntimeError("Exercise history exists; archive it before downgrade. No data was removed.")
    for table in ("exercise_deliveries", "exercise_history"):
        if table in tables:
            op.drop_table(table)
