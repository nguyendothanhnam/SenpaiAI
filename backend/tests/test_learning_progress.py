import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.auth import get_current_active_user
from app.core import learning_progress_config as policy
from app.models.database import (User, GrammarRule, GrammarQuestion, GrammarPracticeAttempt, LearningSession,
    DailyTask, DailyTaskItem, StudyItemStat, PlacementAttempt, ListeningLesson, ListeningAttempt,
    InternshipSession, ChatHistory, VoiceConversation, WeeklyLearningGoal)
from app.api import learning
from app.services.learning_history import LearningSnapshot, Evidence
from app.services import learning_progress as service

NOW = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)


@pytest.fixture
def context(monkeypatch):
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @sa.event.listens_for(engine, 'connect')
    def setup(conn, record):
        conn.create_function('char_length', 1, len)
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False)()
    user = User(email='progress@example.test', username='progress', hashed_password='test', current_jlpt_level='N5')
    other = User(email='progress-other@example.test', username='other', hashed_password='test', current_jlpt_level='N4')
    db.add_all([user, other]); db.commit()
    from app.services import learning_history
    monkeypatch.setattr(learning_history.kanji_dictionary_service, 'list_entries', lambda **kwargs: ([{'kanji': '日', 'jlpt': 'N5'}, {'kanji': '月', 'jlpt': 'N5'}], 2))
    state = SimpleNamespace(user=user)
    app = FastAPI(); app.include_router(learning.router, prefix='/api')
    from app.api.auth import router as auth_router
    app.include_router(auth_router, prefix='/api')
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: state.user
    app.dependency_overrides[learning.snapshot] = lambda: LearningSnapshot(db, state.user, NOW)
    with TestClient(app) as client:
        yield db, user, other, client, state
    db.close(); engine.dispose()


def grammar_history(db, user, results, dates):
    rule = GrammarRule(rule_name='は', japanese_pattern='は', meaning='topic', jlpt_level='N5', difficulty_score=2)
    db.add(rule); db.flush()
    question = GrammarQuestion(grammar_rule_id=rule.id, jlpt_level='N5', question_type='fill_blank', prompt=f'Prompt {user.id} {rule.id} ____',
        payload={'options': ['a', 'b', 'c', 'd']}, correct_answer='a', explanation_vi='test', source='seed')
    db.add(question); db.flush()
    session = LearningSession(user_id=user.id, session_type='grammar', topic='test', difficulty_level='N5',
        created_at=min(dates), completed_at=max(dates), duration_minutes=20)
    db.add(session); db.flush()
    for correct, when in zip(results, dates):
        db.add(GrammarPracticeAttempt(user_id=user.id, learning_session_id=session.id, question_id=question.id,
            grammar_rule_id=rule.id, jlpt_level='N5', question_type='fill_blank', user_answer='a', is_correct=correct,
            time_spent_ms=6000, created_at=when))
    db.commit()
    return rule, question, session


def test_recent_answers_and_harder_evidence_receive_more_weight():
    old = Evidence('grammar', 'N5', NOW - timedelta(days=90), 0)
    recent = Evidence('grammar', 'N5', NOW, 1)
    assert service.proficiency([old, recent], NOW, 'N5')['score'] > 80
    easy = Evidence('grammar', 'N5', NOW, 0)
    hard = Evidence('grammar', 'N3', NOW, 1)
    assert service.proficiency([easy, hard], NOW, 'N5')['score'] > 50
    assert service.proficiency([], NOW)['score'] is None
    assert service.proficiency([recent], NOW)['evidence'] == 'insufficient'


def test_empty_user_has_no_invented_scores_and_three_explained_actions(context):
    _, _, _, client, _ = context
    data = client.get('/api/learning/overview').json()
    assert not data['has_activity']
    assert all(value['score'] is None and value['evidence'] == 'insufficient' for value in data['skills'].values())
    assert len(data['actions']) == 3 and all(action['reason'] and action['href'].startswith('/') for action in data['actions'])
    report = client.get('/api/learning/reports').json()['items'][0]
    assert report['accuracy'] is None and report['narrative']['key'].endswith('insufficient')


def test_simulated_weeks_reports_comparison_and_goal_timezone(context):
    db, user, _, client, _ = context
    dates = [NOW - timedelta(days=value) for value in (9, 8, 2, 1)]
    grammar_history(db, user, [False, False, True, True], dates)
    data = client.get('/api/learning/reports?period=week&limit=2').json()
    current = data['items'][0]
    assert current['answered'] == 2 and current['accuracy'] == 100
    assert current['comparison']['accuracy_delta'] == 100
    assert current['comparison']['same_elapsed_days']
    assert current['narrative']['key'].endswith('improving')
    assert current['recorded_minutes'] == 0.2  # two answers, not the duplicated session's 20 minutes
    assert data['has_more']
    assert client.put('/api/learning/goals', json={'study_days': 2, 'lessons': 3}).status_code == 200
    goal = client.get('/api/learning/goals').json()
    assert goal['completed_days'] == 2 and goal['days_percent'] == 100
    assert goal['study_days'] == 2 and goal['lessons'] == 3
    assert client.put('/api/learning/goals', json={'study_days': 8, 'lessons': 0}).status_code == 422


def test_twelve_week_simulation_monthly_reports_and_local_week_boundary(context):
    db, user, _, client, _ = context
    dates, results = [], []
    for week in range(12):
        for day in (2, 1):
            dates.append(NOW - timedelta(weeks=week, days=day))
            results.append(week < 4 or day == 1)
    grammar_history(db, user, results, dates)
    reports = client.get('/api/learning/reports?limit=12').json()
    assert len(reports['items']) == 12
    assert reports['items'][0]['accuracy'] == 100
    assert reports['items'][6]['accuracy'] == 50
    months = client.get('/api/learning/reports?period=month&limit=4').json()
    assert len(months['items']) == 4 and months['items'][0]['period'] == 'month'
    assert sum(report['answered'] for report in months['items']) == 24
    from app.services.learning_history import local_date
    assert local_date(datetime(2026, 11, 15, 18, tzinfo=timezone.utc)).isoformat() == '2026-11-16'
    assert db.query(WeeklyLearningGoal).count() == 0  # projection GETs do not create goals or daily tasks
    assert db.query(DailyTask).count() == 0


def test_mastery_pagination_curriculum_and_no_automatic_promotion(context):
    db, user, _, client, _ = context
    dates = [NOW - timedelta(days=day) for day in (4, 3, 2, 1, 0)]
    rule, _, _ = grammar_history(db, user, [True] * 5, dates)
    data = client.get('/api/learning/mastery?skill=grammar&limit=1').json()
    assert data['total'] == 1 and data['items'][0]['mastered']
    assert data['items'][0]['item_id'] == str(rule.id)
    assert client.get('/api/learning/mastery?offset=1').json()['items'] == []
    roadmap = client.get('/api/learning/roadmap').json()
    n5 = roadmap['levels'][0]
    assert n5['milestones'][1]['complete']
    assert n5['milestones'][0]['target'] == 2
    assert not n5['ready_for_level_review'] and not n5['automatic_promotion']
    assert roadmap['levels'][-1]['milestones'][0]['percent'] is None
    db.refresh(user); assert user.current_jlpt_level == 'N5'


def test_owned_data_and_goals_are_isolated_and_no_user_id_override(context):
    db, user, other, client, state = context
    grammar_history(db, user, [False], [NOW])
    client.put('/api/learning/goals', json={'study_days': 6, 'lessons': 20})
    state.user = other
    data = client.get(f'/api/learning/overview?user_id={user.id}').json()
    assert data['skills']['grammar']['samples'] == 0
    assert data['weekly_goal']['study_days'] == 4
    assert client.get('/api/learning/mastery').json()['total'] == 0


def test_daily_and_stats_not_double_counted_and_proxy_not_binary_accuracy(context):
    db, user, _, client, _ = context
    task = DailyTask(user_id=user.id, task_date=NOW.date(), created_at=NOW, total_items=1, status='completed', completed_at=NOW)
    db.add(task); db.flush()
    db.add(DailyTaskItem(daily_task_id=task.id, position=1, item_type='kanji', source_id='日', question_type='kanji_reading',
        payload={'kanji': '日', 'level': 'N5'}, answer_key={}, is_correct=True, answered_at=NOW, time_spent_ms=30000))
    db.add(StudyItemStat(user_id=user.id, item_type='kanji', item_id='日', attempts=100, wrong_count=90, last_seen_at=NOW))
    db.add(ChatHistory(user_id=user.id, question='test', answer='test', jlpt_level='N5', feedback={'issues': []}, created_at=NOW))
    db.commit()
    data = client.get('/api/learning/overview').json()
    assert data['skills']['kanji']['samples'] == 1
    assert data['skills']['conversation']['accuracy'] is None
    assert data['skills']['conversation']['proxy_only']
    result = client.get('/api/learning/reports').json()['items'][0]
    assert result['answered'] == 1 and result['lessons'] == 1 and result['recorded_minutes'] == 0.5


def test_placement_demo_excluded_real_placement_and_interview_provenance(context):
    db, user, _, client, _ = context
    base = dict(user_id=user.id, status='completed', language='vi', bank=[], questions=[], answers=[], available_levels=['N5'],
        completed_at=NOW, created_at=NOW, assessment_mode='confirmation', selected_level='N5',
        skill_scores={'vocab': {'total': 6, 'correct': 6, 'score': 100}})
    db.add(PlacementAttempt(**base, result={'is_demo': True}))
    db.commit()
    assert client.get('/api/learning/overview').json()['skills']['vocab']['score'] is None
    db.add(PlacementAttempt(**base, result={'is_demo': False}, estimated_level='N5', confirmed_at=NOW))
    db.add(InternshipSession(user_id=user.id, session_type='interview', industry='it', level=5, scenario_id='test', status='completed',
        created_at=NOW - timedelta(minutes=10), completed_at=NOW, overall_score=85, grammar_score=80, keigo_score=60, manner_score=90))
    db.commit()
    data = client.get('/api/learning/overview').json()
    assert data['skills']['vocab']['samples'] == 6
    assert data['skills']['interview']['proxy_only']
    assert client.get('/api/learning/mastery?level=N1').json()['skills']['interview']['samples'] == 0


def test_old_aggregate_not_allocated_to_month_and_report_ranges_validate(context):
    db, user, _, client, _ = context
    db.add(StudyItemStat(user_id=user.id, item_type='kanji', item_id='月', attempts=20, wrong_count=15, last_seen_at=NOW))
    db.commit()
    overview = client.get('/api/learning/overview').json()
    assert overview['coverage']['contains_undated_aggregates']
    report = client.get('/api/learning/reports?period=month').json()['items'][0]
    assert report['answered'] == 0 and report['frequent_wrong_items'] == []
    assert client.get('/api/learning/reports?period=year').status_code == 422
    assert client.get('/api/learning/reports?anchor=2099-01-01').status_code == 422
    assert client.get('/api/learning/mastery?limit=101').status_code == 422
    march = service.report(LearningSnapshot(db, user, datetime(2027, 3, 30, tzinfo=timezone.utc)), 'month')
    assert not march['comparison']['same_elapsed_days']  # February cannot supply 30 elapsed days


def test_bounded_queries_report_truncation_and_exclude_future_answers(context, monkeypatch):
    db, user, _, client, _ = context
    grammar_history(db, user, [True] * 9, [NOW - timedelta(days=day) for day in range(8)] + [NOW + timedelta(days=3)])
    monkeypatch.setattr(policy, 'SOURCE_ROW_LIMIT', 3)
    statements = []
    def capture(conn, cursor, statement, parameters, ctx, many):
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)
    sa.event.listen(db.get_bind(), 'before_cursor_execute', capture)
    try:
        snapshot = LearningSnapshot(db, user, NOW)
        data = service.overview(snapshot)
    finally:
        sa.event.remove(db.get_bind(), 'before_cursor_execute', capture)
    flashcard_queries = [query for query in statements if 'FROM flashcard_sessions' in query]
    assert len(flashcard_queries) <= 1
    assert len(statements) - len(flashcard_queries) <= 18  # Keep the original source budget; one bounded new adapter.
    assert all(activity.at <= NOW for activity in snapshot.activities)
    assert data['skills']['grammar']['samples'] == 3
    assert data['coverage']['partial'] and 'grammar' in data['coverage']['truncated_sources']
    assert not service.roadmap(snapshot)['levels'][0]['ready_for_level_review']


def test_export_contains_progress_and_goal_account_cleanup(context):
    db, user, _, client, _ = context
    client.put('/api/learning/goals', json={'study_days': 5, 'lessons': 12})
    exported = client.get('/api/auth/me/export')
    assert exported.status_code == 200, exported.text
    assert 'monthly_report' in exported.json()['learning_progress']
    assert client.delete('/api/auth/me').status_code == 204
    assert db.query(WeeklyLearningGoal).filter_by(user_id=user.id).count() == 0


def test_migration_safe_repeat_and_preserves_goals():
    spec = importlib.util.spec_from_file_location('learning_migration', Path(__file__).parents[1] / 'alembic/versions/0017_learning_progress.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        conn.execute(sa.text('INSERT INTO users VALUES (1)'))
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade(); migration.upgrade(); migration.downgrade(); migration.downgrade(); migration.upgrade()
        conn.execute(sa.text('INSERT INTO weekly_learning_goals (user_id) VALUES (1)'))
        with pytest.raises(RuntimeError, match='No data was removed'):
            migration.downgrade()
    engine.dispose()
