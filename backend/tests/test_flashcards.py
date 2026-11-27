import importlib.util
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.flashcards import router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import User, FlashcardDeck, FlashcardProgress, FlashcardSession, Vocabulary
from app.services import flashcards as svc


@pytest.fixture
def ctx():
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def setup(conn, record):
        conn.create_function('char_length', 1, len)
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    users = [User(email=f'fc{i}@example.test', username=f'fc{i}', hashed_password='x') for i in range(2)]
    db.add_all(users); db.commit()
    current = [0]
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: users[current[0]]
    with TestClient(app) as client:
        yield client, db, users, current
    db.close(); engine.dispose()


def make(client, count=3):
    r = client.post('/flashcards', json={'title': 'Test', 'jlpt_level': 'N5', 'cards': [{'front': f'word{i}', 'back': f'meaning{i}'} for i in range(count)]})
    assert r.status_code == 200, r.text
    return r.json()


def batch(client, cards, key='request01', correct=True):
    return client.post('/flashcards/reviews', json={'request_id': key, 'duration_seconds': 30, 'results': [{'card_id': c['id'], 'correct': correct} for c in cards]})


def test_owner_and_private(ctx):
    c, db, users, current = ctx
    deck = make(c)
    assert deck['is_private'] is True
    assert c.get('/flashcards').json()['total'] == 1
    current[0] = 1
    assert c.get('/flashcards').json()['total'] == 0
    for path, method, body in [('', 'get', None), ('', 'delete', None), ('/duplicate', 'post', None), ('/export', 'get', None), ('/cards', 'put', {'cards': []})]:
        assert c.request(method, f"/flashcards/{deck['id']}{path}", json=body).status_code == 404
    assert c.get('/flashcards/queue', params={'deck_id': deck['id']}).status_code == 404
    assert batch(c, deck['cards']).status_code == 404
    assert db.query(FlashcardSession).count() == 0


def test_scheduling_idempotency_and_queue(ctx):
    c, db, users, _ = ctx
    deck = make(c)
    first = deck['cards'][0]
    for stage in range(1, 4):
        assert batch(c, [first], f'request0{stage}').status_code == 200
        p = db.get(FlashcardProgress, (users[0].id, first['id']))
        assert p.stage == stage
        assert (p.due_at.replace(tzinfo=timezone.utc) - svc.now()).total_seconds() > 80000
    assert p.state == 'mastered'
    assert first['id'] not in [x['id'] for x in c.get('/flashcards/queue').json()['items']]
    assert batch(c, [first], 'request03').json()['replayed']
    assert p.correct == 3
    assert batch(c, [first], 'request03', False).status_code == 409
    assert batch(c, [first], 'request04', False).status_code == 200
    assert p.stage == 0 and p.state == 'learning' and p.wrong == 1
    q = c.get('/flashcards/queue').json()
    assert q['items'][0]['id'] == first['id']
    assert c.get('/flashcards/stats').json()['review_streak'] == 1
    assert c.get('/flashcards/stats', params={'deck_id': deck['id']}).json()['accuracy'] == 75


@pytest.mark.parametrize('field,separator', [('\t', '\n'), (';', '|'), ('::', '\n\n')])
def test_import_preview(ctx, field, separator):
    c = ctx[0]
    text = separator.join([f'犬{field}chó', 'broken', f'犬{field}chó', f'猫{field}mèo{field}ねこ'])
    result = c.post('/flashcards/import/preview', json={'text': text, 'field_separator': field, 'card_separator': separator}).json()
    assert len(result['cards']) == 2
    assert result['errors'] == [{'line': 2, 'code': 'invalidRow'}, {'line': 3, 'code': 'duplicate'}]
    assert result['cards'][1]['reading'] == 'ねこ'


def test_bulk_preserves_ids_and_reorders(ctx):
    c, db, users, _ = ctx
    deck = make(c)
    cards = deck['cards']
    batch(c, [cards[0]])
    result = c.put(f"/flashcards/{deck['id']}/cards", json={'cards': list(reversed(cards))}).json()
    assert [x['id'] for x in result['cards']] == [x['id'] for x in reversed(cards)]
    assert result['cards'][-1]['progress']['correct'] == 1
    cards[0]['back'] = 'changed'
    assert c.put(f"/flashcards/{deck['id']}/cards", json={'cards': cards}).status_code == 200
    assert db.get(FlashcardProgress, (users[0].id, cards[0]['id'])) is None
    result = c.put(f"/flashcards/{deck['id']}/cards/{cards[1]['id']}/star", json={'starred': True})
    assert result.json()['starred']
    assert len(c.get('/flashcards/queue?starred=true').json()['items']) == 1
    assert c.put(f"/flashcards/{deck['id']}/cards", json={'cards': cards[:1]}).status_code == 200
    assert c.get('/flashcards/queue?starred=true').json()['total'] == 0


def test_duplicate_resets_progress_and_export(ctx):
    c = ctx[0]; deck = make(c)
    batch(c, deck['cards'])
    copy = c.post(f"/flashcards/{deck['id']}/duplicate").json()
    assert copy['id'] != deck['id'] and copy['stats']['correct'] == 0
    assert copy['cards'][0]['id'] != deck['cards'][0]['id']
    for format in ['csv', 'text']:
        r = c.get(f"/flashcards/{deck['id']}/export?format={format}")
        assert r.status_code == 200 and 'front' in r.text and 'meaning0' in r.text


def test_transfer_once_and_deleted_tombstone(ctx):
    c = ctx[0]
    data = {'source': 'mobile', 'confirmed': True, 'decks': [{'local_id': 'abc', 'title': 'Old', 'cards': [{'front': 'a', 'back': 'b'}]}]}
    r = c.post('/flashcards/transfer', json=data).json()['items'][0]
    assert r['status'] == 'created'
    assert c.post('/flashcards/transfer', json=data).json()['items'][0]['status'] == 'already_transferred'
    assert c.get('/flashcards').json()['total'] == 1
    assert c.delete(f"/flashcards/{r['deck_id']}").status_code == 204
    assert c.post('/flashcards/transfer', json=data).json()['items'][0]['deck_id'] is None
    data['confirmed'] = False
    assert c.post('/flashcards/transfer', json=data).status_code == 422


def test_validation_and_limits(ctx, monkeypatch):
    c = ctx[0]
    for data in [{'title': ' '}, {'title': 'x', 'jlpt_level': 'N0'}, {'title': 'x', 'cards': [{'front': 'Ａ', 'back': 'B'}, {'front': 'a', 'back': 'b'}]}, {'title': 'x', 'cards': [{'front': 'x', 'back': 'b'}] * 501}]:
        assert c.post('/flashcards', json=data).status_code == 422
    monkeypatch.setattr(svc, 'MAX_DECKS', 1)
    make(c)
    assert c.post('/flashcards', json={'title': 'next'}).status_code == 422
    assert c.post('/flashcards/import/preview', json={'text': 'a;b', 'field_separator': ';', 'card_separator': ';'}).status_code == 422


def test_quick_create_and_original_untouched(ctx):
    c, db, *_ = ctx
    db.add(Vocabulary(japanese_word='猫', reading='ねこ', romaji='neko', meaning='mèo', jlpt_level='N5'))
    db.commit()
    for source in ['kanji', 'vocabulary']:
        r = c.post('/flashcards/quick-create', json={'title': source, 'source': source, 'level': 'N5', 'group': 0})
        assert r.status_code == 200, r.text
        assert 0 < len(r.json()['cards']) <= 20
        assert r.json()['cards'][0]['reading']
    assert db.query(Vocabulary).one().meaning == 'mèo'
    assert c.post('/flashcards/quick-create', json={'title': 'empty', 'source': 'vocabulary', 'level': 'N1'}).status_code == 422


def test_export_reset_delete_isolation(ctx):
    c, db, users, current = ctx
    deck = make(c); batch(c, deck['cards'])
    assert len(svc.export_data(db, users[0].id)['sessions']) == 1
    current[0] = 1; make(c)
    svc.clear_data(db, users[0].id); db.commit()
    assert svc.summary(db, users[0].id)['new'] == 3
    svc.clear_data(db, users[0].id, decks=True); db.commit()
    assert db.query(FlashcardDeck).count() == 1
    assert db.query(FlashcardDeck).one().user_id == users[1].id


def test_account_routes_export_reset_delete_preserve_other_account(ctx):
    c, db, users, current = ctx
    from app.api.auth import router as auth_router
    c.app.include_router(auth_router)
    deck = make(c); batch(c, deck['cards'])
    current[0] = 1; other = make(c); current[0] = 0
    r = c.get('/auth/me/export')
    assert r.status_code == 200, r.text
    assert r.json()['flashcards']['decks'][0]['id'] == deck['id']
    assert len(r.json()['flashcards']['sessions']) == 1
    assert c.post('/auth/me/reset-progress').status_code == 200
    assert c.get(f"/flashcards/{deck['id']}").json()['stats']['new'] == 3
    assert db.query(FlashcardSession).count() == 0
    assert c.delete('/auth/me').status_code == 204
    assert db.query(FlashcardDeck).one().id == other['id']


def test_card_crud_reorder_and_foreign_card(ctx):
    c, db, users, current = ctx
    deck = make(c, 1)
    base = f"/flashcards/{deck['id']}/cards"
    second = c.post(base, json={'front': 'second', 'back': 'two'}).json()['cards'][-1]
    assert c.put(f"{base}/{second['id']}", json={'front': 'updated', 'back': 'two'}).status_code == 200
    ids = [second['id'], deck['cards'][0]['id']]
    assert c.put(base+'/reorder', json={'card_ids': ids}).json()['cards'][0]['id'] == second['id']
    assert c.put(base+'/reorder', json={'card_ids': [ids[0], ids[0]]}).status_code == 422
    current[0] = 1; other = make(c, 1); current[0] = 0
    assert c.put(base, json={'cards': other['cards']}).status_code == 422
    assert c.delete(f"{base}/{second['id']}").status_code == 204


def test_list_search_filters_sort_and_query_bound(ctx):
    c, db, users, _ = ctx
    first = make(c)
    second = c.post('/flashcards', json={'title': 'Alpha', 'topic': 'animals', 'jlpt_level': 'N4'}).json()
    assert c.get('/flashcards?sort=name&limit=1').json()['items'][0]['id'] == second['id']
    assert c.get('/flashcards?level=N5&search=test').json()['total'] == 1
    assert c.get('/flashcards?topic=animals').json()['items'][0]['title'] == 'Alpha'
    assert c.get('/flashcards?offset=1&limit=1').json()['items'][0]['id'] == first['id']
    queries = []
    def record(conn, cursor, statement, parameters, context, executemany): queries.append(statement)
    sa.event.listen(db.get_bind(), 'before_cursor_execute', record)
    try:
        assert c.get('/flashcards?limit=100').status_code == 200
    finally:
        sa.event.remove(db.get_bind(), 'before_cursor_execute', record)
    assert len(queries) <= 3  # Owner fixture is in memory; 2 queries for the list.


def test_export_neutralizes_spreadsheet_formula(ctx):
    c = ctx[0]
    deck = c.post('/flashcards', json={'title': 'safe', 'cards': [{'front': '=1+1', 'back': '@SUM(A1)'}]}).json()
    text = c.get(f"/flashcards/{deck['id']}/export").text
    assert "'=1+1" in text and "'@SUM(A1)" in text


@pytest.mark.parametrize('format', ['csv', 'json', 'xlsx'])
def test_reuses_legacy_file_parser(ctx, format):
    import io
    import json
    import pandas as pd
    from app.api.game import router as game_router
    c = ctx[0]; c.app.include_router(game_router)
    rows = [{'front': '犬', 'back': 'chó', 'reading': 'いぬ', 'note': 'example'}]
    if format == 'csv': content = pd.DataFrame(rows).to_csv(index=False).encode('utf-8')
    elif format == 'json': content = json.dumps({'cards': rows}, ensure_ascii=False).encode('utf-8')
    else:
        stream = io.BytesIO(); pd.DataFrame(rows).to_excel(stream, index=False); content = stream.getvalue()
    r = c.post('/game/flashcard/import', files={'file': (f'cards.{format}', content)})
    assert r.status_code == 200, r.text
    assert r.json()['cards'] == rows


def test_migration_repeat_and_protect_nonempty():
    spec = importlib.util.spec_from_file_location('fc_migration', Path(__file__).resolve().parents[1] / 'alembic/versions/0024_flashcards.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        conn.execute(sa.text('INSERT INTO users VALUES (1)'))
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade(); migration.upgrade()
            conn.execute(sa.text("INSERT INTO flashcard_decks (user_id,title,description,topic) VALUES (1,'a','','')"))
            with pytest.raises(RuntimeError): migration.downgrade()
            assert 'flashcard_cards' in sa.inspect(conn).get_table_names()
            conn.execute(sa.text('DELETE FROM flashcard_decks'))
            migration.downgrade(); migration.downgrade(); migration.upgrade()
    engine.dispose()
