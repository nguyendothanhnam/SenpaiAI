"""Private persistent flashcards. No change to legacy game endpoints."""
from alembic import op
import sqlalchemy as sa

revision = '0024'
down_revision = '0023'
branch_labels = depends_on = None


def upgrade():
    # Snapshot schema, independent of runtime models and safe on repeated execution.
    tables = [
        ('flashcard_decks', [sa.Column('id', sa.Integer, primary_key=True), sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(160), nullable=False), sa.Column('description', sa.String(2000), nullable=False), sa.Column('jlpt_level', sa.String(2)), sa.Column('topic', sa.String(100), nullable=False),
            sa.Column('is_private', sa.Boolean, nullable=False, server_default=sa.true()), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())]),
        ('flashcard_cards', [sa.Column('id', sa.Integer, primary_key=True), sa.Column('deck_id', sa.Integer, sa.ForeignKey('flashcard_decks.id', ondelete='CASCADE'), nullable=False), sa.Column('position', sa.Integer, nullable=False),
            sa.Column('front', sa.String(1000), nullable=False), sa.Column('back', sa.String(2000), nullable=False), sa.Column('reading', sa.String(500), nullable=False), sa.Column('note', sa.String(2000), nullable=False), sa.Column('fingerprint', sa.String(64), nullable=False), sa.UniqueConstraint('deck_id', 'fingerprint', name='uq_flashcard_content')]),
        ('flashcard_progress', [sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True), sa.Column('card_id', sa.Integer, sa.ForeignKey('flashcard_cards.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('state', sa.String(12), nullable=False), sa.Column('stage', sa.Integer, nullable=False), sa.Column('due_at', sa.DateTime(timezone=True)), sa.Column('correct', sa.Integer, nullable=False), sa.Column('wrong', sa.Integer, nullable=False), sa.Column('last_reviewed_at', sa.DateTime(timezone=True)), sa.Column('starred', sa.Boolean, nullable=False)]),
        ('flashcard_sessions', [sa.Column('id', sa.Integer, primary_key=True), sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('request_key', sa.String(64), nullable=False), sa.Column('payload_hash', sa.String(64), nullable=False), sa.Column('mode', sa.String(20), nullable=False),
            sa.Column('card_count', sa.Integer, nullable=False), sa.Column('correct', sa.Integer, nullable=False), sa.Column('wrong', sa.Integer, nullable=False), sa.Column('duration_seconds', sa.Integer, nullable=False), sa.Column('results', sa.JSON, nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.UniqueConstraint('user_id', 'request_key', name='uq_flashcard_session_request')]),
        ('flashcard_transfers', [sa.Column('id', sa.Integer, primary_key=True), sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('source_key', sa.String(64), nullable=False), sa.Column('deck_id', sa.Integer, sa.ForeignKey('flashcard_decks.id', ondelete='SET NULL')), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.UniqueConstraint('user_id', 'source_key', name='uq_flashcard_transfer')]),
    ]
    bind = op.get_bind()
    for name, columns in tables:
        if name not in sa.inspect(bind).get_table_names():
            op.create_table(name, *columns, **({'sqlite_autoincrement': True} if name in ('flashcard_decks', 'flashcard_cards') else {}))
    for name, table, columns in [
        ('ix_flashcard_decks_owner_time', 'flashcard_decks', ['user_id', 'updated_at']),
        ('ix_flashcard_cards_deck_id', 'flashcard_cards', ['deck_id']),
        ('ix_flashcard_progress_owner_due', 'flashcard_progress', ['user_id', 'due_at']),
        ('ix_flashcard_sessions_owner_time', 'flashcard_sessions', ['user_id', 'created_at']),
    ]:
        if name not in {i['name'] for i in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    bind = op.get_bind()
    names = ['flashcard_transfers', 'flashcard_sessions', 'flashcard_progress', 'flashcard_cards', 'flashcard_decks']
    present = sa.inspect(bind).get_table_names()
    # Refuse before dropping anything if there is user data.
    for name in names:
        if name in present and bind.execute(sa.text(f'SELECT 1 FROM {name} LIMIT 1')).first():
            raise RuntimeError('Archive flashcard data before downgrade; no tables were dropped.')
    for name in names:
        if name in present:
            op.drop_table(name)
