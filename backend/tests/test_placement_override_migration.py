import importlib.util
from pathlib import Path
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_targeted_override_repeat_upgrade_and_restore_without_fake_test():
    path = Path(__file__).parents[1] / 'alembic/versions/0018_placement_override.py'
    spec = importlib.util.spec_from_file_location('override_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, current_jlpt_level TEXT)'))
        conn.execute(sa.text("INSERT INTO users VALUES (1,'kazutokaruai@gmail.com','N5'),(2,'other@example.test','N4')"))
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade(); migration.upgrade()
        rows = conn.execute(sa.select(migration.users_table()).order_by(migration.users_table().c.id)).mappings().all()
        assert rows[0]['current_jlpt_level'] == 'N3' and rows[0]['placement_override']['active']
        assert rows[1]['current_jlpt_level'] == 'N4' and rows[1]['placement_override'] is None
        migration.downgrade(); migration.downgrade()
        assert conn.execute(sa.text('SELECT current_jlpt_level FROM users WHERE id=1')).scalar() == 'N5'
        migration.upgrade()
        users = migration.users_table()
        override = conn.execute(sa.select(users.c.placement_override).where(users.c.id == 1)).scalar()
        conn.execute(users.update().where(users.c.id == 1).values(current_jlpt_level='N2', placement_override={**override, 'active': False}))
        migration.upgrade(); migration.downgrade()
        assert conn.execute(sa.text('SELECT current_jlpt_level FROM users WHERE id=1')).scalar() == 'N2'
    engine.dispose()
