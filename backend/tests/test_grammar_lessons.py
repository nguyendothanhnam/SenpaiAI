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
from app.api.grammar_lessons import router
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import User, Document, GrammarRule, GrammarQuestion, GrammarLesson, GrammarLessonProgress
from app.services.grammar_lessons import import_lessons


@pytest.fixture
def ctx():
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def setup(conn, record):
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine, tables=[User.__table__, Document.__table__, GrammarRule.__table__, GrammarQuestion.__table__, GrammarLesson.__table__, GrammarLessonProgress.__table__])
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    users = [User(email=f'g{i}@test.local', username=f'grammar{i}', hashed_password='x') for i in range(2)]
    rule = GrammarRule(rule_name='は', japanese_pattern='A は B', meaning='topic', jlpt_level='N5')
    db.add_all([*users, rule]); db.commit()
    current = [0]; app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: users[current[0]]
    with TestClient(app) as client: yield client, db, rule, current
    db.close(); engine.dispose()


def sample(rule):
    return {'source_key':'n5-topic', 'grammar_rule_id':rule.id, 'jlpt_level':'N5', 'sort_order':1,
            'formation':'A は B', 'meaning':'Chủ đề', 'usage_notes':'',
            'examples':[{'ja':'日本', 'vi':'Nhật Bản', 'tokens':[{'text':'日','reading':'に'},{'text':'本','reading':'ほん'}]}],
            'common_errors':[], 'comparisons':[]}


def test_import_is_repeatable_and_validates_before_writing(ctx):
    _, db, rule, _ = ctx
    data = sample(rule)
    assert import_lessons(db, [data])['created'] == 1
    assert import_lessons(db, [data])['unchanged'] == 1
    assert db.query(GrammarLesson).count() == 1
    with pytest.raises(ValueError): import_lessons(db, [data, {**data, 'source_key':'different'}])
    with pytest.raises(ValueError): import_lessons(db, [{**data, 'jlpt_level':'N4'}])
    with pytest.raises(ValueError): import_lessons(db, [{**data, 'examples':[{'ja':'日本','vi':'Japan','tokens':[{'text':'本','reading':'ほん'}]}]}])
    assert db.query(GrammarLesson).count() == 1
    assert import_lessons(db, [{**data, 'meaning':'updated'}])['updated'] == 1


def test_api_isolates_progress_and_does_not_leak_answers(ctx):
    client, db, rule, current = ctx
    import_lessons(db, [sample(rule)])
    db.add(GrammarQuestion(grammar_rule_id=rule.id,jlpt_level='N5',question_type='fill_blank',prompt='私 ____ 学生',payload={'options':['は','が']},correct_answer='は',explanation_vi='secret',source='seed',is_active=True))
    db.add(GrammarQuestion(grammar_rule_id=rule.id,jlpt_level='N5',question_type='true_false',prompt='私 ____ 学生',payload={'statement':'same'},correct_answer=True,explanation_vi='secret',source='seed',is_active=True))
    db.commit()
    result = client.get('/grammar-lessons',params={'level':'N5'}).json()['items']
    assert result[0]['status'] == 'not_started'
    lesson_id = result[0]['id']
    detail = client.get(f'/grammar-lessons/{lesson_id}')
    assert detail.status_code == 200 and len(detail.json()['quick_questions']) == 1
    assert 'correct_answer' not in detail.text and 'secret' not in detail.text
    assert client.get('/grammar-lessons/next?level=N5').json()['lesson']['id'] == lesson_id
    assert client.put(f'/grammar-lessons/{lesson_id}/progress',json={'status':'mastered'}).json()['status'] == 'mastered'
    assert client.put(f'/grammar-lessons/{lesson_id}/progress',json={'status':'studied'}).json()['status'] == 'mastered'
    assert client.get('/grammar-lessons/next?level=N5').json()['lesson'] is None
    current[0] = 1
    assert client.get(f'/grammar-lessons/{lesson_id}').json()['status'] == 'not_started'
    assert client.get('/grammar-lessons?level=N5&status=mastered').json()['items'] == []
    assert client.get('/grammar-lessons/999').status_code == 404
    assert client.get('/grammar-lessons?level=N6').status_code == 422


def test_migration_repeatable_and_downgrade_preserves_data():
    spec = importlib.util.spec_from_file_location('migration_0027', Path(__file__).parents[1]/'alembic/versions/0027_grammar_lessons.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.exec_driver_sql('CREATE TABLE users (id INTEGER PRIMARY KEY)')
        conn.exec_driver_sql('CREATE TABLE grammar_rules (id INTEGER PRIMARY KEY)')
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade(); module.upgrade()
            assert 'grammar_lessons' in sa.inspect(conn).get_table_names()
            conn.exec_driver_sql("INSERT INTO grammar_lessons (source_key,grammar_rule_id,jlpt_level,sort_order,formation,meaning,usage_notes,examples,common_errors,comparisons) VALUES ('a',1,'N5',0,'a','b','','[]','[]','[]')")
            with pytest.raises(RuntimeError): module.downgrade()
    engine.dispose()
