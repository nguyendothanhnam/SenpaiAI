"""Attribute new documents for personal exports without guessing legacy owners."""
from alembic import op
import sqlalchemy as sa

revision = '0026'
down_revision = '0025'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column['name'] for column in sa.inspect(bind).get_columns('documents')}
    if 'user_id' not in columns:
        if bind.dialect.name == 'sqlite':
            # SQLite supports a nullable REFERENCES column directly. Avoid table
            # recreation, which could cascade into listening/grammar source rows.
            op.execute('ALTER TABLE documents ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL')
        else:
            op.add_column('documents', sa.Column('user_id', sa.Integer(), nullable=True))
    if bind.dialect.name != 'sqlite':
        foreign_keys = sa.inspect(bind).get_foreign_keys('documents')
        if not any(key['constrained_columns'] == ['user_id'] and key['referred_table'] == 'users' for key in foreign_keys):
            op.create_foreign_key('fk_documents_user_id_users', 'documents', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    if 'ix_documents_user_id' not in {index['name'] for index in sa.inspect(bind).get_indexes('documents')}:
        op.create_index('ix_documents_user_id', 'documents', ['user_id'])


def downgrade():
    bind = op.get_bind()
    if 'user_id' not in {column['name'] for column in sa.inspect(bind).get_columns('documents')}:
        return
    if bind.execute(sa.text('SELECT 1 FROM documents WHERE user_id IS NOT NULL LIMIT 1')).first():
        raise RuntimeError('Archive document ownership before downgrade; no ownership removed.')
    if 'ix_documents_user_id' in {index['name'] for index in sa.inspect(bind).get_indexes('documents')}:
        op.drop_index('ix_documents_user_id', table_name='documents')
    if bind.dialect.name != 'sqlite':
        for key in sa.inspect(bind).get_foreign_keys('documents'):
            if key['constrained_columns'] == ['user_id']:
                op.drop_constraint(key['name'], 'documents', type_='foreignkey')
    op.drop_column('documents', 'user_id')
