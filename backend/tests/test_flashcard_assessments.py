import importlib.util
import json
from pathlib import Path
import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.models.database import FlashcardAssessment, FlashcardSession, FlashcardProgress
from app.services.flashcard_assessments import accepts, grade
from test_flashcards import ctx, make


def start(c,deck,mode='test',types=None,count=10,key='assessment01',round_index=0):
    r=c.post('/flashcards/assessments',json={'request_id':key,'deck_id':deck['id'],'mode':mode,'types':types or ['choice','typed','true_false','match'],'count':count,'round_index':round_index})
    assert r.status_code==200,r.text
    return r.json()


def test_private_snapshot_no_answers_and_idempotent_grading(ctx):
    c,db,users,current=ctx;deck=make(c,20);test=start(c,deck)
    for q in test['questions']:
        assert not any(k in q for k in ('expected','accepted','card_ids','fingerprints','bindings','reading'))
    private=db.get(FlashcardAssessment,test['id'])
    ids=[cid for q in private.questions for cid in q['card_ids']]
    assert len(ids)==len(set(ids))
    answers=[{'question_id':q['id'],'answer':q['expected']} for q in private.questions]
    body={'duration_seconds':40,'answers':answers}
    r=c.post(f"/flashcards/assessments/{test['id']}/submit",json=body)
    assert r.status_code==200,r.text
    assert r.json()['result']['accuracy']==100
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).json()==r.json()
    assert db.query(FlashcardSession).count()==1
    assert db.query(FlashcardProgress).first().correct==1
    body['duration_seconds']=41
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).status_code==409
    current[0]=1
    assert c.get(f"/flashcards/assessments/{test['id']}").status_code==404
    assert c.get('/flashcards/sessions').json()['total']==0


def test_learn_rounds_and_recovery_keeps_wrong_due(ctx):
    c,db,users,_=ctx;deck=make(c,21)
    first=start(c,deck,'learn',key='learnround01')
    second=start(c,deck,'learn',key='learnround02',round_index=1)
    assert len(first['questions'])==len(second['questions'])==7
    rows=[db.get(FlashcardAssessment,x['id']) for x in (first,second)]
    assert not set(rows[0].questions[0]['card_ids'])&set(cid for q in rows[1].questions for cid in q['card_ids'])
    q=rows[0].questions[0];assert 'expected' in first['questions'][0]
    responses=[{'question_id':q['id'],'answer':'wrong'},{'question_id':q['id'],'answer':q['expected']}]
    r=c.post(f"/flashcards/assessments/{first['id']}/submit",json={'duration_seconds':10,'answers':responses})
    assert r.status_code==200,r.text
    assert r.json()['result']['wrong']==1
    p=db.get(FlashcardProgress,(users[0].id,q['card_ids'][0]))
    assert p.stage==0 and p.state=='learning' and p.wrong==1


def test_invalid_answers_changed_card_and_small_bank(ctx):
    c,db,*_=ctx;deck=make(c,1)
    test=start(c,deck,types=['match'],count=100)
    assert len(test['questions'])==1 and test['questions'][0]['type']=='typed'
    body={'duration_seconds':2,'answers':[]}
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).status_code==422
    body['answers']=[{'question_id':'unknown','answer':'word0'}]
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).status_code==422
    body['answers']=[{'question_id':test['questions'][0]['id'],'answer':'word0'}]
    c.put(f"/flashcards/{deck['id']}/cards/{deck['cards'][0]['id']}",json={'front':'changed','back':'b'})
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).status_code==409
    c.delete(f"/flashcards/assessments/{test['id']}")
    assert c.post(f"/flashcards/assessments/{test['id']}/submit",json=body).status_code==409


def test_multiple_readings_and_accepted_distractors_excluded(ctx):
    c,db,*_=ctx
    deck=c.post('/flashcards',json={'title':'readings','cards':[{'front':'月','back':'mặt trăng','reading':'つき、ゲツ;ガツ'},{'front':'つき','back':'month'},{'front':'neko','back':'cat'}]}).json()
    test=start(c,deck,types=['typed'],count=3)
    row=db.get(FlashcardAssessment,test['id'])
    moon=next(q for q in row.questions if q['prompt']=='mặt trăng')
    assert accepts('getsu',moon['accepted']) and accepts('tsuki',moon['accepted'])
    test=start(c,deck,types=['choice'],count=3,key='assessment02')
    row=db.get(FlashcardAssessment,test['id'])
    moon=next(q for q in row.questions if q['prompt']=='mặt trăng')
    assert all(option['label']!='つき' for option in moon['options'])


def test_study_activity_is_in_learning_history_without_jlpt_evidence(ctx):
    c,db,users,_=ctx;deck=make(c,1);test=start(c,deck,types=['typed'],count=1)
    q=db.get(FlashcardAssessment,test['id']).questions[0]
    c.post(f"/flashcards/assessments/{test['id']}/submit",json={'duration_seconds':30,'answers':[{'question_id':q['id'],'answer':q['expected']}]})
    from app.services.learning_history import LearningSnapshot
    snapshot=LearningSnapshot(db,users[0])
    assert any(row.source=='flashcard' and row.seconds==30 for row in snapshot.activities)


@pytest.mark.parametrize('answer,expected,correct',[
    ('neko','ねこ',True),('ＮＥＫＯ','ねこ',True),('ネコ','ねこ',True),('がっこう','ガッコウ',True),('gakkou','がっこう',True),
    ('gakkō','がっこう',True),('gakko','がっこう',False),('kippu','きっぷ',True),('sha','しゃ',True),('sya','しゃ',True),
    ('tsu','つ',True),('tu','つ',True),('chi','ち',True),('ti','ち',True),('shi','し',True),('si','し',True),
    ('fu','ふ',True),('hu','ふ',True),(' テスト ','てすと',True),('koohii','コーヒー',True),('coffee','コーヒー',False),
    (' CHÓ ','chó',True),('cho','chó',False),('cat','dog',False),('ji','じ',True),('zi','じ',True),('ryu','りゅ',True),
    ('pen','ぺん',True),('jisho','じしょ',True),('inu','いぬ',True)
])
def test_normalization(answer,expected,correct):
    assert bool(accepts(answer,[expected])) is correct


def test_history_export_and_delete(ctx):
    c,db,users,_=ctx;deck=make(c,3);test=start(c,deck,types=['typed'],count=3)
    questions=db.get(FlashcardAssessment,test['id']).questions
    r=c.post(f"/flashcards/assessments/{test['id']}/submit",json={'duration_seconds':3,'answers':[{'question_id':q['id'],'answer':q['expected']} for q in questions]})
    assert r.status_code==200
    assert c.get('/flashcards/sessions?limit=1').json()['total']==1
    from app.services.flashcards import export_data
    assert export_data(db,users[0].id)['assessments'][0]['result']['accuracy']==100
    assert c.delete(f"/flashcards/{deck['id']}").status_code==204
    assert db.query(FlashcardAssessment).count()==0


def test_kana_sources_identical_and_migration():
    root=Path(__file__).resolve().parents[2]
    assert json.loads((root/'shared-games/flashcard-kana.json').read_text(encoding='utf8'))==json.loads((root/'backend/app/data/flashcard_kana.json').read_text(encoding='utf8'))
    spec=importlib.util.spec_from_file_location('fc25',root/'backend/alembic/versions/0025_flashcard_assessments.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users(id INTEGER PRIMARY KEY)'));conn.execute(sa.text('CREATE TABLE flashcard_decks(id INTEGER PRIMARY KEY)'))
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade();migration.upgrade()
            conn.execute(sa.text("INSERT INTO flashcard_assessments (id,user_id,deck_id,request_key,payload_hash,mode,status,questions) VALUES ('x',1,1,'key','hash','test','active','[]')"))
            with pytest.raises(RuntimeError): migration.downgrade()
            assert 'flashcard_assessments' in sa.inspect(conn).get_table_names()
            conn.execute(sa.text('DELETE FROM flashcard_assessments'))
            migration.downgrade();migration.downgrade();migration.upgrade()
    engine.dispose()
