"""Persist per-stroke writing evaluations without raw handwriting coordinates."""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'kanji_writing_attempts' not in sa.inspect(bind).get_table_names():
        op.create_table('kanji_writing_attempts',
            sa.Column('id',sa.Integer(),primary_key=True),
            sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
            sa.Column('attempt_key',sa.String(36),nullable=False),
            sa.Column('kanji',sa.String(1),nullable=False),
            sa.Column('jlpt_level',sa.String(2),nullable=False),
            sa.Column('mode',sa.String(12),nullable=False),
            sa.Column('result',sa.JSON(),nullable=False),
            sa.Column('elapsed_seconds',sa.Integer(),nullable=False,server_default='0'),
            sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
            sa.UniqueConstraint('user_id','attempt_key',name='uq_kanji_writing_attempt_key'))
    if 'ix_kanji_writing_user_time' not in {i['name'] for i in sa.inspect(bind).get_indexes('kanji_writing_attempts')}:
        op.create_index('ix_kanji_writing_user_time','kanji_writing_attempts',['user_id','created_at'])


def downgrade():
    bind = op.get_bind()
    if 'kanji_writing_attempts' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM kanji_writing_attempts LIMIT 1')).first():
            raise RuntimeError('Writing history exists; archive before downgrade. No data was removed.')
        op.drop_table('kanji_writing_attempts')
