"""Explicit account-specific placement exemption; never fabricate an assessment."""
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa

revision = '0018'
down_revision = '0017'
branch_labels = depends_on = None
EMAIL = 'kazutokaruai@gmail.com'
CHANGE_ID = '0018-kazutokaruai-n3'


def users_table():
    return sa.table('users', sa.column('id', sa.Integer()), sa.column('email', sa.String()),
                    sa.column('current_jlpt_level', sa.String()), sa.column('placement_override', sa.JSON()))


def upgrade():
    bind = op.get_bind()
    if 'placement_override' not in {row['name'] for row in sa.inspect(bind).get_columns('users')}:
        op.add_column('users', sa.Column('placement_override', sa.JSON(), nullable=True))
    users = users_table()
    row = bind.execute(sa.select(users).where(sa.func.lower(users.c.email) == EMAIL)).mappings().first()
    if row and row['placement_override'] is None:
        override = {'change_id': CHANGE_ID, 'active': True, 'level': 'N3', 'previous_level': row['current_jlpt_level'],
                    'granted_at': datetime.now(timezone.utc).isoformat(), 'reason': 'explicit_account_owner_request'}
        bind.execute(users.update().where(users.c.id == row['id']).values(current_jlpt_level='N3', placement_override=override))


def downgrade():
    bind = op.get_bind()
    if 'placement_override' not in {row['name'] for row in sa.inspect(bind).get_columns('users')}:
        return
    users = users_table()
    rows = bind.execute(sa.select(users)).mappings().all()
    if any(row['placement_override'] and row['placement_override'].get('change_id') != CHANGE_ID for row in rows):
        raise RuntimeError('Other placement overrides exist; archive before downgrade. No data was removed.')
    for row in rows:
        override = row['placement_override'] or {}
        if override.get('change_id') == CHANGE_ID and override.get('active') and row['current_jlpt_level'] == override.get('level'):
            bind.execute(users.update().where(users.c.id == row['id']).values(current_jlpt_level=override['previous_level']))
    op.drop_column('users', 'placement_override')
