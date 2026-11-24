"""Persist adaptive placement attempts. Revision 0014, after 0013."""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    if "placement_attempts" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "placement_attempts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("language", sa.String(2), nullable=False),
            sa.Column("bank", sa.JSON(), nullable=False),
            sa.Column("questions", sa.JSON(), nullable=False),
            sa.Column("answers", sa.JSON(), nullable=False),
            sa.Column("available_levels", sa.JSON(), nullable=False),
            sa.Column("target_level", sa.String(2), nullable=False),
            sa.Column("skill_scores", sa.JSON()),
            sa.Column("recommended_level", sa.String(2)),
            sa.Column("result", sa.JSON()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        )
    if "ix_placement_attempts_user_created" not in {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes("placement_attempts")
    }:
        op.create_index("ix_placement_attempts_user_created", "placement_attempts", ["user_id", "created_at"])


def downgrade():
    if "placement_attempts" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("placement_attempts")
