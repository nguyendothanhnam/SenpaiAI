from alembic import op
import sqlalchemy as sa
revision='0022'
down_revision='0021'
branch_labels=depends_on=None

def upgrade():
    bind=op.get_bind()
    if 'minigame_learning_events' not in sa.inspect(bind).get_table_names():
        op.create_table('minigame_learning_events',sa.Column('id',sa.Integer(),primary_key=True),
            sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
            sa.Column('event_key',sa.String(180),nullable=False),sa.Column('game',sa.String(20),nullable=False),
            sa.Column('source_type',sa.String(12),nullable=False),sa.Column('source_id',sa.String(80),nullable=False),
            sa.Column('action',sa.String(12),nullable=False),sa.Column('answer',sa.String(120),nullable=False,server_default=''),
            sa.Column('jlpt_level',sa.String(2),nullable=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
            sa.UniqueConstraint('user_id','event_key',name='uq_minigame_learning_event'))
    existing={i['name'] for i in sa.inspect(bind).get_indexes('minigame_learning_events')}
    for name,columns in (('ix_minigame_learning_user_time',['user_id','created_at']),('ix_minigame_learning_source',['user_id','source_type','source_id'])):
        if name not in existing:op.create_index(name,'minigame_learning_events',columns)

def downgrade():
    bind=op.get_bind()
    if 'minigame_learning_events' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM minigame_learning_events LIMIT 1')).first():
            raise RuntimeError('Game review events exist; archive before downgrade. No data was removed.')
        op.drop_table('minigame_learning_events')
