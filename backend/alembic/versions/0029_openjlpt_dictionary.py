"""Add bilingual vocabulary provenance and search data; preserve legacy meanings.

Revision ID: 0029
Revises: 0028
"""
from alembic import op
import sqlalchemy as sa

revision = '0029'
down_revision = '0028'
branch_labels = None
depends_on = None

COLUMNS = (
    sa.Column('meaning_en', sa.Text()),
    sa.Column('meaning_vi_status', sa.String(12), nullable=False, server_default='reviewed'),
    sa.Column('meaning_vi_source', sa.String(80), nullable=False, server_default='legacy'),
    sa.Column('source', sa.String(40)),
    sa.Column('source_id', sa.String(100)),
    sa.Column('jmdict_id', sa.BigInteger()),
    sa.Column('dataset_version', sa.String(120)),
    sa.Column('source_metadata', sa.JSON()),
    sa.Column('search_text', sa.Text(), nullable=False, server_default=''),
    sa.Column('translation_attempted_at', sa.DateTime(timezone=True)),
)
INDEXES = (
    ('uq_vocabulary_source_id', ['source', 'source_id'], True),
    ('ix_vocabulary_level_pos', ['jlpt_level', 'part_of_speech'], False),
    ('ix_vocabulary_jmdict_id', ['jmdict_id'], False),
    ('ix_vocabulary_romaji', ['romaji'], False),
)


def upgrade():
    connection = op.get_bind()
    columns = {c['name'] for c in sa.inspect(connection).get_columns('vocabulary')}
    for column in COLUMNS:
        if column.name not in columns:
            op.add_column('vocabulary', column.copy())
    indexes = {i['name'] for i in sa.inspect(connection).get_indexes('vocabulary')}
    for name, names, unique in INDEXES:
        if name not in indexes:
            op.create_index(name, 'vocabulary', names, unique=unique)
    from app.services.vocabulary_text import fold
    # Core SQL avoids ORM models which may have columns from future revisions.
    for row in connection.execute(sa.text("SELECT id, japanese_word, reading, romaji, meaning, meaning_en FROM vocabulary WHERE search_text=''" )).mappings():
        connection.execute(sa.text("UPDATE vocabulary SET search_text=:text, meaning_vi_status=CASE WHEN TRIM(meaning)='' THEN 'missing' ELSE meaning_vi_status END WHERE id=:id"),
            {'id': row['id'], 'text': fold('\n'.join(str(row[k] or '') for k in ('japanese_word', 'reading', 'romaji', 'meaning', 'meaning_en')))})


def downgrade():
    connection = op.get_bind()
    columns = {c['name'] for c in sa.inspect(connection).get_columns('vocabulary')}
    protected = []
    for field in ('meaning_en', 'source', 'source_id', 'jmdict_id', 'dataset_version', 'translation_attempted_at'):
        if field in columns:
            protected.append(f'{field} IS NOT NULL')
    if 'meaning_vi_status' in columns:
        protected.append("meaning_vi_status='automatic'")
    if 'source_metadata' in columns:
        protected.append("source_metadata IS NOT NULL AND CAST(source_metadata AS TEXT) NOT IN ('{}', 'null', '')")
    if 'meaning_vi_source' in columns:
        protected.append("meaning_vi_source NOT IN ('legacy', 'none')")
    if protected and connection.execute(sa.text('SELECT COUNT(*) FROM vocabulary WHERE ' + ' OR '.join(protected))).scalar():
        raise RuntimeError('Downgrade refused: bilingual/source/translation data exists; export and explicitly migrate it first.')
    indexes = {i['name'] for i in sa.inspect(connection).get_indexes('vocabulary')}
    for name, _, _ in reversed(INDEXES):
        if name in indexes:
            op.drop_index(name, table_name='vocabulary')
    with op.batch_alter_table('vocabulary') as batch:
        for column in reversed(COLUMNS):
            if column.name in columns:
                batch.drop_column(column.name)
