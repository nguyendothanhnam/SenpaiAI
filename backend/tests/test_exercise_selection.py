import importlib.util
import json
import random
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

from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import (ExerciseDelivery, ExerciseHistory, GrammarQuestion, GrammarRule, User, DailyTask, DailyTaskItem, PointTransaction)
from app.services.exercise_content import content_fingerprint, normalize_content, similar_content
from app.services.exercise_selection import (Candidate, Selection, choose_candidates, clear_history, record_answer, record_served, select_for_user)

NOW = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)


@pytest.fixture
def context():
    engine = sa.create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    names = ('users', 'documents', 'grammar_rules', 'grammar_questions', 'learning_sessions', 'grammar_practice_attempts',
        'exercise_history', 'exercise_deliveries', 'daily_tasks', 'daily_task_items', 'study_item_stats',
        'user_game_profiles', 'point_transactions', 'user_unlocked_items', 'vocabulary',
        'chat_folders', 'chat_conversations', 'chat_history', 'voice_conversations', 'listening_lessons', 'listening_attempts',
        'reminder_settings', 'notifications', 'push_subscriptions',
        'placement_attempts', 'placement_stimuli', 'placement_questions', 'placement_attempt_items',
        'weekly_learning_goals', 'internship_profiles', 'internship_sessions', 'kanji_writing_attempts', 'kanji_writing_reports', 'chat_answer_feedback', 'user_kanji_notes', 'minigame_learning_events')
    Base.metadata.create_all(engine, tables=[Base.metadata.tables[name] for name in names])
    db = sessionmaker(bind=engine, autoflush=False)()
    user = User(email='selection@example.test', username='selection', hashed_password='test', current_jlpt_level='N5')
    other = User(email='selection2@example.test', username='selection2', hashed_password='test', current_jlpt_level='N5')
    db.add_all([user, other]); db.commit()
    from app.api.daily import router as daily_router
    from app.api.grammar_practice import router as grammar_router
    from app.api.auth import router as auth_router
    app = FastAPI()
    for router in (daily_router, grammar_router, auth_router):
        app.include_router(router, prefix='/api')
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as client:
        yield db, user, other, client, app
    db.close(); engine.dispose()


def candidates(count=90, level='N5', skill='grammar'):
    return [Candidate(skill, str(i), level, skill, ['fill_blank', 'reorder', 'true_false'][i % 3],
        f'Practice sentence number {i} with unique context', pattern=f'pattern:{i % 4}') for i in range(count)]


def add_questions(db, count=20, level='N5', source='seed', owner=None):
    rule = GrammarRule(rule_name=f'pattern-{level}', japanese_pattern='は', jlpt_level=level, meaning='test')
    db.add(rule); db.flush()
    rows = [GrammarQuestion(grammar_rule_id=rule.id, jlpt_level=level, question_type='fill_blank',
        prompt=f'練習 {level} {index} 私は ____ 学生です。', payload={'options': ['は', 'が', 'を', 'に']},
        correct_answer='は', explanation_vi='test', source=source, created_by_user_id=owner, is_active=True) for index in range(count)]
    db.add_all(rows); db.commit()
    return rows


def start(client, level='N5', **overrides):
    body = {'jlpt_level': level, 'question_types': ['fill_blank'], 'count': 5, 'mode': 'bank', **overrides}
    response = client.post('/api/grammar-practice/sessions', json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_normalization_and_near_duplicates_are_conservative():
    assert normalize_content(' ＡＢＣ\u200b  私は、学生です。 ') == 'abc私は学生です'
    assert content_fingerprint('私は 学生です。') == content_fingerprint('私は学生です！')
    assert similar_content('Every morning I study Japanese at the university.', 'Every morning I study Japanese at the universitx.')
    assert not similar_content('猫', '犬')
    assert not similar_content('Question 123 studying Japanese', 'Question 124 studying Japanese')


def test_30_days_no_repeat_within_seven_days_then_scheduled_review(context):
    db, user, _, _, _ = context
    pool, last, all_seen = candidates(), {}, set()
    for day in range(30):
        now = NOW + timedelta(days=day)
        selection = select_for_user(db, user.id, 'N5', 'grammar', 10, 'daily', candidates=pool, now=now, rng=random.Random(day))
        assert len(selection.items) == 10 and not selection.cooldown_relaxed
        for item in selection.items:
            if day < 9:
                assert item.key not in all_seen
            assert day - last.get(item.key, -100) >= 7
            last[item.key] = day; all_seen.add(item.key)
        record_served(db, user.id, selection, 'daily', f'day:{day}', now=now)
        db.commit()
    assert len(all_seen) == 90
    assert sum(row.served_count for row in db.query(ExerciseHistory)) == 300
    assert db.query(ExerciseDelivery).count() == 300


def test_two_users_independent_and_unanswered_deliveries_cross_context(context):
    db, user, other, _, _ = context
    pool = candidates(20)
    first = select_for_user(db, user.id, 'N5', 'grammar', 5, 'daily', candidates=pool, now=NOW, rng=random.Random(2))
    record_served(db, user.id, first, 'daily', '1', now=NOW)
    second = select_for_user(db, user.id, 'N5', 'grammar', 5, 'grammar', candidates=pool, now=NOW, rng=random.Random(2))
    independent = select_for_user(db, other.id, 'N5', 'grammar', 5, 'grammar', candidates=pool, now=NOW, rng=random.Random(2))
    assert {item.key for item in first.items}.isdisjoint(item.key for item in second.items)
    assert [item.key for item in first.items] == [item.key for item in independent.items]


def test_exhaustion_relaxes_cooldown_but_never_within_session_duplicates(context):
    db, user, _, _, _ = context
    pool = candidates(5)
    first = select_for_user(db, user.id, 'N5', 'grammar', 5, 'quiz', candidates=pool, now=NOW)
    record_served(db, user.id, first, 'quiz', '1', now=NOW)
    selection = select_for_user(db, user.id, 'N5', 'grammar', 10, 'daily', candidates=pool + pool, now=NOW + timedelta(days=1))
    assert len(selection.items) == 5
    assert selection.cooldown_relaxed
    assert all(selection.metadata(item)['review_mode'] for item in selection.items)
    assert len({item.key for item in selection.items}) == 5
    assert choose_candidates([], [], 'N5', 10).items == []


def test_content_duplicates_with_new_ids_cannot_escape_history(context):
    db, user, _, _, _ = context
    original = Candidate('grammar', '1', 'N5', 'grammar', 'fill_blank', 'Every morning I study Japanese at the university.')
    clone = Candidate('quiz', '2', 'N5', 'grammar', 'fill_blank', 'Every morning I study Japanese at the universitx.')
    first = Selection([original], 'N5')
    record_served(db, user.id, first, 'daily', '1', now=NOW)
    selection = select_for_user(db, user.id, 'N5', 'grammar', 5, 'grammar', candidates=[original, clone], now=NOW)
    assert len(selection.items) == 1 and selection.cooldown_relaxed


def test_fallback_is_easier_then_harder_and_recent_exact_level_waits(context):
    db, user, _, _, _ = context
    own = candidates(1, 'N3')
    record_served(db, user.id, Selection(own, 'N3'), 'daily', '1', now=NOW)
    pool = own + [Candidate('grammar', level, level, 'grammar', 'fill_blank', f'Content at {level}') for level in ('N1', 'N5', 'N2', 'N4')]
    result = select_for_user(db, user.id, 'N3', 'grammar', 5, 'grammar', candidates=pool, now=NOW)
    assert [item.level for item in result.items] == ['N4', 'N5', 'N2', 'N1', 'N3']
    assert result.metadata(result.items[0])['actual_level'] == 'N4'
    assert result.metadata(result.items[0])['fallback']


def test_balances_skill_types_and_avoids_consecutive_patterns():
    pool = [Candidate('bank', f'{skill}:{i}', 'N5', skill, f'type:{i % 2}', f'{skill} distinct number {i}', pattern=f'{skill}:{i % 3}')
            for skill in ('grammar', 'vocab', 'kanji') for i in range(12)]
    result = choose_candidates(pool, [], 'N5', 12, rng=random.Random(1))
    counts = {skill: sum(item.skill == skill for item in result.items) for skill in ('grammar', 'vocab', 'kanji')}
    assert max(counts.values()) - min(counts.values()) <= 1
    assert all(left.pattern != right.pattern for left, right in zip(result.items, result.items[1:]))
    assert len({item.question_type for item in result.items}) == 2


def test_serving_and_answers_idempotent_intervals_grow_wrong_resets(context):
    db, user, _, _, _ = context
    selection = Selection(candidates(1), 'N5')
    for turn, interval in enumerate((1, 3, 7)):
        now = NOW + timedelta(days=turn * 10)
        record_served(db, user.id, selection, 'grammar', str(turn), now=now)
        record_served(db, user.id, selection, 'grammar', str(turn), now=now)
        assert record_answer(db, user.id, 'grammar', '0', 'grammar', str(turn), True, now=now)
        assert not record_answer(db, user.id, 'grammar', '0', 'grammar', str(turn), False, now=now)
        row = db.query(ExerciseHistory).one()
        assert row.served_count == turn + 1 and row.correct_streak == turn + 1
        assert row.due_at.replace(tzinfo=timezone.utc) == now + timedelta(days=interval)
    record_served(db, user.id, selection, 'grammar', 'wrong', now=NOW + timedelta(days=40))
    record_answer(db, user.id, 'grammar', '0', 'grammar', 'wrong', False, now=NOW + timedelta(days=40))
    assert row.correct_streak == 0 and row.last_result is False


def test_due_and_wrong_prioritized_after_unseen_and_old_answer_does_not_overwrite(context):
    db, user, _, _, _ = context
    pool = candidates(3)
    record_served(db, user.id, Selection(pool[:2], 'N5'), 'quiz', 'old', now=NOW)
    record_answer(db, user.id, 'grammar', '0', 'quiz', 'old', False, now=NOW)
    result = select_for_user(db, user.id, 'N5', 'grammar', 2, 'daily', candidates=pool, now=NOW + timedelta(days=8))
    assert [item.source_id for item in result.items] == ['2', '0']
    # Equal clock timestamps still have a stable order through delivery IDs.
    record_served(db, user.id, Selection([pool[1]], 'N5'), 'grammar', 'new', now=NOW)
    record_answer(db, user.id, 'grammar', '1', 'grammar', 'new', True, now=NOW + timedelta(days=9))
    record_answer(db, user.id, 'grammar', '1', 'quiz', 'old', False, now=NOW + timedelta(days=10))
    assert db.query(ExerciseHistory).filter_by(source_id='1').one().last_result is True


def test_correct_question_not_due_waits_for_unseen_fallback(context):
    db, user, _, _, _ = context
    own = candidates(1)
    record_served(db, user.id, Selection(own, 'N5'), 'daily', '1', now=NOW)
    record_answer(db, user.id, 'grammar', '0', 'daily', '1', True, now=NOW)
    db.query(ExerciseHistory).one().due_at = NOW + timedelta(days=30)
    db.flush()
    fallback = Candidate('grammar', 'higher', 'N4', 'grammar', 'fill_blank', 'A different question to study')
    result = select_for_user(db, user.id, 'N5', 'grammar', 1, 'grammar', candidates=own + [fallback], now=NOW + timedelta(days=8))
    assert result.items[0].key == fallback.key


def test_grammar_api_uses_ledger_without_answers_and_accepts_real_fallback_level(context):
    db, user, _, client, _ = context
    add_questions(db, 12, 'N4')
    first = start(client)
    assert all(question['jlpt_level'] == 'N4' and question['selection']['fallback'] for question in first['questions'])
    assert all('correct_answer' not in question for question in first['questions'])
    second = start(client)
    assert {q['id'] for q in first['questions']}.isdisjoint(q['id'] for q in second['questions'])
    answer = client.post(f'/api/grammar-practice/sessions/{first["session_id"]}/answer', json={'question_id': first['questions'][0]['id'], 'answer': 'は'})
    assert answer.status_code == 200 and answer.json()['is_correct']
    assert client.post(f'/api/grammar-practice/sessions/{first["session_id"]}/answer', json={'question_id': first['questions'][0]['id'], 'answer': 'は'}).status_code == 409
    assert db.query(ExerciseDelivery).count() == 10
    assert db.query(ExerciseHistory).filter_by(source_id=str(first['questions'][0]['id']), user_id=user.id).one().last_result is True


@pytest.mark.parametrize('mode', ['ai', 'mixed'])
def test_ai_and_mixed_reject_duplicate_generation_and_record_only_served(mode, context, monkeypatch):
    db, user, _, client, _ = context
    rows = add_questions(db, 5, source='ai', owner=user.id)
    from app.services import grammar_practice_service as service
    async def generate(*args):
        return json.dumps({'questions': [{'prompt': '  ' + rows[0].prompt + ' ', 'payload': rows[0].payload,
            'correct_answer': 'は', 'explanation_vi': 'test'}]})
    monkeypatch.setattr(service, 'generate_raw_questions', generate)
    # AI creation endpoint itself does not serve a question.
    generated = client.post('/api/grammar-practice/generate', json={'jlpt_level': 'N5', 'grammar_rule_id': rows[0].grammar_rule_id, 'question_type': 'fill_blank', 'count': 1})
    assert generated.status_code == 200 and generated.json()['saved'] == 0
    assert db.query(ExerciseHistory).count() == 0
    result = start(client, mode=mode)
    assert len(result['questions']) == 5
    assert db.query(GrammarQuestion).count() == 5
    assert db.query(ExerciseDelivery).count() == 5


def test_daily_and_grammar_share_sources_reload_does_not_increment(context, monkeypatch):
    db, user, _, client, _ = context
    rows = add_questions(db, 20)
    import app.services.daily_task_service as daily
    for name in ('_kanji_candidates', '_vocab_candidates', '_flashcard_candidates'):
        monkeypatch.setattr(daily, name, lambda *_: [])
    task = client.get('/api/daily/today')
    assert task.status_code == 200, task.text
    assert len(task.json()['items']) == 10
    again = client.get('/api/daily/today')
    assert again.json() == task.json()
    assert db.query(ExerciseDelivery).count() == 10
    practiced = start(client)
    daily_ids = {row.source_id for row in db.query(DailyTaskItem)}
    assert daily_ids.isdisjoint(str(question['id']) for question in practiced['questions'])
    item = task.json()['items'][0]
    response = client.post(f'/api/daily/items/{item["id"]}/answer', json={'answer': 'は'})
    assert response.status_code == 200 and response.json()['is_correct']
    assert db.query(ExerciseDelivery).filter_by(context='daily', source_id=str(db.get(DailyTaskItem, item['id']).source_id)).one().result is True


def test_daily_minimum_is_not_bypassed_with_duplicate_content(context, monkeypatch):
    db, _, _, client, _ = context
    add_questions(db, 8)
    for index, question in enumerate(db.query(GrammarQuestion).order_by(GrammarQuestion.id)):
        question.prompt = '私は ____ 学生です。' + ' ' * index
    db.commit()
    import app.services.daily_task_service as daily
    for name in ('_kanji_candidates', '_vocab_candidates', '_flashcard_candidates'):
        monkeypatch.setattr(daily, name, lambda *_: [])
    response = client.get('/api/daily/today')
    assert response.status_code == 409
    assert response.json()['detail']['code'] == 'not_enough_content'
    assert db.query(ExerciseHistory).count() == 0


def test_reset_then_reload_old_daily_task_records_once_without_new_task(context, monkeypatch):
    db, user, _, client, _ = context
    add_questions(db, 12)
    import app.services.daily_task_service as daily
    for name in ('_kanji_candidates', '_vocab_candidates', '_flashcard_candidates'):
        monkeypatch.setattr(daily, name, lambda *_: [])
    task = client.get('/api/daily/today').json()
    assert db.query(ExerciseDelivery).count() == 10
    assert client.post('/api/auth/me/reset-progress').status_code == 200
    assert db.query(ExerciseDelivery).count() == 0
    again = client.get('/api/daily/today')
    assert again.status_code == 200 and again.json()['task_id'] == task['task_id']
    assert db.query(ExerciseDelivery).count() == 10
    client.get('/api/daily/today')
    assert db.query(ExerciseDelivery).count() == 10
    assert db.query(DailyTask).count() == 1 and db.query(PointTransaction).count() == 0


def test_account_export_reset_and_delete_do_not_reset_rewards(context):
    db, user, other, client, _ = context
    add_questions(db, 10)
    created = start(client)
    task = DailyTask(user_id=user.id, task_date=NOW.date(), status='completed', total_items=0, points_awarded=25)
    db.add(task); db.flush()
    transaction = PointTransaction(user_id=user.id, amount=25, reason='daily', ref_type='daily', ref_id=str(task.id), idempotency_key=f'daily:{task.id}', balance_after=25)
    db.add(transaction); db.commit()
    exported = client.get('/api/auth/me/export')
    assert exported.status_code == 200, exported.text
    assert len(exported.json()['exercise_history']['items']) == 5
    assert len(exported.json()['exercise_history']['deliveries']) == 5
    assert client.post('/api/auth/me/reset-progress').status_code == 200
    assert db.query(ExerciseHistory).count() == 0 and db.query(ExerciseDelivery).count() == 0
    assert db.query(DailyTask).count() == 1 and db.query(PointTransaction).count() == 1
    start(client)
    assert client.delete('/api/auth/me').status_code == 204
    assert db.query(ExerciseHistory).count() == 0 and db.query(ExerciseDelivery).count() == 0
    assert db.get(User, other.id) is not None


def test_selection_has_constant_select_count_and_indexed_user_lookup(context):
    db, user, _, _, _ = context
    add_questions(db, 200)
    statements = []
    def capture(conn, cursor, statement, parameters, ctx, many):
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)
    sa.event.listen(db.get_bind(), 'before_cursor_execute', capture)
    try:
        result = select_for_user(db, user.id, 'N5', 'grammar', 10, 'quiz', {'question_types': ['fill_blank']})
    finally:
        sa.event.remove(db.get_bind(), 'before_cursor_execute', capture)
    assert len(result.items) == 10 and len(statements) <= 4
    plan = db.execute(sa.text("EXPLAIN QUERY PLAN SELECT * FROM exercise_history WHERE user_id=1 AND fingerprint='x'")).all()
    assert any('ix_exercise_history_user_fingerprint' in str(row) for row in plan)


def test_migration_idempotent_and_refuses_data_loss():
    spec = importlib.util.spec_from_file_location('exercise_migration', Path(__file__).parents[1] / 'alembic/versions/0016_exercise_selection.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite://')
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        conn.execute(sa.text('INSERT INTO users VALUES (1)'))
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade(); migration.upgrade()
        migration.downgrade(); migration.downgrade(); migration.upgrade()
        conn.execute(sa.text("INSERT INTO exercise_history (user_id,source_type,source_id,fingerprint,normalized_content,jlpt_level,skill,last_served_at,last_context) VALUES (1,'grammar','1','abc','test','N5','grammar',CURRENT_TIMESTAMP,'daily')"))
        with pytest.raises(RuntimeError, match='No data was removed'):
            migration.downgrade()
        assert conn.execute(sa.text('SELECT COUNT(*) FROM exercise_history')).scalar() == 1
    engine.dispose()


def test_report_counts_unique_vocab_once_and_flags_missing_skills():
    from scripts.report_exercise_bank import summarize_pool
    def record(content, kind):
        return {'selection_content': content, 'question_type': kind, 'payload': {}}
    report = summarize_pool({'vocab': [record('猫 ねこ', 'vocab_meaning')],
        'flashcard': [record('猫　ねこ！', 'self_recall')], 'grammar': [], 'kanji': []}, items_per_day=10)
    assert report['usable_unique_by_skill']['vocab'] == 1
    assert report['unique_total_without_double_counting_flashcards'] == 1
    assert report['days_with_full_default_distribution'] == 0
    assert report['additional_unique_items_for_target'] == 299


def test_seed_rejects_duplicate_content_and_is_repeat_safe(context):
    db, _, _, _, _ = context
    from scripts.seed_grammar_practice import seed
    first = seed(db)
    assert first['questions_added'] > 0
    assert seed(db)['questions_added'] == 0
    from app.services.exercise_content import grammar_content
    content = [grammar_content(question) for question in db.query(GrammarQuestion).all()]
    assert len({content_fingerprint(text) for text in content}) == len(content)
