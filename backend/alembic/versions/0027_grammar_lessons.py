"""Grammar lessons and account-owned progress."""
from alembic import op
import sqlalchemy as sa

revision = '0027'
down_revision = '0026'
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    if 'grammar_lessons' not in sa.inspect(bind).get_table_names():
        op.create_table('grammar_lessons', sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('source_key', sa.String(160), nullable=False, unique=True),
            sa.Column('grammar_rule_id', sa.Integer, sa.ForeignKey('grammar_rules.id', ondelete='RESTRICT'), nullable=False, unique=True),
            sa.Column('jlpt_level', sa.String(2), nullable=False), sa.Column('sort_order', sa.Integer, nullable=False),
            sa.Column('formation', sa.Text, nullable=False), sa.Column('meaning', sa.Text, nullable=False),
            sa.Column('usage_notes', sa.Text, nullable=False), sa.Column('examples', sa.JSON, nullable=False),
            sa.Column('common_errors', sa.JSON, nullable=False), sa.Column('comparisons', sa.JSON, nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    if 'ix_grammar_lessons_jlpt_level' not in {x['name'] for x in sa.inspect(bind).get_indexes('grammar_lessons')}:
        op.create_index('ix_grammar_lessons_jlpt_level', 'grammar_lessons', ['jlpt_level'])
    if 'grammar_lesson_progress' not in sa.inspect(bind).get_table_names():
        op.create_table('grammar_lesson_progress', sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('lesson_id', sa.Integer, sa.ForeignKey('grammar_lessons.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('status', sa.String(16), nullable=False, server_default='studied'),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("status IN ('studied', 'mastered')", name='ck_grammar_lesson_progress_status'))


def downgrade():
    bind = op.get_bind()
    for table in ['grammar_lesson_progress', 'grammar_lessons']:
        if table in sa.inspect(bind).get_table_names():
            if bind.execute(sa.text(f'SELECT 1 FROM {table} LIMIT 1')).first():
                raise RuntimeError('Archive grammar lessons and progress before downgrade.')
    for table in ['grammar_lesson_progress', 'grammar_lessons']:
        if table in sa.inspect(bind).get_table_names():
            op.drop_table(table)
