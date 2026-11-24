import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.placement import router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.core import placement_config as policy
from app.models.database import PlacementAttempt, PlacementAttemptItem, PlacementQuestionBank, PlacementStimulus, User
from app.services.placement_selection import adapt_level
from app.services.placement_scoring import score_assessment
from app.services.placement_question_bank import import_demo_n5, level_availability


@pytest.fixture
def context(tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'listening_media_dir', str(tmp_path))
    (tmp_path / 'sample.wav').write_bytes(b'RIFF-test-audio')
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    names = ['users', 'documents', 'listening_lessons', 'placement_attempts', 'placement_stimuli', 'placement_questions', 'placement_attempt_items']
    Base.metadata.create_all(engine, tables=[Base.metadata.tables[name] for name in names])
    db = sessionmaker(bind=engine, autoflush=False)()
    user = User(email='v2@example.test', username='v2', hashed_password='test', current_jlpt_level='N3')
    other = User(email='other-v2@example.test', username='other-v2', hashed_password='test')
    db.add_all([user, other]); db.commit()
    for level in policy.LEVELS:
        for skill in policy.SKILLS:
            media = []
            if skill in {'reading', 'listening'}:
                for group in range(3):
                    row = PlacementStimulus(source_key=f'{level}:{skill}:{group}', version=1, kind=skill,
                          content={'text': 'これはテストです。', 'audio_path': 'sample.wav', 'start_ms': 0, 'end_ms': 1000, 'transcript': 'private transcript'})
                    db.add(row); db.flush(); media.append(row.id)
            for index in range(10):
                db.add(PlacementQuestionBank(source_key=f'{level}:{skill}:{index}', version=1, level=level, skill=skill,
                    question_type='mcq', payload={'prompt': f'{level} {skill} {index}', 'options': [{'id': value, 'text': value} for value in ['a', 'b', 'c', 'd']]},
                    answer_key={'option_id': 'a'}, explanation={'en': 'private explanation', 'vi': 'private explanation'},
                    difficulty=1, source={'name': 'test fixture'}, publication_status='published', is_demo=False,
                    stimulus_id=media[index % 3] if media else None))
    db.commit()
    app = FastAPI(); app.include_router(router, prefix='/api')
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client, db, user, other, app
    db.close(); engine.dispose()


def start(client, mode='adaptive', level=None):
    response = client.post('/api/placement/attempts', json={'mode': mode, 'selected_level': level, 'language': 'en'})
    assert response.status_code == 200, response.text
    return response.json()


def answer(client, attempt, question, value='a'):
    response = client.post(f'/api/placement/attempts/{attempt["id"]}/answers', json={
        'question_key': question['key'], 'answer': value, 'revision': question['revision']})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize('level', policy.LEVELS)
def test_fixed_level_assesses_only_selected_level_and_never_grants_higher(context, level):
    client, db, user, _, _ = context
    attempt = start(client, 'confirmation', level)
    assert len(attempt['items']) == 30
    assert {item['level'] for item in attempt['items']} == {level}
    assert len({item['key'] for item in attempt['items']}) == 30
    assert all(sum(item['skill'] == skill for item in attempt['items']) == 6 for skill in policy.SKILLS)
    for question in list(attempt['items']):
        attempt = answer(client, attempt, question)
    result = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()
    assert result['result']['estimated_level'] == level
    assert result['result']['total_score'] == 100
    assert result['result']['outcome'] == 'strong'
    db.refresh(user)
    assert user.current_jlpt_level == 'N3'
    confirmed = client.post(f'/api/placement/attempts/{attempt["id"]}/confirm')
    assert confirmed.status_code == 200
    db.refresh(user)
    assert user.current_jlpt_level == level
    assert client.get('/api/placement/profile/summary').json()['current_estimated_level'] == level


def test_adaptive_streaks_and_verified_n1_evidence(context):
    client, _, _, _, _ = context
    attempt = start(client)
    assert attempt['question']['level'] == 'N5'
    for count in range(2):
        attempt = answer(client, attempt, attempt['question'])
        assert attempt['question']['level'] == 'N5'
    attempt = answer(client, attempt, attempt['question'])
    assert attempt['question']['level'] == 'N4'
    while not attempt['ready_to_submit']:
        attempt = answer(client, attempt, attempt['question'])
        assert attempt['result'] is None
    result = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()['result']
    assert result['estimated_level'] == 'N1'
    assert 20 <= attempt['answered_count'] <= 30
    assert all(value['total'] >= 3 for value in result['evidence']['N1'].values())


def test_answer_keys_are_hidden_and_media_is_private(context):
    client, _, user, other, app = context
    attempt = start(client, 'confirmation', 'N3')
    public = str(attempt)
    assert 'private explanation' not in public and 'private transcript' not in public and 'answer_key' not in public
    assert 'is_correct' not in public and 'correct_option' not in public and 'audio_path' not in public
    clip = next(item for item in attempt['items'] if item['skill'] == 'listening')
    assert client.get('/api' + clip['audio_url']).status_code == 200
    app.dependency_overrides[get_current_active_user] = lambda: other
    assert client.get('/api' + clip['audio_url']).status_code == 404
    assert client.get(f'/api/placement/attempts/{attempt["id"]}').status_code == 404
    assert client.get('/api/placement/attempts').json() == []


def test_fixed_drafts_resume_revision_conflicts_and_submit_is_idempotent(context):
    client, _, _, _, _ = context
    attempt = start(client, 'confirmation', 'N4')
    original = attempt['items'][0]
    attempt = answer(client, attempt, original, 'b')
    assert attempt['result'] is None
    assert client.get(f'/api/placement/attempts/{attempt["id"]}').json()['items'][0]['user_answer'] == 'b'
    retry = answer(client, attempt, original, 'b')
    assert retry['answered_count'] == 1
    conflict = client.post(f'/api/placement/attempts/{attempt["id"]}/answers', json={'question_key': original['key'], 'answer': 'a', 'revision': 0})
    assert conflict.status_code == 409
    attempt = answer(client, attempt, attempt['items'][0], 'a')
    first = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()
    repeated = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()
    assert first['result'] == repeated['result'] and first['completed_at'] == repeated['completed_at']
    assert first['result']['estimated_level'] is None


def test_timeout_finalizes_once_without_accepting_late_answers(context):
    client, db, _, _, _ = context
    attempt = start(client, 'confirmation', 'N5')
    row = db.get(PlacementAttempt, attempt['id']); row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
    completed = answer(client, attempt, attempt['items'][0])
    assert completed['status'] == 'completed' and completed['answered_count'] == 0
    assert completed['result']['stop_reason'] == 'expired'
    assert completed['result']['estimated_level'] is None
    assert client.get(f'/api/placement/attempts/{attempt["id"]}/result').json() == completed['result']


def test_demo_can_be_saved_as_reference_without_overwriting_current_level(context):
    client, db, user, _, _ = context
    db.query(PlacementQuestionBank).update({'is_demo': True}); db.commit()
    attempt = start(client, 'confirmation', 'N5')
    for question in list(attempt['items']):
        attempt = answer(client, attempt, question)
    result = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()
    assert result['result']['estimated_level'] is None and result['result']['is_demo']
    assert client.post(f'/api/placement/attempts/{attempt["id"]}/confirm').status_code == 200
    db.refresh(user); assert user.current_jlpt_level == 'N3'
    assert client.get('/api/placement/status').json()['has_confirmed']
    assert not client.get('/api/placement/status').json()['has_estimated_level']


def test_unpublished_or_short_banks_are_not_substituted_and_abandon_preserves_history(context):
    client, db, _, _, _ = context
    db.query(PlacementQuestionBank).filter_by(level='N2').update({'publication_status': 'draft'}); db.commit()
    levels = client.get('/api/placement/levels').json()['levels']
    assert next(row for row in levels if row['level'] == 'N2')['available'] is False
    assert client.post('/api/placement/attempts', json={'mode': 'confirmation', 'selected_level': 'N2'}).status_code == 409
    attempt = start(client)
    assert client.post('/api/placement/attempts', json={'mode': 'confirmation', 'selected_level': 'N3'}).status_code == 409
    answer(client, attempt, attempt['question'])
    assert client.post(f'/api/placement/attempts/{attempt["id"]}/abandon').json()['status'] == 'abandoned'
    assert db.query(PlacementAttemptItem).filter_by(attempt_id=attempt['id']).count() == 2
    assert start(client, 'confirmation', 'N3')['id'] != attempt['id']


def test_low_confirmation_score_suggests_lower_without_establishing_it(context):
    client, _, _, _, _ = context
    attempt = start(client, 'confirmation', 'N3')
    for question in list(attempt['items']):
        attempt = answer(client, attempt, question, 'b')
    result = client.post(f'/api/placement/attempts/{attempt["id"]}/submit').json()['result']
    assert result['estimated_level'] is None
    assert result['next_level'] == 'N4' and result['outcome'] == 'try_lower'


def test_import_is_idempotent_and_does_not_promote_demo_to_verified_content(context):
    _, db, _, _, _ = context
    first = import_demo_n5(db); db.commit()
    assert first == 40  # No published seed audio in this isolated database.
    assert import_demo_n5(db) == 0
    assert all(row.is_demo for row in db.query(PlacementQuestionBank).filter(PlacementQuestionBank.source_key.like('senpai-demo%')).all())


def test_deadline_remains_utc_after_reload_and_question_edits_create_versions(context):
    client, db, _, _, _ = context
    attempt = start(client)
    reloaded = client.get(f'/api/placement/attempts/{attempt["id"]}').json()
    deadline = datetime.fromisoformat(reloaded['expires_at'].replace('Z', '+00:00'))
    server = datetime.fromisoformat(reloaded['server_time'].replace('Z', '+00:00'))
    assert deadline.utcoffset() == timedelta(0)
    assert 1790 < (deadline - server).total_seconds() <= 1800
    import_demo_n5(db); db.commit()
    row = db.query(PlacementQuestionBank).filter_by(source_key='senpai-demo-n5:kanji:0').one()
    old_payload = dict(row.payload)
    row.payload = {**row.payload, 'prompt': 'obsolete demo prompt'}
    db.commit()
    assert import_demo_n5(db) == 1
    db.commit()
    versions = db.query(PlacementQuestionBank).filter_by(source_key=row.source_key).order_by(PlacementQuestionBank.version).all()
    assert len(versions) == 2 and versions[-1].payload == old_payload
    assert versions[0].payload['prompt'] == 'obsolete demo prompt'
    assert import_demo_n5(db) == 0


def test_export_reset_and_account_deletion_include_new_placement_data(context):
    client, db, user, _, app = context
    from app.api.auth import router as auth_router
    # Only this isolated test database receives the unrelated account tables.
    names = ('minigame_learning_events', 'user_kanji_notes', 'chat_answer_feedback', 'kanji_writing_attempts', 'kanji_writing_reports', 'weekly_learning_goals', 'internship_profiles', 'internship_sessions', 'vocabulary', 'exercise_history', 'exercise_deliveries', 'chat_folders', 'chat_conversations', 'chat_history', 'voice_conversations', 'learning_sessions',
             'grammar_rules', 'grammar_questions', 'grammar_practice_attempts', 'listening_attempts',
             'daily_tasks', 'daily_task_items', 'user_game_profiles', 'point_transactions', 'user_unlocked_items',
             'study_item_stats', 'reminder_settings', 'notifications', 'push_subscriptions')
    Base.metadata.create_all(db.get_bind(), tables=[Base.metadata.tables[name] for name in names])
    app.include_router(auth_router, prefix='/api')
    attempt = start(client, 'confirmation', 'N4')
    for question in list(attempt['items']):
        attempt = answer(client, attempt, question)
    client.post(f'/api/placement/attempts/{attempt["id"]}/submit')
    client.post(f'/api/placement/attempts/{attempt["id"]}/confirm')
    exported = client.get('/api/auth/me/export')
    assert exported.status_code == 200, exported.text
    assert exported.json()['placement']['current_estimated_level'] == 'N4'
    assert client.post('/api/auth/me/reset-progress').status_code == 200
    db.refresh(user)
    assert user.current_jlpt_level == 'N4'
    assert db.query(PlacementAttemptItem).filter_by(attempt_id=attempt['id']).count() == 30
    assert client.delete('/api/auth/me').status_code == 204
    assert db.query(PlacementAttemptItem).filter_by(attempt_id=attempt['id']).count() == 0
    assert db.query(PlacementAttempt).filter_by(id=attempt['id']).count() == 0
    assert db.query(PlacementQuestionBank).count() == 250


def test_migration_preserves_v1_attempts_and_protects_populated_v2_tables():
    path = Path(__file__).parents[1] / 'alembic/versions/0015_placement_v2.py'
    spec = importlib.util.spec_from_file_location('placement_v2_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE placement_attempts (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT)'))
        connection.execute(sa.text("INSERT INTO placement_attempts VALUES (1,1,'in_progress')"))
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade(); migration.upgrade()
        assert connection.execute(sa.text('SELECT assessment_mode FROM placement_attempts')).scalar() == 'legacy'
        migration.downgrade(); migration.downgrade(); migration.upgrade()
        connection.execute(sa.text("INSERT INTO placement_stimuli (source_key,version,kind,content) VALUES ('p',1,'reading','{}')"))
        with pytest.raises(RuntimeError, match='no data was removed'):
            migration.downgrade()
        assert connection.execute(sa.text('SELECT COUNT(*) FROM placement_attempts')).scalar() == 1
    engine.dispose()
