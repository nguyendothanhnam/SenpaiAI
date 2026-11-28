"""Immutable private Learn/Test snapshots."""
from alembic import op
import sqlalchemy as sa
revision = '0025'
down_revision = '0024'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'flashcard_assessments' not in sa.inspect(bind).get_table_names():
        op.create_table('flashcard_assessments',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('deck_id', sa.Integer, sa.ForeignKey('flashcard_decks.id', ondelete='CASCADE'), nullable=False),
            sa.Column('request_key', sa.String(64), nullable=False), sa.Column('payload_hash', sa.String(64), nullable=False),
            sa.Column('mode', sa.String(12), nullable=False), sa.Column('status', sa.String(12), nullable=False),
            sa.Column('questions', sa.JSON, nullable=False), sa.Column('result', sa.JSON), sa.Column('submission_hash', sa.String(64)),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint('user_id', 'request_key', name='uq_flashcard_assessment_request'))
    if 'ix_flashcard_assessment_owner_time' not in {i['name'] for i in sa.inspect(bind).get_indexes('flashcard_assessments')}:
        op.create_index('ix_flashcard_assessment_owner_time', 'flashcard_assessments', ['user_id', 'created_at'])


def downgrade():
    bind = op.get_bind()
    if 'flashcard_assessments' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM flashcard_assessments LIMIT 1')).first():
            raise RuntimeError('Archive flashcard assessments before downgrade; no data removed.')
        op.drop_table('flashcard_assessments')
