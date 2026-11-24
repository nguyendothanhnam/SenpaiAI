"""Versioned placement sessions, reviewed questions and immutable item snapshots."""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

ATTEMPT_COLUMNS = [
    sa.Column("assessment_mode", sa.String(24), nullable=False, server_default="legacy"),
    sa.Column("selected_level", sa.String(2)), sa.Column("estimated_level", sa.String(2)),
    sa.Column("expires_at", sa.DateTime(timezone=True)), sa.Column("total_score", sa.Float()),
    sa.Column("scoring_version", sa.String(30), nullable=False, server_default="legacy-v1"),
    sa.Column("estimation_version", sa.String(30), nullable=False, server_default="legacy-v1"),
    sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
]


def upgrade():
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("placement_attempts")}
    for column in ATTEMPT_COLUMNS:
        if column.name not in existing:
            op.add_column("placement_attempts", column.copy())
    tables = set(sa.inspect(bind).get_table_names())
    if "placement_stimuli" not in tables:
        op.create_table("placement_stimuli",
            sa.Column("id", sa.Integer(), primary_key=True), sa.Column("source_key", sa.String(160), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False), sa.Column("kind", sa.String(12), nullable=False),
            sa.Column("content", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("source_key", "version", name="uq_placement_stimulus_version"))
    if "placement_questions" not in tables:
        op.create_table("placement_questions",
            sa.Column("id", sa.Integer(), primary_key=True), sa.Column("source_key", sa.String(160), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False), sa.Column("level", sa.String(2), nullable=False),
            sa.Column("skill", sa.String(12), nullable=False), sa.Column("question_type", sa.String(20), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False), sa.Column("answer_key", sa.JSON(), nullable=False),
            sa.Column("explanation", sa.JSON(), nullable=False), sa.Column("difficulty", sa.Integer(), nullable=False),
            sa.Column("source", sa.JSON(), nullable=False), sa.Column("publication_status", sa.String(16), nullable=False),
            sa.Column("is_demo", sa.Boolean(), nullable=False),
            sa.Column("stimulus_id", sa.Integer(), sa.ForeignKey("placement_stimuli.id")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("source_key", "version", name="uq_placement_question_version"))
    if "placement_attempt_items" not in tables:
        op.create_table("placement_attempt_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("attempt_id", sa.Integer(), sa.ForeignKey("placement_attempts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("placement_questions.id")),
            sa.Column("source_key", sa.String(160), nullable=False), sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("snapshot", sa.JSON(), nullable=False), sa.Column("user_answer", sa.JSON()),
            sa.Column("is_correct", sa.Boolean()), sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("answered_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("attempt_id", "source_key", name="uq_placement_attempt_source"),
            sa.UniqueConstraint("attempt_id", "position", name="uq_placement_attempt_position"))
    for table, name, columns in [
        ("placement_questions", "ix_placement_question_published", ["publication_status", "level", "skill"]),
        ("placement_attempt_items", "ix_placement_attempt_items_attempt_id", ["attempt_id"]),
    ]:
        if name not in {index["name"] for index in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    for table in ("placement_attempt_items", "placement_questions", "placement_stimuli"):
        if table in tables and bind.execute(sa.text(f"SELECT 1 FROM {table} LIMIT 1")).first():
            raise RuntimeError("Placement v2 data exists. Export/archive it before downgrading; no data was removed.")
    columns = {column["name"] for column in sa.inspect(bind).get_columns("placement_attempts")}
    if "assessment_mode" in columns and bind.execute(sa.text("SELECT 1 FROM placement_attempts WHERE assessment_mode <> 'legacy' LIMIT 1")).first():
        raise RuntimeError("Placement v2 history must be archived before downgrade; no data was removed.")
    for table in ("placement_attempt_items", "placement_questions", "placement_stimuli"):
        if table in tables:
            op.drop_table(table)
    to_remove = [column.name for column in ATTEMPT_COLUMNS if column.name in columns]
    if to_remove:
        with op.batch_alter_table("placement_attempts") as batch:
            for name in reversed(to_remove):
                batch.drop_column(name)
