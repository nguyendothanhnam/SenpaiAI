"""Owned feedback on answers, separate from linguistic conversation feedback."""
from alembic import op
import sqlalchemy as sa

revision='0020'
down_revision='0019'
branch_labels=depends_on=None


def upgrade():
    bind=op.get_bind()
    if 'chat_answer_feedback' not in sa.inspect(bind).get_table_names():
        op.create_table('chat_answer_feedback',
            sa.Column('id',sa.Integer(),primary_key=True),
            sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
            sa.Column('conversation_id',sa.Uuid(),sa.ForeignKey('chat_conversations.id',ondelete='CASCADE'),nullable=True),
            sa.Column('chat_history_id',sa.Integer(),sa.ForeignKey('chat_history.id',ondelete='CASCADE'),nullable=False),
            sa.Column('rating',sa.String(12),nullable=False),
            sa.Column('comment',sa.String(1000),nullable=False,server_default=''),
            sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
            sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
            sa.UniqueConstraint('user_id','chat_history_id',name='uq_chat_answer_feedback_owner'),
            sa.CheckConstraint("rating IN ('helpful', 'incorrect')",name='ck_chat_answer_feedback_rating'))
    if 'ix_chat_answer_feedback_user_time' not in {i['name'] for i in sa.inspect(bind).get_indexes('chat_answer_feedback')}:
        op.create_index('ix_chat_answer_feedback_user_time','chat_answer_feedback',['user_id','updated_at'])


def downgrade():
    bind=op.get_bind()
    if 'chat_answer_feedback' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM chat_answer_feedback LIMIT 1')).first():
            raise RuntimeError('Answer feedback exists; archive before downgrade. No data was removed.')
        op.drop_table('chat_answer_feedback')
