"""Weekly goals and bounded learner-history query indexes."""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = depends_on = None
INDEXES = (
    ("chat_history", "ix_learning_chat_user_time", ["user_id", "created_at"]),
    ("learning_sessions", "ix_learning_session_user_time", ["user_id", "created_at"]),
    ("study_item_stats", "ix_learning_stat_user_time", ["user_id", "last_seen_at"]),
    ("voice_conversations", "ix_learning_voice_user_time", ["user_id", "started_at"]),
)


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "weekly_learning_goals" not in tables:
        op.create_table("weekly_learning_goals",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("study_days", sa.Integer(), nullable=False, server_default="4"),
            sa.Column("lessons", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("study_days BETWEEN 1 AND 7", name="ck_weekly_learning_goal_days"),
            sa.CheckConstraint("lessons BETWEEN 1 AND 100", name="ck_weekly_learning_goal_lessons"))
    for table, name, columns in INDEXES:
        if table in tables and name not in {row["name"] for row in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "weekly_learning_goals" in tables and bind.execute(sa.text("SELECT 1 FROM weekly_learning_goals LIMIT 1")).first():
        raise RuntimeError("Learning goals exist; archive before downgrade. No data was removed.")
    for table, name, _ in reversed(INDEXES):
        if table in tables and name in {row["name"] for row in sa.inspect(bind).get_indexes(table)}:
            op.drop_index(name, table_name=table)
    if "weekly_learning_goals" in tables:
        op.drop_table("weekly_learning_goals")
