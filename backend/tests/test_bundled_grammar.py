from collections import Counter
from copy import deepcopy
import json
import shutil
import socket

import pytest
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.auth import get_current_active_user
from app.models.database import Document, GrammarLesson, GrammarLessonProgress, GrammarQuestion, GrammarRule, User
from app.services.bundled_grammar import DATA_DIRECTORY, hanabira_pattern, lesson_key, load_catalog, pattern_key, sync_bundled_grammar
from app.services.grammar_lessons import LessonExample


@pytest.fixture
def db():
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def foreign_keys(conn, _):
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine, tables=[User.__table__, Document.__table__, GrammarRule.__table__, GrammarQuestion.__table__, GrammarLesson.__table__, GrammarLessonProgress.__table__])
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close(); engine.dispose()


@pytest.fixture(scope='module')
def catalog():
    return load_catalog()


def test_committed_sources_verify_counts_licenses_and_all_five_levels(catalog):
    assert len(catalog) == 904
    assert Counter(row['jlpt_level'] for row in catalog) == {'N5': 156, 'N4': 144, 'N3': 139, 'N2': 200, 'N1': 265}
    manifest = json.loads((DATA_DIRECTORY / 'manifest.json').read_text(encoding='utf-8'))
    assert sum(value['count'] for value in manifest['sources']['hanabira']['files'].values() if 'count' in value) == 828
    assert sum(value['count'] for value in manifest['sources']['openjlpt']['files'].values() if 'count' in value) == 100
    assert manifest['sources']['openjlpt']['revision'] == 'c42fd9fa3777bfc1775446f7c418d549dfd6e4cf'
    assert {source['license'] for row in catalog for source in row['sources']} == {'CC BY 4.0', 'CC BY-SA 4.0'}
    assert any(len(row['sources']) == 2 for row in catalog)
    assert all(row['formation'] and row['meaning'] and row['sources'] for row in catalog)
    assert all(example['ja'] and example['en'] and not example.get('vi') for row in catalog for example in row['examples'])


def test_checksum_failure_is_reported_before_any_db_import(tmp_path):
    directory = tmp_path / 'sources'
    shutil.copytree(DATA_DIRECTORY, directory)
    with (directory / 'hanabira/n3.json').open('ab') as file:
        file.write(b' ')
    with pytest.raises(ValueError, match='checksum mismatch'):
        load_catalog(directory)


def test_keys_are_stable_and_only_safe_equivalences_are_merged():
    assert lesson_key('N3', '〜ことだ') == lesson_key('N3', ' ～ ことだ ')
    assert lesson_key('N3', '〜ことだ') != lesson_key('N2', '〜ことだ')
    assert lesson_key('N3', 'ことだ') != lesson_key('N3', 'ことはない')
    assert hanabira_pattern('A その上 B (A sono ue B)') == 'A その上 B'
    assert hanabira_pattern('の (です)') == 'の (です)'
    assert pattern_key('Ａ ～ は') == 'Aは'


def test_full_import_is_offline_cwd_independent_and_repeatable(db, catalog, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    def reject_network(*args, **kwargs):
        raise AssertionError('Bundled grammar import must not use the network')
    monkeypatch.setattr(socket, 'create_connection', reject_network)
    first = sync_bundled_grammar(db)
    db.commit()
    original_ids = {row.source_key: (row.id, row.grammar_rule_id) for row in db.query(GrammarLesson)}
    second = sync_bundled_grammar(db)
    db.commit()
    assert first['created'] == 904 and first['rules_created'] == 904
    assert second['created'] == second['updated'] == second['rules_created'] == 0
    assert second['unchanged'] == 904
    assert original_ids == {row.source_key: (row.id, row.grammar_rule_id) for row in db.query(GrammarLesson)}
    assert db.query(GrammarRule).count() == db.query(GrammarLesson).count() == len(catalog)


def test_reuses_existing_rules_and_preserves_progress_and_question_answers(db, catalog):
    record = deepcopy(next(row for row in catalog if row['jlpt_level'] == 'N3'))
    user = User(email='learner@test.local', username='learner', hashed_password='x')
    rule = GrammarRule(id=7500, rule_name='Existing teacher wording', japanese_pattern=record['pattern'], meaning='Existing meaning', jlpt_level='N3')
    db.add_all([user, rule]); db.flush()
    question = GrammarQuestion(grammar_rule_id=rule.id, jlpt_level='N3', question_type='fill_blank', prompt='Test', payload={'options': ['a', 'b']}, correct_answer='a', explanation_vi='Existing explanation', source='seed', is_active=True)
    db.add(question); db.commit()
    assert sync_bundled_grammar(db, [record])['rules_created'] == 0
    db.commit()
    lesson = db.query(GrammarLesson).one()
    assert lesson.grammar_rule_id == 7500
    db.add(GrammarLessonProgress(user_id=user.id, lesson_id=lesson.id, status='mastered')); db.commit()
    lesson_id = lesson.id
    record['meaning'] += ' Updated source wording.'
    assert sync_bundled_grammar(db, [record])['updated'] == 1
    db.commit()
    assert db.query(GrammarLesson).one().id == lesson_id
    assert db.get(GrammarLessonProgress, (user.id, lesson_id)).status == 'mastered'
    assert db.get(GrammarRule, 7500).meaning == 'Existing meaning'
    assert db.get(GrammarQuestion, question.id).correct_answer == 'a'
    assert db.query(GrammarQuestion).count() == 1


def test_existing_custom_lesson_is_never_replaced(db, catalog):
    record = deepcopy(catalog[0])
    rule = GrammarRule(rule_name='Custom', japanese_pattern=record['pattern'], meaning='Custom', jlpt_level=record['jlpt_level'])
    db.add(rule); db.flush()
    custom = GrammarLesson(source_key='teacher-supplied-lesson', grammar_rule_id=rule.id, jlpt_level=record['jlpt_level'], sort_order=0, formation='Teacher formation', meaning='Teacher meaning', usage_notes='', examples=[], common_errors=[], comparisons=[])
    db.add(custom); db.commit()
    result = sync_bundled_grammar(db, [record]); db.commit()
    assert result['skipped'] == 1 and result['created'] == 0
    assert db.query(GrammarLesson).one().meaning == 'Teacher meaning'


def test_invalid_batch_never_partially_adds_rules_or_lessons(db, catalog):
    invalid = deepcopy(catalog[1]); invalid['formation'] = ''
    with pytest.raises(ValueError):
        sync_bundled_grammar(db, [catalog[0], invalid])
    assert db.query(GrammarRule).count() == db.query(GrammarLesson).count() == 0
    invalid = deepcopy(catalog[0]); invalid['source_key'] = 'teacher-custom-key'
    with pytest.raises(ValueError, match='does not match'):
        sync_bundled_grammar(db, [invalid])
    assert db.query(GrammarRule).count() == 0


def test_example_language_validation_remains_compatible():
    assert LessonExample(ja='日本', vi='Nhật Bản').vi == 'Nhật Bản'
    assert LessonExample(ja='日本', en='Japan').en == 'Japan'
    with pytest.raises(ValueError):
        LessonExample(ja='日本', vi=' ', en=' ')


def test_new_database_api_has_all_levels_english_examples_and_source_attribution(db, catalog):
    from app.api.grammar_lessons import router
    user = User(email='reader@test.local', username='reader', hashed_password='x')
    db.add(user); db.commit()
    sync_bundled_grammar(db); db.commit()
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as client:
        for level in ['N5', 'N4', 'N3', 'N2', 'N1']:
            page = client.get('/grammar-lessons', params={'level': level})
            assert page.status_code == 200 and page.json()['items']
            item = page.json()['items'][0]
            detail = client.get(f"/grammar-lessons/{item['id']}")
            assert detail.status_code == 200
            body = detail.json()
            assert body['content_language'] == 'en' and body['examples'][0]['en']
            assert body['sources'][0]['license_url'].startswith('https://creativecommons.org/')
            assert body['status'] == 'not_started'
            assert 'correct_answer' not in detail.text
        lesson = client.get('/grammar-lessons?level=N3').json()['items'][0]
        assert client.put(f"/grammar-lessons/{lesson['id']}/progress", json={'status': 'mastered'}).status_code == 200
        sync_bundled_grammar(db); db.commit()
        assert client.get(f"/grammar-lessons/{lesson['id']}").json()['status'] == 'mastered'


def test_actual_startup_populates_a_fresh_database_without_fetching(monkeypatch, tmp_path):
    import app.main as main
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def postgres_text_functions(conn, _):
        conn.create_function('char_length', 1, len)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(main, 'engine', engine)
    monkeypatch.setattr(main, 'SessionLocal', factory)
    monkeypatch.setattr(main.settings, 'seed_bundled_grammar', True)
    monkeypatch.setattr(main.settings, 'reminders_enabled', False)
    monkeypatch.setattr(main, 'get_model_info', None)
    monkeypatch.setattr(main, 'stop_reminder_scheduler', lambda: None)
    monkeypatch.setattr(main.kanji_dictionary_service, 'validate', lambda: {'total_entries': 0, 'valid_entries': 0, 'missing_metadata_count': 0})
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(socket, 'create_connection', lambda *args, **kwargs: pytest.fail('Startup tried to fetch grammar online'))
    app = FastAPI(lifespan=main.lifespan)
    try:
        with TestClient(app):
            with factory() as db:
                assert db.query(GrammarLesson).count() == 904
                ids = {row.source_key: row.id for row in db.query(GrammarLesson)}
        with TestClient(app):
            with factory() as db:
                assert ids == {row.source_key: row.id for row in db.query(GrammarLesson)}
    finally:
        engine.dispose()
