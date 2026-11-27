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
from app.api.listening import router, optional_current_user
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import User, Document, ListeningLesson, ListeningAttempt
from app.services.listening_video import parse_subtitles, video_url
from app.services.listening_exercises import build_exercises

SRT = '1\n00:00:01,000 --> 00:00:03,000\n日本語です。\n\n2\n00:00:04,000 --> 00:00:05,500\nおはよう。'
VTT = 'WEBVTT\n\n00:01.000 --> 00:03.000\n日本語です。\n\n00:04.000 --> 00:05.500\nおはよう。'


@pytest.mark.parametrize('value', ['https://www.youtube.com/watch?v=abcdefghijk', 'https://youtu.be/abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk'])
def test_official_urls(value):
    assert video_url(value)['url'] == 'https://www.youtube.com/watch?v=abcdefghijk'


@pytest.mark.parametrize('value', ['http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://youtube.com@127.0.0.1/watch?v=abcdefghijk','https://127.0.0.1/watch?v=abcdefghijk','https://youtu.be/abc','https://youtube.com:444/watch?v=abcdefghijk','https://youtube.com/watch?v=abcdefghijk&v=abcdefghijk'])
def test_reject_untrusted_urls(value):
    with pytest.raises(ValueError): video_url(value)


def test_srt_vtt_and_japanese():
    assert parse_subtitles(SRT) == parse_subtitles(VTT)
    assert parse_subtitles(SRT)[0] == {'start_ms':1000,'end_ms':3000,'ja':'日本語です。','vi':''}
    assert parse_subtitles('\ufeff'+SRT)[1]['end_ms'] == 5500


@pytest.mark.parametrize('value', ['no timestamps','1\n00:00:02,000 --> 00:00:01,000\n日本', '1\n00:00:01,000 --> 00:00:03,000\n日\n\n2\n00:00:02,000 --> 00:00:04,000\n月'])
def test_invalid_subtitles(value):
    with pytest.raises(ValueError): parse_subtitles(value)


@pytest.fixture
def ctx():
    engine=sa.create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @sa.event.listens_for(engine,'connect')
    def setup(conn, record): conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine,tables=[User.__table__,Document.__table__,ListeningLesson.__table__,ListeningAttempt.__table__])
    db=sessionmaker(bind=engine,expire_on_commit=False)()
    users=[User(email=f'video{i}@test.local',username=f'video{i}',hashed_password='x') for i in range(2)]
    db.add_all(users);db.commit(); current=[0]
    app=FastAPI();app.include_router(router)
    app.dependency_overrides[get_db]=lambda:db
    app.dependency_overrides[get_current_active_user]=lambda:users[current[0]]
    app.dependency_overrides[optional_current_user]=lambda:users[current[0]] if current[0] is not None else None
    with TestClient(app) as client: yield client,db,current
    db.close();engine.dispose()


def test_create_private_lesson_and_server_exercises(ctx, monkeypatch):
    from app.api import listening
    monkeypatch.setattr(listening, 'furigana_tokens', lambda text:[{'text':text,'reading':'にほんご'}])
    client,db,current=ctx
    parsed=client.post('/listening/video/parse',json={'url':'https://youtu.be/abcdefghijk','subtitles':SRT})
    assert parsed.status_code==200
    rows=parsed.json()['segments'];rows[0]['vi']='Tiếng Nhật'
    response=client.post('/listening/video/lessons',json={'url':'https://youtu.be/abcdefghijk','title':'Bài học','topic':'Học','jlpt_level':'N5','source_note':'permission','segments':rows})
    assert response.status_code==201, response.text
    key=response.json()['id']
    lesson=client.get(f'/listening/lessons/{key}').json()
    assert lesson['source']=='video' and lesson['segments'][0]['vi']=='Tiếng Nhật'
    assert lesson['video_id']=='abcdefghijk' and lesson['segments'][0]['tokens']
    assert client.get(f'/listening/lessons/{key}/audio').status_code==404
    questions=client.get(f'/listening/lessons/{key}/exercises').json()
    assert {'dictation','cloze'} <= {q['mode'] for q in questions['questions']}
    assert 'answer' not in str(questions)
    _, generated = build_exercises(key, db.get(ListeningLesson, key).segments)
    answers = [{'question_id': q['id'], 'answer': q['answer']} for q in generated if q['mode'] == 'dictation']
    graded = client.post(f'/listening/lessons/{key}/attempts', json={'mode': 'dictation', 'revision': questions['revision'], 'answers': answers})
    assert graded.status_code == 201 and graded.json()['score'] == 100
    current[0]=1
    assert client.get(f'/listening/lessons/{key}').status_code==404
    assert client.get(f'/listening/lessons/{key}/exercises').status_code==404
    assert client.post(f'/listening/lessons/{key}/attempts', json={'mode': 'dictation', 'revision': questions['revision'], 'answers': answers}).status_code==404
    assert client.get('/listening/lessons').json()['total']==0
    current[0]=None
    assert client.get('/listening/lessons').json()['total']==0
    assert client.get(f'/listening/lessons/{key}').status_code==404


def test_migration_idempotent_and_safe_downgrade():
    spec=importlib.util.spec_from_file_location('migration_video',Path(__file__).parents[1]/'alembic/versions/0028_listening_video.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE listening_lessons (id INTEGER PRIMARY KEY)')
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade();module.upgrade()
            connection.exec_driver_sql("INSERT INTO listening_lessons (video_id) VALUES ('abcdefghijk')")
            with pytest.raises(RuntimeError):module.downgrade()
