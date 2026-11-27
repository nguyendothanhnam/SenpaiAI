"""Official video embeds and user-supplied subtitle metadata."""
from alembic import op
import sqlalchemy as sa

revision = '0028'
down_revision = '0027'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {item['name'] for item in sa.inspect(bind).get_columns('listening_lessons')}
    for name, kind in [('video_url', sa.String(500)), ('video_provider', sa.String(20)), ('video_id', sa.String(64)), ('source_note', sa.Text())]:
        if name not in columns:
            op.add_column('listening_lessons', sa.Column(name, kind, nullable=True))


def downgrade():
    bind = op.get_bind()
    columns = {item['name'] for item in sa.inspect(bind).get_columns('listening_lessons')}
    if 'video_id' in columns and bind.execute(sa.text('SELECT 1 FROM listening_lessons WHERE video_id IS NOT NULL LIMIT 1')).first():
        raise RuntimeError('Archive video lessons before downgrade; no data removed.')
    for name in ['source_note', 'video_id', 'video_provider', 'video_url']:
        if name in columns:
            op.drop_column('listening_lessons', name)
