import csv
import io
import json
import zipfile
import asyncio
import importlib.util
from pathlib import Path
from datetime import date

import pytest
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models import database as m
from app.services import personal_export as svc


@pytest.fixture
def ctx():
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def setup(conn, record):
        conn.create_function('char_length', 1, len)
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    users = [m.User(email=f'export{i}@example.test', username=f'export{i}', hashed_password='PRIVATE_PASSWORD') for i in range(2)]
    db.add_all(users); db.commit()
    current = [0]
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: users[current[0]]
    with TestClient(app) as client:
        yield client, db, users, current, app
    db.close(); engine.dispose()


def test_empty_downloads_and_report(ctx):
    client, db, users, current, app = ctx
    response = client.get('/auth/me/export/download')
    assert response.status_code == 200, response.text
    assert response.headers['content-disposition'].startswith('attachment;')
    assert svc.export_day() in response.headers['content-disposition']
    assert response.headers['cache-control'] == 'no-store'
    body = response.json()
    assert body['schema_version'] == 2
    assert len(body['tables']['users']) == 1
    assert not body['tables']['chat_history']
    assert 'PRIVATE_PASSWORD' not in response.text
    assert not body['metadata']['truncated']
    for language in ['vi', 'en']:
        report = client.get('/auth/me/export/report', params={'language': language})
        assert report.status_code == 200, report.text
        assert ('Chưa có dữ liệu' if language == 'vi' else 'No recorded data') in report.text
        assert '@media print' in report.text
    assert client.get('/auth/me/export/download?format=xml').status_code == 422
    assert client.get('/auth/me/export/report?language=de').status_code == 422
    del app.dependency_overrides[get_current_active_user]
    assert client.get('/auth/me/export/download').status_code in (401, 403)


def test_thousands_unicode_zip_and_owner(ctx):
    client, db, users, current, _ = ctx
    for index in range(2100):
        db.add(m.ChatHistory(user_id=users[0].id, question=f'日本語 tiếng Việt {index}', answer='回答 cảm ơn', jlpt_level='N5'))
    db.add(m.ChatHistory(user_id=users[1].id, question='OTHER_USER_PRIVATE', answer='PRIVATE', jlpt_level='N5'))
    deck = m.FlashcardDeck(user_id=users[0].id, title='猫 và mèo')
    other = m.FlashcardDeck(user_id=users[1].id, title='OTHER_USER_PRIVATE')
    db.add_all([deck, other]); db.flush()
    db.add_all([m.FlashcardCard(deck_id=deck.id, position=0, front='=日本語', back='tiếng Việt', fingerprint='a'), m.FlashcardCard(deck_id=other.id, position=0, front='OTHER_USER_PRIVATE', back='secret', fingerprint='b')])
    db.commit()
    response = client.get('/auth/me/export/download?format=zip&user_id=' + str(users[1].id))
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        raw = archive.read('data.json')
        body = json.loads(raw)
        assert len(body['tables']['chat_history']) == 2100
        assert body['tables']['flashcard_cards'][0]['front'] == '=日本語'
        assert len(body['tables']['flashcard_cards']) == 1
        assert b'OTHER_USER_PRIVATE' not in raw
        assert b'PRIVATE_PASSWORD' not in raw
        csv_raw = archive.read('chat_history.csv')
        assert csv_raw.startswith(b'\xef\xbb\xbf')
        rows = list(csv.DictReader(io.StringIO(csv_raw.decode('utf-8-sig'))))
        assert '日本語 tiếng Việt' in rows[0]['question']
        cards = list(csv.DictReader(io.StringIO(archive.read('flashcard_cards.csv').decode('utf-8-sig'))))
        assert cards[0]['front'] == "'=日本語"
        assert 'HƯỚNG DẪN' in archive.read('HUONG_DAN.txt').decode('utf-8-sig')
    current[0] = 1
    response = client.get('/auth/me/export/download')
    assert len(response.json()['tables']['chat_history']) == 1
    assert '日本語 tiếng Việt' not in response.text


def test_new_features_and_scoped_children(ctx):
    client, db, users, current, _ = ctx
    for user in users:
        db.add(m.Document(user_id=user.id, title=f'Private document {user.id}', content='日本語 tiếng Việt', document_type='lesson'))
        task = m.DailyTask(user_id=user.id, task_date=date(2026, 11, 20), total_items=1)
        placement = m.PlacementAttempt(user_id=user.id, language='vi', bank={}, available_levels=['N5'])
        session = m.LearningSession(user_id=user.id, session_type='grammar')
        db.add_all([task, placement, session]); db.flush()
        db.add(m.DailyTaskItem(daily_task_id=task.id, position=0, item_type='grammar', source_id='1', question_type='mcq', payload={}, answer_key={}, user_answer='日本語'))
        db.add(m.PlacementAttemptItem(attempt_id=placement.id, source_key='test', position=0, snapshot={'question': '日本語'}, user_answer={'a': 1}))
        db.add(m.GrammarPracticeAttempt(user_id=user.id, learning_session_id=session.id, jlpt_level='N5', question_type='fill_blank', user_answer='猫', is_correct=True))
        db.add(m.WeeklyLearningGoal(user_id=user.id, lessons=12))
        db.add(m.KanjiWritingAttempt(user_id=user.id, attempt_key='writing', kanji='日', jlpt_level='N5', mode='practice', result={'score': 80}))
        db.add(m.PointTransaction(user_id=user.id, amount=10, reason='test', idempotency_key=f'key{user.id}', balance_after=10))
    db.add(m.Document(title='UNOWNED_LEGACY', content='Never guess the owner', document_type='lesson'))
    db.commit()
    response = client.get('/auth/me/export/download')
    assert response.status_code == 200, response.text
    tables = response.json()['tables']
    for name in ['documents', 'daily_task_items', 'placement_attempt_items', 'grammar_practice_attempts', 'weekly_learning_goals', 'kanji_writing_attempts', 'point_transactions']:
        assert len(tables[name]) == 1, name
    assert 'idempotency_key' not in response.text
    assert tables['documents'][0]['title'] == f'Private document {users[0].id}'
    assert 'UNOWNED_LEGACY' not in response.text
    assert client.get('/auth/me/export/report').status_code == 200


def test_limits_are_disclosed_and_json_stays_valid(ctx, monkeypatch):
    client, db, users, _, _ = ctx
    db.add_all([m.ChatHistory(user_id=users[0].id, question='猫' * 100, answer='ok', jlpt_level='N5') for _ in range(5)])
    db.commit()
    monkeypatch.setattr(svc, 'MAX_ROWS', 2)
    body = client.get('/auth/me/export/download').json()
    assert len(body['tables']['chat_history']) == 2
    assert body['metadata']['truncated']
    monkeypatch.setattr(svc, 'MAX_ROW_BYTES', 20)
    body = client.get('/auth/me/export/download').json()
    assert body['metadata']['warnings']
    assert body['tables']['chat_history'] == []
    monkeypatch.setattr(svc, 'MAX_ROW_BYTES', 2 * 1024 * 1024)
    monkeypatch.setattr(svc, 'MAX_ROWS', 100_000)
    monkeypatch.setattr(svc, 'MAX_BYTES', 400)
    response = client.get('/auth/me/export/download')
    assert response.json()['metadata']['truncated']
    assert response.headers['x-export-truncated'] == 'true'


def test_registry_covers_all_owned_tables_and_no_credentials():
    registered = {model.__tablename__ for model in svc.MODELS}
    owned = {table.name for table in Base.metadata.tables.values() if 'user_id' in table.columns}
    assert owned - {'push_subscriptions'} <= registered
    forbidden = {'hashed_password', 'auth', 'p256dh', 'endpoint', 'request_key', 'payload_hash', 'submission_hash', 'idempotency_key'}
    for model in svc.MODELS:
        fields = svc.FIELDS[model.__tablename__]
        assert not forbidden.intersection(fields)
        assert set(fields) <= set(model.__table__.columns.keys())
        assert set(fields) <= set(svc.COLUMN_LABELS), model.__tablename__


@pytest.mark.parametrize('text', ['=1+1', '+cmd', '-2', '@sum(A1)', '\t=1', '\n=1', '   =1'])
def test_csv_formula_protection(text):
    assert svc.spreadsheet(text).startswith("'")


def test_report_escapes_user_content(ctx):
    client, db, users, _, _ = ctx
    users[0].username = '<script>alert(1)</script>'
    db.commit()
    report = client.get('/auth/me/export/report').text
    assert '<script>' not in report
    assert '&lt;script&gt;' in report


def test_document_migration_is_repeatable_preserves_sources_and_guards_downgrade():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'alembic/versions/0026_document_export_owner.py'
    spec = importlib.util.spec_from_file_location('export_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.exec_driver_sql('PRAGMA foreign_keys=ON')
        connection.exec_driver_sql('CREATE TABLE users (id INTEGER PRIMARY KEY)')
        connection.exec_driver_sql('CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT)')
        connection.exec_driver_sql('CREATE TABLE child (id INTEGER PRIMARY KEY, document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE)')
        connection.exec_driver_sql("INSERT INTO documents VALUES (1, 'legacy')")
        connection.exec_driver_sql('INSERT INTO child VALUES (1, 1)')
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade(); migration.upgrade()
            assert connection.exec_driver_sql('SELECT user_id FROM documents').scalar() is None
            assert connection.exec_driver_sql('SELECT count(*) FROM child').scalar() == 1
            connection.exec_driver_sql('INSERT INTO users VALUES (1)')
            connection.exec_driver_sql('UPDATE documents SET user_id=1')
            with pytest.raises(RuntimeError): migration.downgrade()
            connection.exec_driver_sql('DELETE FROM users WHERE id=1')
            assert connection.exec_driver_sql('SELECT user_id FROM documents').scalar() is None
            migration.downgrade()
            assert connection.exec_driver_sql('SELECT title FROM documents').scalar() == 'legacy'
            assert connection.exec_driver_sql('SELECT count(*) FROM child').scalar() == 1
    engine.dispose()


def test_temporary_exports_are_cleaned_after_download_and_failure(ctx, monkeypatch):
    client, db, _, _, _ = ctx
    original = svc.tempfile.TemporaryDirectory
    paths = []
    def temporary(*args, **kwargs):
        directory = original(*args, **kwargs)
        paths.append(Path(directory.name))
        return directory
    monkeypatch.setattr(svc.tempfile, 'TemporaryDirectory', temporary)
    assert client.get('/auth/me/export/download?format=zip').status_code == 200
    assert not paths[-1].exists()
    def fail(*args, **kwargs):
        raise RuntimeError('database unavailable')
    monkeypatch.setattr(db, 'execute', fail)
    with pytest.raises(RuntimeError): client.get('/auth/me/export/download')
    assert not paths[-1].exists()


def test_authenticated_document_create_and_upload_assign_owner(ctx, monkeypatch):
    from app.api import library
    from app.models.schemas import DocumentCreate
    from fastapi import UploadFile
    client, db, users, _, _ = ctx
    monkeypatch.setattr(library.library_service, '_index_document', lambda *args: None)
    monkeypatch.setattr(library.library_service, 'extract_file_content', lambda *args: ('Japanese notes', '日本語 tiếng Việt'))
    created = asyncio.run(library.create_document(DocumentCreate(title='Notes', content='日本語', document_type='lesson'), users[0], db))
    uploaded = asyncio.run(library.upload_document_file(UploadFile(filename='notes.txt', file=io.BytesIO(b'notes')), 'Notes', 'lesson', None, '', users[0], db))
    assert created.user_id == uploaded.user_id == users[0].id
    assert len(client.get('/auth/me/export/download').json()['tables']['documents']) == 2
