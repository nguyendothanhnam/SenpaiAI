import importlib.util
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
from app.api.auth import router as auth_router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import PlacementAttempt, User, GrammarQuestion, Vocabulary, ListeningLesson
from app.services import placement_service as service


def make_bank(levels=("N5", "N4"), count=12):
    return [dict(key=f"{skill}:{level}:{index}", skill=skill, level=level,
                 public=dict(question_type="mcq", prompt=f"{skill} {index}", options=["yes", "no", "a", "b"]), answer="yes")
            for level in levels for skill in service.SKILLS for index in range(count)]


@pytest.fixture
def context(monkeypatch):
    engine = sa.create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[Base.metadata.tables[name] for name in (
        'users', 'grammar_rules', 'documents', 'grammar_questions', 'vocabulary', 'listening_lessons', 'placement_attempts')])
    db = sessionmaker(bind=engine, autoflush=False)()
    user = User(email="placement@test.example", username="placement", hashed_password="test", current_jlpt_level="N3")
    other = User(email="other@test.example", username="other", hashed_password="test")
    db.add_all([user, other]); db.commit()
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    monkeypatch.setattr(service, "build_bank", lambda db, language: make_bank())
    with TestClient(app) as client:
        yield client, db, user, other, app
    db.close(); engine.dispose()


def finish(client, attempt, answer="yes"):
    while attempt["status"] == "in_progress":
        response = client.post(f'/api/placement/attempts/{attempt["id"]}/answers',
                               json={"question_key": attempt["question"]["key"], "answer": answer})
        assert response.status_code == 200, response.text
        attempt = response.json()
    return attempt


def test_complete_estimate_then_explicit_idempotent_confirmation(context):
    client, db, user, _, _ = context
    assert client.get('/api/placement/status').json() == {"has_completed": False, "has_confirmed": False, "active_attempt_id": None, "has_estimated_level": False, "has_manual_level": False}
    response = client.post('/api/placement/attempts', json={"language": "en"})
    assert response.status_code == 200
    first = response.json()
    assert first['question']['level'] == 'N5'
    assert 'answer' not in first['question'] and 'bank' not in first and 'answers' not in first
    assert client.post('/api/placement/attempts', json={"language": "en"}).json()['id'] == first['id']
    assert client.post(f'/api/placement/attempts/{first["id"]}/confirm').status_code == 409
    result = finish(client, first)
    assert 20 <= result['answered_count'] <= 30
    assert result['result']['recommended_level'] == 'N4'
    assert result['result']['estimated_up_to'] == 'N4'
    assert result['result']['data_ceiling'] == 'N4'
    assert result['result']['is_estimate'] is True
    assert result['result']['skill_scores']['listening']['score'] is None
    assert all(result['result']['skill_scores'][skill]['score'] == 100 for skill in service.SKILLS)
    db.refresh(user)
    assert user.current_jlpt_level == 'N3'
    assert client.get('/api/placement/status').json()['has_completed'] is True
    assert client.get('/api/placement/status').json()['has_confirmed'] is False
    confirmed = client.post(f'/api/placement/attempts/{first["id"]}/confirm').json()
    repeated = client.post(f'/api/placement/attempts/{first["id"]}/confirm').json()
    db.refresh(user)
    assert user.current_jlpt_level == 'N4'
    assert confirmed['confirmed_at'] == repeated['confirmed_at']
    assert client.get('/api/placement/status').json()['has_confirmed'] is True
    assert len(client.get('/api/placement/attempts').json()) == 1


def test_profile_cannot_bypass_placement_and_rejected_updates_are_atomic(context):
    client, db, user, _, _ = context
    original_name = user.username
    response = client.put('/api/auth/me', json={'current_jlpt_level': 'N1', 'username': 'tampered'})
    assert response.status_code == 403
    assert response.json()['detail'] == 'jlpt_level_requires_placement'
    db.refresh(user)
    assert user.current_jlpt_level == 'N3' and user.username == original_name
    assert client.get('/api/placement/status').json()['has_confirmed'] is False


def test_manual_override_bypasses_only_target_without_fake_assessment(context):
    client, db, user, other, app = context
    user.placement_override = {'active': True, 'level': 'N3'}
    db.commit()
    status = client.get('/api/placement/status').json()
    assert status['has_confirmed'] and status['has_manual_level']
    assert not status['has_completed'] and not status['has_estimated_level']
    profile = client.get('/api/placement/profile/summary').json()
    assert profile['source'] == 'manual_override' and profile['manual_level'] == 'N3'
    assert profile['current_estimated_level'] is None and profile['skill_scores'] == {} and profile['history'] == []
    assert db.query(PlacementAttempt).count() == 0
    app.dependency_overrides[get_current_active_user] = lambda: other
    assert not client.get('/api/placement/status').json()['has_confirmed']
    app.dependency_overrides[get_current_active_user] = lambda: user
    completed = finish(client, client.post('/api/placement/attempts', json={}).json())
    assert client.post(f'/api/placement/attempts/{completed["id"]}/confirm').status_code == 200
    db.refresh(user)
    assert user.placement_override['active'] is False


def test_profile_edits_and_legacy_unchanged_level_payload_still_work(context):
    client, db, user, _, _ = context
    response = client.put('/api/auth/me', json={'username': 'edited', 'learning_goals': ['JLPT N1'], 'ui_language': 'en'})
    assert response.status_code == 200
    assert response.json()['current_jlpt_level'] == 'N3'
    assert response.json()['username'] == 'edited'
    assert response.json()['learning_goals'] == ['JLPT N1']
    response = client.put('/api/auth/me', json={'current_jlpt_level': 'N3', 'learning_goals': ['daily study']})
    assert response.status_code == 200
    db.refresh(user)
    assert user.current_jlpt_level == 'N3'


def test_only_confirmation_sets_level_and_later_retake_does_not_clear_setup(context):
    client, db, user, _, _ = context
    attempt = finish(client, client.post('/api/placement/attempts', json={}).json())
    assert client.put('/api/auth/me', json={'current_jlpt_level': 'N4'}).status_code == 403
    assert client.post(f'/api/placement/attempts/{attempt["id"]}/confirm').status_code == 200
    assert client.put('/api/auth/me', json={'current_jlpt_level': 'N1'}).status_code == 403
    client.post('/api/placement/attempts', json={})
    assert client.get('/api/placement/status').json()['has_confirmed'] is True
    db.refresh(user)
    assert user.current_jlpt_level == 'N4'


def test_wrong_answers_stay_n5_and_do_not_claim_higher_level(context):
    client, _, _, _, _ = context
    result = finish(client, client.post('/api/placement/attempts', json={}).json(), 'no')
    assert result['result']['recommended_level'] == 'N5'
    assert result['result']['estimated_up_to'] == 'N5'
    assert result['result']['foundation_needed'] is True
    assert set(result['result']['weaknesses']) == set(service.SKILLS)
    assert result['answered_count'] >= 20


def test_retry_stale_question_invalid_answer_and_resume(context):
    client, _, _, _, _ = context
    first = client.post('/api/placement/attempts', json={}).json()
    url = f'/api/placement/attempts/{first["id"]}/answers'
    payload = {"question_key": first['question']['key'], "answer": 'yes'}
    assert client.post(url, json={**payload, 'answer': 'invalid'}).status_code == 422
    second = client.post(url, json=payload).json()
    assert second['answered_count'] == 1 and second['question']['level'] == 'N4'
    assert client.post(url, json=payload).json() == second
    assert client.post(url, json={**payload, 'answer': 'no'}).status_code == 409
    assert client.post(url, json={'question_key': 'not-selected', 'answer': 'yes'}).status_code == 409
    assert client.get(f'/api/placement/attempts/{first["id"]}').json() == second
    assert client.post('/api/placement/attempts', json={}).json() == second


def test_attempts_are_private(context):
    client, _, user, other, app = context
    attempt = client.post('/api/placement/attempts', json={}).json()
    app.dependency_overrides[get_current_active_user] = lambda: other
    assert client.get('/api/placement/attempts').json() == []
    assert client.get(f'/api/placement/attempts/{attempt["id"]}').status_code == 404
    assert client.post(f'/api/placement/attempts/{attempt["id"]}/confirm').status_code == 404
    assert client.post(f'/api/placement/attempts/{attempt["id"]}/answers', json={'question_key': attempt['question']['key'], 'answer': 'yes'}).status_code == 404
    app.dependency_overrides.clear()
    assert client.get('/api/placement/status').status_code in (401, 403)


def test_retake_prioritizes_unseen_and_stale_results_cannot_overwrite(context):
    client, db, user, _, _ = context
    first = finish(client, client.post('/api/placement/attempts', json={}).json())
    old = db.get(PlacementAttempt, first['id'])
    new = client.post('/api/placement/attempts', json={}).json()
    assert new['id'] != first['id']
    assert new['question']['key'] not in old.questions
    newest = finish(client, new)
    previous = set(old.questions)
    row = db.get(PlacementAttempt, newest['id'])
    # Every selection uses an unseen source while one at the same skill/level remains.
    used = set()
    for key in row.questions:
        item = next(item for item in row.bank if item['key'] == key)
        if key in previous:
            assert not any(candidate['key'] not in previous | used and candidate['skill'] == item['skill']
                           and candidate['level'] == item['level'] for candidate in row.bank)
        used.add(key)
    assert client.post(f'/api/placement/attempts/{first["id"]}/confirm').status_code == 409
    db.refresh(user)
    assert user.current_jlpt_level == 'N3'


def test_missing_grammar_blocks_high_levels_and_empty_bank_is_rejected(context, monkeypatch):
    client, db, _, _, _ = context
    bank = [item for item in make_bank(("N5", "N4", "N3")) if not (item['level'] == 'N3' and item['skill'] == 'grammar')]
    assert service.supported_levels(bank) == ['N5', 'N4']
    assert service.supported_levels(make_bank(("N4",))) == []
    monkeypatch.setattr(service, 'build_bank', lambda db, language: [])
    assert client.post('/api/placement/attempts', json={}).status_code == 409
    assert db.query(PlacementAttempt).count() == 0


def test_limit_and_exhaustion(context, monkeypatch):
    client, _, _, _, _ = context
    attempt = client.post('/api/placement/attempts', json={}).json()
    while attempt['status'] == 'in_progress':
        value = 'yes' if attempt['answered_count'] % 2 else 'no'
        attempt = client.post(f'/api/placement/attempts/{attempt["id"]}/answers', json={'question_key': attempt['question']['key'], 'answer': value}).json()
    assert attempt['answered_count'] == 30
    assert attempt['result']['stop_reason'] == 'limit'
    bank = make_bank(('N5',), count=7)
    monkeypatch.setattr(service, 'build_bank', lambda db, language: bank)
    result = finish(client, client.post('/api/placement/attempts', json={}).json())
    assert result['answered_count'] == 20
    assert result['result']['recommended_level'] == 'N5'


def test_single_high_level_answer_does_not_establish_level():
    attempt = PlacementAttempt(bank=make_bank(), available_levels=['N5', 'N4'], answers=[{'key': 'kanji:N4:0', 'correct': True}])
    assert service.estimate(attempt)['recommended_level'] == 'N5'


@pytest.mark.parametrize('kind,public,expected,answer', [
    ('fill_blank', {'options': ['a', 'b', 'c', 'd']}, 'b', 'b'),
    ('true_false', {'statement': 'test statement'}, False, False),
    ('reorder', {'tokens': ['です', '猫', 'は', 'これ']}, 'これは猫です', ['これ', 'は', '猫', 'です']),
    ('conjugation', {'base_form': '食べる', 'target_form': 'past'}, '食べた', ' 食べた '),
    ('listening', {'lesson_id': 1, 'start_ms': 0, 'end_ms': 1000}, 'こんにちは。', 'こんにちは'),
])
def test_existing_question_types_are_graded_without_leaking_answers(context, monkeypatch, kind, public, expected, answer):
    client, db, _, _, _ = context
    bank = make_bank()
    for item in bank:
        if item['skill'] == 'grammar':
            item['public'] = dict(question_type=kind, prompt='test', **public)
            item['answer'] = expected
    monkeypatch.setattr(service, 'build_bank', lambda db, language: bank)
    first = client.post('/api/placement/attempts', json={}).json()
    assert first['question']['question_type'] == kind
    response = client.post(f'/api/placement/attempts/{first["id"]}/answers', json={'question_key': first['question']['key'], 'answer': answer})
    assert response.status_code == 200, response.text
    assert db.get(PlacementAttempt, first['id']).answers[0]['correct'] is True
    assert response.json()['question']['level'] == 'N4'


def test_small_bank_exhausts_without_repeating_questions(context, monkeypatch):
    client, db, _, _, _ = context
    monkeypatch.setattr(service, 'build_bank', lambda db, language: make_bank(('N5',), count=7))
    attempt = client.post('/api/placement/attempts', json={}).json()
    while attempt['status'] == 'in_progress':
        attempt = client.post(f'/api/placement/attempts/{attempt["id"]}/answers', json={
            'question_key': attempt['question']['key'], 'answer': 'yes' if attempt['answered_count'] % 2 else 'no'}).json()
    assert attempt['answered_count'] == 21
    assert attempt['result']['stop_reason'] == 'exhausted'
    assert len(set(db.get(PlacementAttempt, attempt['id']).questions)) == 21


def test_real_banks_use_existing_sources_and_audio_only_when_available(context, monkeypatch, tmp_path):
    _, db, _, _, _ = context
    # The service is patched in the fixture; load the original from the module source.
    spec = importlib.util.spec_from_file_location('app.services.placement_actual', Path(service.__file__))
    actual = importlib.util.module_from_spec(spec); spec.loader.exec_module(actual)
    for level in ('N5', 'N4'):
        for index in range(7):
            db.add(GrammarQuestion(jlpt_level=level, question_type='fill_blank', prompt=f'{level} {index} ____',
                                   payload={'options': ['a', 'b', 'c', 'd']}, correct_answer='a', explanation_vi='test', source='seed'))
        for index in range(6):
            db.add(Vocabulary(japanese_word=f'{level}word{index}', reading=f'reading{index}', meaning=f'meaning{index}', jlpt_level=level))
    monkeypatch.setattr(service.settings, 'listening_media_dir', str(tmp_path))
    (tmp_path / 'exists.wav').write_bytes(b'audio')
    for index, (published, path) in enumerate([(True, 'exists.wav'), (False, 'exists.wav'), (True, 'missing.wav')]):
        db.add(ListeningLesson(title=f'lesson{index}', jlpt_level='N5', topic='test', source='seed', is_published=published,
                               audio_path=path, segments=[{'ja': 'こんにちは', 'start_ms': 0, 'end_ms': 1000}]))
    db.commit()
    bank = actual.build_bank(db, 'en')
    assert actual.supported_levels(bank) == ['N5', 'N4']
    assert any(item['key'].startswith('vocab:N5:') and item['public']['options'] for item in bank)
    translated = next(item for item in bank if item['skill'] == 'vocab' and item['answer'] == 'student')
    assert set(translated['public']['options']) == {'student', 'teacher', 'doctor', 'employee'}
    assert sum(item['skill'] == 'listening' for item in bank) == 1
    assert any(item['skill'] == 'kanji' for item in bank)
    assert all('answer' not in item['public'] and 'transcript' not in item['public'] for item in bank)


def test_migration_repeatable_upgrade_downgrade_preserves_users():
    path = Path(__file__).parents[1] / 'alembic/versions/0014_placement.py'
    spec = importlib.util.spec_from_file_location('placement_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    assert migration.down_revision == '0013'
    engine = sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        connection.execute(sa.text('INSERT INTO users (id) VALUES (1)'))
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade(); migration.upgrade()
        assert 'placement_attempts' in sa.inspect(connection).get_table_names()
        assert sa.inspect(connection).get_foreign_keys('placement_attempts')[0]['referred_table'] == 'users'
        migration.downgrade(); migration.downgrade(); migration.upgrade()
        assert connection.execute(sa.text('SELECT id FROM users')).scalar() == 1
    engine.dispose()
