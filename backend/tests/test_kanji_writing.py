import importlib.util
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api.kanji_writing import router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import User, KanjiWritingAttempt
from app.services.kanji_stroke_geometry import evaluate, normalize, svg_points
from app.services.kanji_writing_templates import templates, comparison_templates, confusion_candidates, evaluate_character
from app.services.learning_history import LearningSnapshot


@pytest.fixture
def context():
    engine=sa.create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @sa.event.listens_for(engine,'connect')
    def setup(conn,record):
        conn.create_function('char_length',1,len); conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    db=sessionmaker(bind=engine,autoflush=False)()
    users=[User(email=f'writing{i}@example.test',username=f'writing{i}',hashed_password='test',current_jlpt_level='N5') for i in range(2)]
    db.add_all(users);db.commit()
    current=[users[0]]
    app=FastAPI();app.include_router(router,prefix='/api')
    from app.api.auth import router as auth_router
    app.include_router(auth_router,prefix='/api')
    app.dependency_overrides[get_db]=lambda:db
    app.dependency_overrides[get_current_active_user]=lambda:current[0]
    with TestClient(app) as client:
        yield client,db,users,current
    db.close();engine.dispose()


def payload(kanji='土',final=False):
    return {'kanji':kanji,'strokes':[[{'x':x,'y':y} for x,y in stroke] for stroke in templates()[kanji]['raw']],
            'final':final,'attempt_id':str(uuid.uuid4())}


@pytest.mark.parametrize('profile', ['very_easy', 'easy', 'standard', 'strict', 'very_strict'])
def test_five_profiles_persist_scores_and_explain_weights(context, profile):
    from app.core.kanji_writing_config import PROFILES, SCORE_WEIGHTS, PASS_SCORE
    client, db, users, current = context
    body = {**payload(final=True), 'strictness': profile}
    response = client.post('/api/kanji-writing/evaluate', json=body)
    assert response.status_code == 200
    data = response.json()
    assert data['strictness'] == profile and data['thresholds'] == PROFILES[profile]
    assert data['passed'] and data['overall_score'] == 100
    assert data['score_weights'] == SCORE_WEIGHTS and data['pass_score'] == PASS_SCORE
    assert sum(data['score_weights'].values()) == pytest.approx(1)
    stored = db.query(KanjiWritingAttempt).filter_by(attempt_key=body['attempt_id']).one()
    assert stored.result['score_weights'] == data['score_weights']
    assert client.post('/api/kanji-writing/evaluate', json=body).json() == data
    assert db.query(KanjiWritingAttempt).count() == 1


def test_new_profiles_preserve_old_thresholds_and_have_ordered_tolerance():
    from app.core.kanji_writing_config import PROFILES
    assert PROFILES['easy'] == {'distance': .20, 'endpoint': .32, 'length_ratio': .35, 'order_margin': .035}
    assert PROFILES['standard'] == {'distance': .16, 'endpoint': .26, 'length_ratio': .42, 'order_margin': .025}
    assert PROFILES['strict'] == {'distance': .10, 'endpoint': .17, 'length_ratio': .60, 'order_margin': .020}
    profiles = list(PROFILES.values())
    for loose, strict in zip(profiles, profiles[1:]):
        assert loose['distance'] > strict['distance']
        assert loose['endpoint'] > strict['endpoint']
        assert loose['length_ratio'] < strict['length_ratio']
    raw = templates()['土']['raw']
    invalid = {**payload(), 'strictness': 'unknown'}
    from app.api.kanji_writing import WritingRequest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        WritingRequest(**invalid)
    for profile in PROFILES:
        score = evaluate([list(reversed(raw[0])), *raw[1:]], raw, strictness=profile)
        assert score['scores']['direction'] < 100
        assert score['scores']['order'] == 100


def test_parser_relative_smooth_cubic_and_uniform_character_transform():
    a=svg_points('M 1,2 c 1,0 2,0 3,0 s 2,0 3,0')
    assert a[0]==(1,2) and a[-1]==(7,2)
    strokes=[[(0,0),(100,0)],[(20,100),(40,100)]]
    values=normalize(strokes)
    assert values[1][0][0]==pytest.approx(.2)
    assert values[1][-1][0]==pytest.approx(.4)
    assert values[1][0][1]==pytest.approx(1)
    assert values==normalize([[(x*3+17,y*3-80) for x,y in s] for s in strokes])
    with pytest.raises(ValueError):svg_points('M0 0 A1 2 3 4 5 6 7')


def test_all_612_real_templates_grade_themselves_and_only_supported_levels():
    bank=templates()
    assert len(bank)==612
    assert {item['level'] for item in bank.values()}=={'N5','N4','N3'}
    for item in bank.values():
        result=evaluate(item['raw'],item['raw'])
        assert result['passed'] and result['overall_score']==100


def test_order_direction_missing_extra_shape_and_noise():
    raw=templates()['土']['raw']
    assert evaluate([raw[1],raw[0],raw[2]],raw)['strokes'][0]['status']=='wrong_order'
    reversed_strokes=[list(reversed(raw[0])),*raw[1:]]
    result=evaluate(reversed_strokes,raw)
    assert result['strokes'][0]['status']=='wrong_direction' and not result['passed']
    assert evaluate(raw[:-1],raw)['strokes'][-1]['status']=='missing'
    assert evaluate(raw+[raw[0]],raw)['strokes'][-1]['status']=='extra'
    assert not evaluate([[(x+100,y+100) for x,y in raw[0]],*raw[1:]],raw)['passed']
    rng=random.Random(41)
    noisy=[[(x+rng.uniform(-.3,.3),y+rng.uniform(-.3,.3)) for x,y in s] for s in raw]
    assert evaluate(noisy,raw)['passed']
    assert evaluate(raw[:1],raw,False)['provisional']
    assert not any(r['status']=='missing' for r in evaluate(raw[:1],raw,False)['strokes'])


@pytest.mark.parametrize('target,other',[('未','末'),('土','士'),('大','犬'),('大','太'),('日','目'),('人','入')])
def test_manual_pairs_and_distinguishing_stroke_feedback(target,other):
    candidates=confusion_candidates(target)
    pair=next(p for p in candidates if p['kanji']==other)
    assert pair['origin']=='manual' and pair['review_status']=='needs_review'
    assert pair['distinguishing_strokes']
    correct=evaluate_character(target,templates()[target]['raw'])
    assert correct['passed'] and correct['confusion'] is None
    result=evaluate_character(target,comparison_templates()[other]['raw'])
    geometry=evaluate(comparison_templates()[other]['raw'],templates()[target]['raw'])
    assert result['scores']==geometry['scores'] and result['overall_score']==geometry['overall_score']
    assert result['confusion'] and result['confusion']['kanji']==other


def test_api_preview_final_idempotency_mastery_and_recognizer_is_advisory(context,monkeypatch):
    client,db,users,current=context
    template=client.get('/api/kanji-writing/template/土').json()
    assert template['license']=='CC BY-SA 3.0' and template['rules']
    from app.api import kanji_writing
    monkeypatch.setattr(kanji_writing,'recognizer_advice',lambda strokes:{'status':'ok','kanji':'日'})
    body=payload();body['include_recognizer_warning']=True
    preview=client.post('/api/kanji-writing/evaluate',json=body)
    assert preview.status_code==200 and preview.json()['provisional']
    assert db.query(KanjiWritingAttempt).count()==0
    body['final']=True
    a=client.post('/api/kanji-writing/evaluate',json=body)
    assert a.status_code==200 and a.json()['passed'] and a.json()['saved']
    assert a.json()['recognizer_warning']=='日' and a.json()['overall_score']==100
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==200
    assert db.query(KanjiWritingAttempt).count()==1
    snapshot=LearningSnapshot(db,users[0])
    assert any(e.source=='kanji_writing' and e.item_id=='土' and e.score==1 for e in snapshot.events)
    assert sum(a.source=='kanji_writing' and a.completed for a in snapshot.activities)==1
    body['mode']='test'
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==409
    current[0]=users[1]
    assert not any(e.source=='kanji_writing' for e in LearningSnapshot(db,users[1]).events)
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==200
    assert db.query(KanjiWritingAttempt).count()==2
    current[0]=users[0]
    exported=client.get('/api/auth/me/export')
    assert exported.status_code==200 and len(exported.json()['kanji_writing_attempts'])==1
    assert client.post('/api/auth/me/reset-progress').status_code==200
    assert db.query(KanjiWritingAttempt).filter_by(user_id=users[0].id).count()==0
    current[0]=users[1]
    assert client.delete('/api/auth/me').status_code==204
    assert db.query(KanjiWritingAttempt).count()==0


def test_api_rejects_unknown_invalid_coordinates_and_limits(context):
    client,db,users,current=context
    assert client.get('/api/kanji-writing/template/x').status_code==404
    assert client.get('/api/kanji-writing/supported?level=N2').status_code==422
    assert client.post('/api/kanji-writing/evaluate',json={'kanji':'土','strokes':[[{'x':0,'y':0}]]}).status_code==422
    body=payload(final=True);body.pop('attempt_id')
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==422
    body=payload();body['strokes'][0][0]['x']=10001
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==422
    assert db.query(KanjiWritingAttempt).count()==0
    client.app.dependency_overrides.pop(get_current_active_user)
    assert client.post('/api/kanji-writing/evaluate',json=payload()).status_code in (401,403)


def test_migration_repeat_and_downgrade_guard():
    spec=importlib.util.spec_from_file_location('writing_migration',Path(__file__).parents[1]/'alembic/versions/0019_kanji_writing.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    assert migration.down_revision=='0018'
    engine=sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        migration.op=Operations(MigrationContext.configure(conn))
        migration.upgrade();migration.upgrade();migration.downgrade();migration.downgrade();migration.upgrade()
        conn.execute(sa.text("INSERT INTO kanji_writing_attempts (user_id,attempt_key,kanji,jlpt_level,mode,result) VALUES (1,'x','x','N5','test','{}')"))
        with pytest.raises(RuntimeError,match='No data was removed'):migration.downgrade()
    engine.dispose()


def test_shape_deviation_does_not_invent_order_or_direction_errors():
    raw=templates()['月']['raw']
    shifted=[[(x+(20 if i%2 else -20),y) for x,y in stroke] for i,stroke in enumerate(raw)]
    result=evaluate(shifted,raw)
    assert any(r['status']=='wrong_shape' for r in result['strokes'])
    assert result['scores']['order']==100 and result['scores']['direction']==100
    assert not result['passed']
    # Same class of failure as the screenshot: the old shape-dependent formula
    # gave this synthetic four-stroke 月 order=0, direction=0, overall=34.
    near=[[(x+(12 if i%2 else -12),y) for x,y in stroke] for i,stroke in enumerate(raw)]
    result=evaluate(near,raw)
    assert result['scores']['order']==100 and result['scores']['direction']==100
    from scripts.reproduce_kanji_writing_issue import reproduction
    captured=reproduction()
    assert captured['before']['overall_score']==34
    assert captured['before']['scores']['order']==captured['before']['scores']['direction']==0
    assert captured['after']['scores']['order']==captured['after']['scores']['direction']==100
    strict=evaluate(near,raw,strictness='strict')
    assert strict['scores']['order']==strict['scores']['direction']==100
    assert strict['scores']['shape']<result['scores']['shape'] and not strict['passed']
    reference=[[(0,0),(100,0)],[(0,80),(100,80)]]
    assert all(r['status']=='wrong_order' for r in evaluate(reference[::-1],reference)['strokes'])
    identical=[reference[0],reference[0]]
    assert evaluate(identical,identical)['scores']['order']==100


def test_calibration_acceptance_error_detection_and_profiles():
    spec=importlib.util.spec_from_file_location('calibration',Path(__file__).parents[1]/'scripts/calibrate_kanji_writing.py')
    calibration=importlib.util.module_from_spec(spec);spec.loader.exec_module(calibration)
    report=calibration.measure()
    assert report['character_count']>=30
    assert report['false_confusion_warnings_on_correct']==0
    for kind in ('correct','wrong_order','wrong_direction','missing','extra','wrong_shape'):
        assert report['groups'][kind]['rate']>.90,report
    from app.core import kanji_writing_config as policy
    raw=templates()['月']['raw']
    for profile in policy.PROFILES:
        result=evaluate(raw,raw,strictness=profile)
        assert result['passed'] and result['overall_score']==100
        assert result['strictness']==profile and result['thresholds']==policy.PROFILES[profile]
    assert policy.PROFILES['easy']['distance']>policy.PROFILES['standard']['distance']>policy.PROFILES['strict']['distance']


def test_ambiguous_confusion_is_suppressed_and_hint_never_changes_score(monkeypatch):
    from app.services import kanji_writing_templates as service
    target,other='未','末'
    raw=comparison_templates()[other]['raw']
    result=evaluate_character(target,raw)
    baseline=evaluate(raw,templates()[target]['raw'])
    assert result['scores']==baseline['scores'] and result['passed']==baseline['passed']
    pair=next(p for p in confusion_candidates(target) if p['kanji']==other)
    monkeypatch.setattr(service,'confusion_candidates',lambda key:[pair,pair])
    assert service.confusion_hint(target,raw,baseline) is None


def test_profiles_persist_and_cannot_reuse_attempt_id_with_different_thresholds(context):
    client,db,users,current=context
    body=payload(final=True);body['strictness']='strict';body['mode']='test'
    result=client.post('/api/kanji-writing/evaluate',json=body)
    assert result.status_code==200 and result.json()['strictness']=='strict'
    row=db.query(KanjiWritingAttempt).one()
    from app.core.kanji_writing_config import VERSION
    assert row.result['version']==VERSION and row.result['scores']==result.json()['scores']
    body['strictness']='easy'
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==409
    body['strictness']='unknown'
    assert client.post('/api/kanji-writing/evaluate',json=body).status_code==422


def test_consented_reports_are_owned_exact_retry_safe_exportable_and_deleted(context):
    from app.models.database import KanjiWritingReport
    client,db,users,current=context
    attempt=payload(final=True);attempt['strictness']='easy'
    saved=client.post('/api/kanji-writing/evaluate',json=attempt).json()
    body={'attempt_id':attempt['attempt_id'],'report_id':str(uuid.uuid4()),'strokes':attempt['strokes'],'comment':'Too strict'}
    assert client.post('/api/kanji-writing/reports',json=body).status_code==422
    assert db.query(KanjiWritingReport).count()==0
    body['confirmed']=True
    current[0]=users[1]
    assert client.post('/api/kanji-writing/reports',json=body).status_code==404
    current[0]=users[0]
    bad={**body,'strokes':body['strokes'][:-1]}
    assert client.post('/api/kanji-writing/reports',json=bad).status_code==409
    a=client.post('/api/kanji-writing/reports',json=body)
    assert a.status_code==200 and a.json()['saved']
    assert client.post('/api/kanji-writing/reports',json=body).json()==a.json()
    assert db.query(KanjiWritingReport).count()==1
    changed={**body,'comment':'Changed'}
    assert client.post('/api/kanji-writing/reports',json=changed).status_code==409
    row=db.query(KanjiWritingReport).one()
    assert row.result['scores']==saved['scores'] and row.result['strictness']=='easy'
    assert client.get('/api/kanji-writing/reports?limit=101').status_code==422
    assert len(client.get('/api/kanji-writing/reports?limit=1').json()['items'])==1
    from scripts.review_kanji_writing_reports import export_reports
    assert export_reports(db,users[1].id)['items']==[]
    assert len(export_reports(db,users[0].id)['items'])==1
    assert len(client.get('/api/auth/me/export').json()['kanji_writing_reports'])==1
    current[0]=users[1]
    assert client.get('/api/kanji-writing/reports').json()['items']==[]
    current[0]=users[0]
    assert client.post('/api/auth/me/reset-progress').status_code==200
    assert db.query(KanjiWritingReport).count()==0
    attempt['attempt_id']=str(uuid.uuid4());client.post('/api/kanji-writing/evaluate',json=attempt)
    body.update(attempt_id=attempt['attempt_id'],report_id=str(uuid.uuid4()))
    assert client.post('/api/kanji-writing/reports',json=body).status_code==200
    assert client.delete('/api/auth/me').status_code==204
    assert db.query(KanjiWritingReport).count()==0


def test_report_migration_repeated_upgrade_and_safe_downgrade():
    spec=importlib.util.spec_from_file_location('writing_reports_migration',Path(__file__).parents[1]/'alembic/versions/0023_kanji_writing_reports.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    assert migration.down_revision=='0022'
    engine=sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        migration.op=Operations(MigrationContext.configure(conn))
        migration.upgrade();migration.upgrade();migration.downgrade();migration.downgrade();migration.upgrade()
        conn.execute(sa.text("INSERT INTO kanji_writing_reports (user_id,report_key,attempt_key,kanji,strokes,result) VALUES (1,'r','a','x','[]','{}')"))
        with pytest.raises(RuntimeError,match='No data was removed'):
            migration.downgrade()
    engine.dispose()


def test_writing_progress_is_owned_compact_and_uses_only_saved_attempts(context):
    client,db,users,current=context
    assert client.get('/api/kanji-writing/progress').json()['items']==[]
    client.post('/api/kanji-writing/evaluate',json=payload())
    assert client.get('/api/kanji-writing/progress').json()['items']==[]
    for _ in range(2):
        body=payload(final=True)
        assert client.post('/api/kanji-writing/evaluate',json=body).status_code==200
        client.post('/api/kanji-writing/evaluate',json=body)
    result=client.get('/api/kanji-writing/progress')
    assert result.status_code==200
    row=result.json()['items'][0]
    assert row['kanji']=='土' and row['attempts']==2 and row['passed_count']==2
    assert row['last_passed'] and row['last_score']==100
    assert 'strokes' not in row and 'result' not in row
    bad=payload(final=True);bad['strokes'][0].reverse()
    client.post('/api/kanji-writing/evaluate',json=bad)
    row=client.get('/api/kanji-writing/progress').json()['items'][0]
    assert row['attempts']==3 and row['passed_count']==2 and not row['last_passed']
    current[0]=users[1]
    assert client.get('/api/kanji-writing/progress').json()['items']==[]
    current[0]=users[0]
    client.post('/api/auth/me/reset-progress')
    assert client.get('/api/kanji-writing/progress').json()['items']==[]
