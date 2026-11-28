import importlib.util,json
from pathlib import Path
from datetime import datetime,timezone
import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base,get_db
from app.core.auth import get_current_active_user
from app.models.database import User,UserKanjiNote,MinigameLearningEvent,UserGameProfile
from app.api import kanji_notes,minigame_learning
from app.services.minigame_learning import words,pending_wrong_counts
from app.services.learning_history import LearningSnapshot
from app.services.daily_task_service import _vocab_candidates,_wrong_counts

@pytest.fixture
def context():
    engine=sa.create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @sa.event.listens_for(engine,'connect')
    def setup(conn,record):conn.create_function('char_length',1,len);conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine);db=sessionmaker(bind=engine,expire_on_commit=False)()
    users=[User(email=f'arcade{i}@example.test',username=f'arcade{i}',hashed_password='test',current_jlpt_level='N3',ui_language='vi') for i in range(2)]
    db.add_all(users);db.commit();current=[users[0]]
    app=FastAPI();app.include_router(kanji_notes.router,prefix='/api');app.include_router(minigame_learning.router,prefix='/api')
    from app.api.auth import router
    app.include_router(router,prefix='/api')
    app.dependency_overrides[get_db]=lambda:db;app.dependency_overrides[get_current_active_user]=lambda:current[0]
    with TestClient(app) as client:yield client,db,users,current
    db.close();engine.dispose()

def event(key='round:1',kind='kanji',source='日',level='N5',action='wrong',answer=''):
    return {'event_id':key,'game':'falling','level':level,'source_type':kind,'source_id':source,'action':action,'answer':answer}

def test_note_dictionary_private_edits_refill_defaults_and_account_export(context):
    client,db,users,current=context
    data=client.get('/api/kanji-notes/際').json()
    assert data['dictionary']['stroke_count']==14 and data['dictionary']['jlpt']=='N3'
    assert data['defaults']['sino_vietnamese']=='TẾ'
    body={'sino_vietnamese':'TẾ','meaning_vi':'Nghĩa riêng','mnemonic':'Câu chuyện riêng <script>không thực thi</script>.'}
    saved=client.put('/api/kanji-notes/際',json=body)
    assert saved.status_code==200 and saved.json()['note']['meaning_vi']=='Nghĩa riêng'
    assert saved.json()['defaults']['meaning_vi']!='Nghĩa riêng'
    current[0]=users[1];assert client.get('/api/kanji-notes/際').json()['note'] is None
    current[0]=users[0]
    assert len(client.get('/api/auth/me/export').json()['kanji_notes'])==1
    assert client.put('/api/kanji-notes/際',json={**body,'mnemonic':'x'*2001}).status_code==422
    assert client.get('/api/kanji-notes/a').status_code==422
    unknown=client.get('/api/kanji-notes/龘').json();assert unknown['dictionary'] is None and not unknown['defaults']['sino_vietnamese']
    assert client.delete('/api/auth/me').status_code==204 and db.query(UserKanjiNote).count()==0

def test_sync_owned_idempotent_conflict_and_wallet_unchanged(context):
    client,db,users,current=context
    body={'events':[event()]}
    assert client.post('/api/minigames/learning-events',json=body).status_code==200
    assert client.post('/api/minigames/learning-events',json=body).status_code==200
    assert db.query(MinigameLearningEvent).count()==1 and db.query(UserGameProfile).count()==0
    assert client.post('/api/minigames/learning-events',json={'events':[event(answer='changed')]}).status_code==409
    current[0]=users[1];assert client.get('/api/minigames/review').json()['total']==0
    assert client.post('/api/minigames/learning-events',json=body).status_code==200
    assert db.query(MinigameLearningEvent).count()==2
    assert client.post('/api/minigames/learning-events',json={'events':[event(key='invalid',source='not a kanji')]}).status_code==422
    assert client.get('/api/minigames/review?limit=101').status_code==422

def test_review_latest_order_within_same_batch_and_mastery_proxy(context):
    client,db,users,_=context
    entries=[event(),event(key='review:1',action='reviewed',answer='ニチ')]
    assert client.post('/api/minigames/learning-events',json={'events':entries}).status_code==200
    assert client.get('/api/minigames/review').json()['total']==0
    assert client.post('/api/minigames/learning-events',json={'events':[event(key='again')]}).status_code==200
    assert client.get('/api/minigames/review').json()['total']==1
    snapshot=LearningSnapshot(db,users[0]);events=[e for e in snapshot.events if e.source=='minigame_review']
    assert len(events)==3 and all(e.reliability<.5 for e in events)
    assert any(getattr(row,'source',None)=='minigame' for row in snapshot.due)
    assert _wrong_counts(db,users[0].id,'kanji')['日']>=1

def test_word_errors_feed_daily_real_level_and_unknowns_do_not(context):
    client,db,users,_=context;word=next(iter(words().values()))
    body=event(kind='word',source=word['id'],level=word['level'])
    assert client.post('/api/minigames/learning-events',json={'events':[body]}).status_code==200
    candidates=_vocab_candidates(db,users[0].id,word['level'],set())
    selected=next(c for c in candidates if c['source_id']==f"minigame:{word['id']}")
    assert len(set(selected['payload']['options']))==4 and selected['payload']['level']==word['level']
    assert not _vocab_candidates(db,users[0].id,'N5',set())
    exported=client.get('/api/auth/me/export').json();assert len(exported['minigame_learning_events'])==1
    assert client.post('/api/auth/me/reset-progress').status_code==200 and db.query(MinigameLearningEvent).count()==0

@pytest.mark.parametrize('filename,previous,table,insert',[
    ('0021_kanji_notes.py','0020','user_kanji_notes',"INSERT INTO user_kanji_notes (user_id,kanji) VALUES (1,'日')"),
    ('0022_minigame_learning.py','0021','minigame_learning_events',"INSERT INTO minigame_learning_events (user_id,event_key,game,source_type,source_id,action) VALUES (1,'e','falling','kanji','日','wrong')")])
def test_new_migrations_repeat_and_guard_populated_history(filename,previous,table,insert):
    spec=importlib.util.spec_from_file_location('feature_migration',Path(__file__).parents[1]/'alembic/versions'/filename)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration);assert migration.down_revision==previous
    engine=sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'));migration.op=Operations(MigrationContext.configure(conn))
        migration.upgrade();migration.upgrade();migration.downgrade();migration.downgrade();migration.upgrade()
        conn.execute(sa.text(insert))
        with pytest.raises(RuntimeError,match='No data was removed'):migration.downgrade()
    engine.dispose()
