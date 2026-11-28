"""Real-source fixtures; AI is mocked and never called by the test suite."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dictionary import router
from app.core.database import Base, get_db
from app.core.config import settings
from app.models.database import Kanji, Vocabulary, User
from app.services import dictionary_service as dictionary
from app.services.openjlpt_import import import_entries, normalize_entry
from app.services.vocabulary_text import display_meaning

FIXTURE = json.loads((Path(__file__).parent / 'data/openjlpt_sample.json').read_text(encoding='utf8'))
ROWS = FIXTURE['entries']
VERSION = FIXTURE['provenance']['version'] + '@' + FIXTURE['provenance']['commit']


@pytest.fixture
def db(monkeypatch):
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def sqlite_functions(connection, _):
        connection.create_function('char_length', 1, len)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', False)
    dictionary.quota.events.clear()
    yield session
    session.close(); engine.dispose()


def seed(db):
    result = import_entries(db, ROWS, VERSION, dry_run=False, batch_size=3)
    db.commit()
    return result


def word(db, romaji='taberu'):
    return db.query(Vocabulary).filter(Vocabulary.romaji == romaji).first()


def test_real_fixture_attribution_and_full_shape():
    assert len(ROWS) == 17 and FIXTURE['provenance']['license'] == 'CC-BY-SA-4.0'
    assert all(normalize_entry(row) for row in ROWS)
    assert any(row.get('jmdict_id') and row.get('examples', [{}])[0].get('furigana') for row in ROWS)


def test_preview_is_read_only_and_import_repeats_without_duplicates(db):
    report = import_entries(db, ROWS, VERSION)
    assert sum(s['added'] for s in report['levels'].values()) == len(ROWS)
    assert not db.new and db.query(Vocabulary).count() == 0
    seed(db)
    ids = {row.source_id: row.id for row in db.query(Vocabulary)}
    again = import_entries(db, ROWS, VERSION, dry_run=False); db.commit()
    assert sum(s['updated'] + s['added'] for s in again['levels'].values()) == 0
    assert {row.source_id: row.id for row in db.query(Vocabulary)} == ids
    assert all(row.meaning == '' and row.meaning_vi_status == 'missing' for row in db.query(Vocabulary))


def test_import_preserves_reviewed_vi_examples_level_and_matches_word_plus_reading(db):
    records = [r for r in ROWS if r['word'] == '開く']
    assert len(records) == 2 and len({r['reading'] for r in records}) == 2
    row = Vocabulary(japanese_word=records[0]['word'], reading=records[0]['reading'], meaning='nghĩa đã duyệt',
        jlpt_level='N2', example_sentences=[{'ja': 'cũ', 'vi': 'giữ nguyên'}])
    db.add(row); db.commit(); saved_id = row.id
    report = import_entries(db, records, VERSION, dry_run=False); db.commit()
    assert db.query(Vocabulary).count() == 2 and row.id == saved_id
    assert row.meaning == 'nghĩa đã duyệt' and row.jlpt_level == 'N2' and row.meaning_vi_status == 'reviewed'
    assert row.example_sentences[0]['vi'] == 'giữ nguyên'
    assert report['reasons']['existing_level_preserved'] == 1
    snapshot = deepcopy(row.source_metadata)
    import_entries(db, records, VERSION)
    assert row.source_metadata == snapshot and not db.dirty


@pytest.mark.parametrize('change', [{'id': 'bad'}, {'reading': 'not kana'}, {'meanings': []},
    {'level': 'N0'}, {'jmdict_id': True}, {'examples': [{'ja': '日本', 'en': 'Japan', 'furigana': '{語|ご}'}]}])
def test_malformed_records_are_reported_without_inserting(db, change):
    report = import_entries(db, [{**ROWS[0], **change}], VERSION, dry_run=False)
    assert sum(s['invalid'] for s in report['levels'].values()) == 1
    assert report['errors'] and db.query(Vocabulary).count() == 0


def test_duplicate_input_and_changed_stable_id_do_not_replace_identity(db):
    report = import_entries(db, [ROWS[0], ROWS[0]], VERSION, dry_run=False); db.commit()
    assert db.query(Vocabulary).count() == 1 and report['reasons']['duplicate_input'] == 1
    changed = {**ROWS[0], 'word': '会います'}
    report = import_entries(db, [changed], VERSION, dry_run=False)
    assert report['reasons']['identity_conflict_preserved'] == 1
    assert db.query(Vocabulary).first().japanese_word == ROWS[0]['word']


def test_search_multilingual_ranking_filters_and_literal_wildcards(db):
    seed(db)
    school = word(db, 'gakkou'); school.meaning = 'trường học'; school.meaning_vi_status = 'reviewed'; db.commit()
    for query in ('学校', 'がっこう', 'gakkou', 'trường học', 'truong hoc', 'school'):
        rows, total = dictionary.search_rows(db, query)
        assert total and school.id in {row.id for row in rows}
    assert dictionary.search_rows(db, 'taberu')[0][0].japanese_word == '食べる'
    school.meaning_en += ' taberu'; db.commit()
    ranked, total = dictionary.search_rows(db, 'taberu')
    assert total >= 2 and ranked[0].japanese_word == '食べる'
    assert dictionary.search_rows(db, 'タベル')[0][0].japanese_word == '食べる'
    assert not dictionary.search_rows(db, '%')[1]
    rows, total = dictionary.search_rows(db, '', 'N5', 'v5u', limit=1)
    assert total >= 1 and len(rows) == 1 and 'v5u' in rows[0].part_of_speech


def test_dictionary_api_detail_pagination_and_real_furigana(db, monkeypatch):
    db.add(Kanji(character='学', meaning_vi='học', jlpt_level='N5', stroke_count=8)); db.commit()
    seed(db)
    app = FastAPI(); app.include_router(router, prefix='/api')
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(dictionary, 'local_translate', lambda _: pytest.fail('GET must never translate'))
    with TestClient(app) as client:
        response = client.get('/api/dictionary', params={'limit': 2, 'offset': 1})
        assert response.status_code == 200 and len(response.json()['items']) == 2 and response.json()['total'] == len(ROWS)
        detail = client.get(f'/api/dictionary/{word(db, "gakkou").id}').json()
        assert detail['reading'] == 'がっこう' and detail['source']['jmdict_id']
        assert detail['examples'][0]['furigana'] and detail['examples'][0]['source'] == 'Tatoeba'
        assert detail['examples'][0]['source_url'].startswith('https://tatoeba.org/')
        assert any(c['character'] == '学' and c['available'] and c['url'] for c in detail['related_kanji'])
        assert detail['notices'] and detail['display_meaning'].startswith('[EN] ')
        assert client.get('/api/dictionary', params={'limit': 101}).status_code == 422
        assert client.get('/api/dictionary/999999').status_code == 404
        assert client.post(f'/api/dictionary/{word(db).id}/translation').status_code in (401, 403)


def test_existing_consumers_use_labeled_english_and_preserve_vietnamese(db):
    from app.api.kanji import vocabulary_to_schema, router as legacy_router
    from app.services.daily_task_service import _vocab_candidates, _flashcard_candidates
    from app.services.library_service import library_service
    seed(db)
    row = word(db)
    assert vocabulary_to_schema(row).meaning_vi.startswith('[EN] ')
    assert _vocab_candidates(db, 999, 'N5', set()) and _flashcard_candidates(db, 999, 'N5', set())
    assert all(item['answer_key']['correct_answer'].startswith('[EN] ') for item in _vocab_candidates(db, 999, 'N5', set()))
    app = FastAPI(); app.include_router(legacy_router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        legacy = client.get('/vocabulary', params={'search': 'taberu'})
        assert legacy.status_code == 200 and legacy.json()['items'][0]['meaning_vi'].startswith('[EN] ')
        duplicate = client.post('/vocabulary', json={'word': row.japanese_word, 'reading': row.reading,
            'meaning_vi': 'không ghi đè', 'jlpt_level': 'N5'})
        assert duplicate.status_code == 409 and not row.meaning
    pairs = library_service.vocabulary_matching_pairs(db, 'N5', 12)
    assert len({p['left'] for p in pairs}) == len(pairs) and all(p['meaning'].startswith('[EN] ') for p in pairs)
    row.meaning = 'ăn'; row.meaning_vi_status = 'reviewed'; db.commit()
    assert vocabulary_to_schema(row).meaning_vi == 'ăn'


def test_authenticated_translation_endpoint_uses_typed_cache_response(db, monkeypatch):
    from types import SimpleNamespace
    from app.core.auth import get_current_active_user
    seed(db)
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', True)
    calls = []
    def fake(_):
        calls.append(1); return 'ăn'
    monkeypatch.setattr(dictionary, 'local_translate', fake)
    app = FastAPI(); app.include_router(router, prefix='/api')
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: SimpleNamespace(id=7)
    with TestClient(app) as client:
        endpoint = f'/api/dictionary/{word(db).id}/translation'
        first = client.post(endpoint)
        assert first.status_code == 200 and first.json()['translation'] == 'generated'
        assert first.json()['entry']['meanings'][0]['source']['name'] == 'local_ai'
        assert client.post(endpoint).json()['translation'] == 'cached' and len(calls) == 1


def test_download_refuses_directory_outside_project_before_any_network_call(tmp_path):
    from scripts.import_openjlpt import download
    with pytest.raises(ValueError, match='inside the project'):
        download(tmp_path)


def test_translation_disabled_or_cached_never_calls_model(db):
    seed(db); row = word(db)
    forbidden = lambda _: pytest.fail('Model must not be called')
    assert dictionary.translate_one(db, row, 1, forbidden)['translation'] == 'disabled'
    row.meaning = 'ăn'; row.meaning_vi_status = 'reviewed'; db.commit()
    assert dictionary.translate_one(db, row, 1, forbidden)['translation'] == 'cached'


def test_translation_is_cached_labeled_unreviewed_and_excluded_from_grading(db, monkeypatch):
    seed(db); row = word(db); calls = []
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', True)
    def fake(_):
        calls.append(1); return 'ăn'
    result = dictionary.translate_one(db, row, 1, fake)
    assert result['translation'] == 'generated' and row.meaning_vi_status == 'automatic'
    assert result['entry']['meaning_vi'] == 'ăn' and 'dictionaryData.automaticMeaning' in result['entry']['notices']
    assert display_meaning(row).startswith('[EN] ')
    assert dictionary.translate_one(db, row, 1, fake)['translation'] == 'cached' and len(calls) == 1
    import_entries(db, ROWS, VERSION + '-refresh', dry_run=False); db.commit()
    assert row.meaning == 'ăn' and row.meaning_vi_status == 'automatic'
    assert row.source_metadata['vi_translation']['dataset_version'] == VERSION


def test_translation_model_unavailable_uses_english_and_word_cooldown(db, monkeypatch):
    seed(db); row = word(db)
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', True)
    def unavailable(_):
        raise OSError('not running')
    result = dictionary.translate_one(db, row, 2, unavailable)
    assert result['translation'] == 'unavailable' and not row.meaning and result['entry']['meaning_en']
    with pytest.raises(HTTPException) as error:
        dictionary.translate_one(db, row, 3, unavailable)
    assert error.value.status_code == 429


def test_translation_user_quota_and_concurrent_human_update(db, monkeypatch):
    seed(db)
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', True)
    monkeypatch.setattr(settings, 'dictionary_translation_per_minute', 1)
    def reviewed_during_generation(row):
        row.meaning = 'nghĩa người duyệt'; row.meaning_vi_status = 'reviewed'; db.commit()
        return 'ăn'
    result = dictionary.translate_one(db, word(db), 5, reviewed_during_generation)
    assert result['translation'] == 'cached' and result['entry']['meaning_vi'] == 'nghĩa người duyệt'
    with pytest.raises(HTTPException) as error:
        dictionary.translate_one(db, word(db, 'gakkou'), 5, lambda _: 'trường học')
    assert error.value.status_code == 429


@pytest.mark.parametrize('text', ['to eat', '这个', 'English explanation only', '', 'x' * 601])
def test_invalid_ai_output_is_never_cached(db, monkeypatch, text):
    seed(db); row = word(db)
    monkeypatch.setattr(settings, 'dictionary_ai_translation_enabled', True)
    assert dictionary.translate_one(db, row, 1, lambda _: text)['translation'] == 'unavailable'
    assert not row.meaning


def test_migration_upgrade_downgrade_repeat_and_protect_new_data():
    path = Path(__file__).resolve().parents[1] / 'alembic/versions/0014_openjlpt_dictionary.py'
    spec = importlib.util.spec_from_file_location('openjlpt_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE vocabulary (id INTEGER PRIMARY KEY, japanese_word TEXT NOT NULL, reading TEXT NOT NULL, romaji TEXT, meaning TEXT NOT NULL, jlpt_level TEXT, part_of_speech TEXT, example_sentences JSON, UNIQUE(japanese_word, reading))'))
        connection.execute(sa.text("INSERT INTO vocabulary VALUES (1, 'old', 'old', 'old', 'giữ nguyên', 'N5', 'noun', '[]')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade(); migration.upgrade()
            assert connection.execute(sa.text('SELECT meaning FROM vocabulary')).scalar() == 'giữ nguyên'
            assert {'uq_vocabulary_source_id', 'ix_vocabulary_level_pos'} <= {i['name'] for i in sa.inspect(connection).get_indexes('vocabulary')}
            migration.downgrade(); migration.downgrade(); migration.upgrade()
            connection.execute(sa.text("UPDATE vocabulary SET meaning_en='preserve this'") )
            with pytest.raises(RuntimeError, match='Downgrade refused'):
                migration.downgrade()
            assert connection.execute(sa.text('SELECT meaning_en FROM vocabulary')).scalar() == 'preserve this'
    engine.dispose()
