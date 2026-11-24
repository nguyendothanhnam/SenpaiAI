from alembic import op
import sqlalchemy as sa
revision='0021'
down_revision='0020'
branch_labels=depends_on=None

def upgrade():
    if 'user_kanji_notes' not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table('user_kanji_notes',sa.Column('id',sa.Integer(),primary_key=True),
            sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
            sa.Column('kanji',sa.String(1),nullable=False),sa.Column('sino_vietnamese',sa.String(80),nullable=False,server_default=''),
            sa.Column('meaning_vi',sa.String(2000),nullable=False,server_default=''),sa.Column('mnemonic',sa.String(2000),nullable=False,server_default=''),
            sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
            sa.UniqueConstraint('user_id','kanji',name='uq_user_kanji_note'))

def downgrade():
    bind=op.get_bind()
    if 'user_kanji_notes' in sa.inspect(bind).get_table_names():
        if bind.execute(sa.text('SELECT 1 FROM user_kanji_notes LIMIT 1')).first():
            raise RuntimeError('Kanji notes exist; archive before downgrade. No data was removed.')
        op.drop_table('user_kanji_notes')
