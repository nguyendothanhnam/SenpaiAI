"""Explicitly consented writing calibration reports."""
from alembic import op
import sqlalchemy as sa

revision = '0023'
down_revision = '0022'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'kanji_writing_reports' not in sa.inspect(bind).get_table_names():
        op.create_table('kanji_writing_reports',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('report_key', sa.String(36), nullable=False),
            sa.Column('attempt_key', sa.String(36), nullable=False),
            sa.Column('kanji', sa.String(1), nullable=False),
            sa.Column('strokes', sa.JSON(), nullable=False),
            sa.Column('result', sa.JSON(), nullable=False),
            sa.Column('comment', sa.String(2000), nullable=False, server_default=''),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint('user_id', 'report_key', name='uq_kanji_writing_report_key'))
    if 'ix_kanji_writing_report_user_time' not in {i['name'] for i in sa.inspect(bind).get_indexes('kanji_writing_reports')}:
        op.create_index('ix_kanji_writing_report_user_time', 'kanji_writing_reports', ['user_id', 'created_at'])


def downgrade():
    bind = op.get_bind()
    if 'kanji_writing_reports' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM kanji_writing_reports LIMIT 1')).first():
            raise RuntimeError('Writing reports exist; archive before downgrade. No data was removed.')
        op.drop_table('kanji_writing_reports')
