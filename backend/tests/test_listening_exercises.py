from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api import listening
from app.core.database import Base
from app.models.database import ListeningAttempt, ListeningLesson, User
from app.services.listening_exercises import answer_matches, build_exercises, grade_questions, kana_reading, normalize_answer, public_questions


SEGMENTS = [
    {'idx': 1, 'ja': '日本語を勉強します。'},
    {'idx': 2, 'ja': '学校へ行きます。'},
    {'idx': 3, 'ja': '水を飲みます。'},
    {'idx': 4, 'ja': '本を読みます。'},
    {'idx': 5, 'ja': '明日、映画を見ます。'},
]


@pytest.mark.parametrize(('answer', 'expected', 'correct'), [
    (' 日本語 を 勉強します! ', '日本語を勉強します。', True),
    ('ｶﾀｶﾅ', 'カタカナ。', True),
    ('にほんご', '日本語', True),
    ('にほんこ', '日本語', False),
    ('箸', '橋', False),
    ('', '日本語', False),
    ('は', 'が', False),
    ('こひ', 'コーヒー', False),
])
def test_grading_accepts_formatting_and_kana_but_not_wrong_words(answer, expected, correct):
    assert answer_matches(answer, expected) is correct


def test_exercises_are_deterministic_and_do_not_expose_answers_before_submission():
    revision, questions = build_exercises(17, SEGMENTS)
    assert build_exercises(17, SEGMENTS) == (revision, questions)
    assert len(questions) == 15
    assert {question['mode'] for question in questions} == {'dictation', 'cloze', 'comprehension'}
    assert all('answer' not in question and 'transcript' not in question for question in public_questions(questions))
    for question in questions:
        original = SEGMENTS[question['segment_index']]['ja']
        if question['mode'] == 'cloze':
            assert question['prefix'] + question['answer'] + question['suffix'] == original
            assert question['answer'].strip()
        elif question['mode'] == 'comprehension':
            assert len(question['options']) == 4
            assert len({normalize_answer(option['text']) for option in question['options']}) == 4
            assert sum(option['id'] == question['answer'] for option in question['options']) == 1


def test_audio_timestamp_updates_do_not_invalidate_questions_but_transcript_changes_do():
    initial = build_exercises(17, SEGMENTS)[0]
    timed = [{**segment, 'start_ms': index * 2000, 'end_ms': index * 2000 + 1200, 'tokens': []} for index, segment in enumerate(SEGMENTS)]
    assert build_exercises(17, timed)[0] == initial
    changed = [{**segment, 'ja': segment['ja'] + 'はい。'} for segment in SEGMENTS]
    assert build_exercises(17, changed)[0] != initial


def test_duplicate_and_homophone_sentences_do_not_make_ambiguous_choices():
    _, questions = build_exercises(17, [{'ja': '日本語。'}, {'ja': 'にほんご！'}])
    assert not any(question['mode'] == 'comprehension' for question in questions)
    assert len(questions) == 4
    assert build_exercises(17, [None, {'ja': ''}, {'ja': 'English only'}])[1] == []


@pytest.mark.parametrize('mode', ['dictation', 'cloze', 'comprehension'])
def test_all_modes_are_graded_against_server_answers(mode):
    _, questions = build_exercises(17, SEGMENTS)
    selected = [question for question in questions if question['mode'] == mode]
    answers = [{'question_id': question['id'], 'answer': question['answer']} for question in selected]
    assert grade_questions(questions, mode, answers)['score'] == 100
    if mode == 'comprehension':
        answers[0]['answer'] = next(option['id'] for option in selected[0]['options'] if option['id'] != selected[0]['answer'])
    else:
        answers[0]['answer'] = '違います'
    result = grade_questions(questions, mode, answers)
    assert result['score'] == 80
    assert result['correct_count'] == 4
    assert result['results'][0]['correct'] is False
    assert result['results'][0]['transcript'] == SEGMENTS[0]['ja']


def test_missing_duplicate_or_foreign_question_ids_are_rejected():
    _, questions = build_exercises(17, SEGMENTS)
    answers = [{'question_id': question['id'], 'answer': question['answer']} for question in questions if question['mode'] == 'dictation']
    for invalid in [answers[:-1], [*answers, answers[0]], [{'question_id': 'fake', 'answer': 'anything'}]]:
        with pytest.raises(ValueError, match='listening_answers_invalid'):
            grade_questions(questions, 'dictation', invalid)


@pytest.fixture
def db():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine, tables=[User.__table__, ListeningLesson.__table__, ListeningAttempt.__table__])
    with Session(engine) as session:
        yield session
    engine.dispose()


def make_user(db):
    user = User(email=f'{uuid4()}@example.test', username=str(uuid4()), hashed_password='test')
    db.add(user)
    db.commit()
    return user


def make_lesson(db, **kwargs):
    lesson = ListeningLesson(title='Practice', jlpt_level='N5', topic='study', source='seed', is_published=True,
                             segments=[dict(segment) for segment in SEGMENTS])
    for name, value in kwargs.items():
        setattr(lesson, name, value)
    db.add(lesson)
    db.commit()
    return lesson


def test_attempt_is_persisted_and_history_is_private(db):
    user, other = make_user(db), make_user(db)
    lesson = make_lesson(db)
    public = listening.get_exercises(lesson.id, user, db)
    _, questions = build_exercises(lesson.id, lesson.segments)
    answers = [{'question_id': question['id'], 'answer': question['answer']} for question in questions if question['mode'] == 'dictation']
    body = listening.ListeningAttemptRequest(mode='dictation', revision=public['revision'], answers=answers, duration_ms=12000)
    result = listening.submit_attempt(lesson.id, body, user, db)
    assert result['score'] == 100
    saved = db.get(ListeningAttempt, result['id'])
    assert saved.user_id == user.id
    assert saved.duration_ms == 12000
    assert saved.details['total'] == 5
    assert len(listening.list_attempts(lesson.id, 10, user, db)['items']) == 1
    assert listening.list_attempts(lesson.id, 10, other, db)['items'] == []


def test_other_users_library_lessons_and_unpublished_lessons_are_not_accessible(db):
    user, other = make_user(db), make_user(db)
    private = make_lesson(db, source='library', created_by=user.id)
    unpublished = make_lesson(db, is_published=False)
    body = listening.ListeningAttemptRequest(mode='dictation', revision='old', answers=[{'question_id': 'x', 'answer': 'x'}])
    for lesson, viewer in [(private, other), (unpublished, user)]:
        for action in [lambda: listening.get_exercises(lesson.id, viewer, db),
                       lambda: listening.submit_attempt(lesson.id, body, viewer, db),
                       lambda: listening.list_attempts(lesson.id, 10, viewer, db)]:
            with pytest.raises(HTTPException) as error:
                action()
            assert error.value.status_code == 404
    assert listening.get_exercises(private.id, user, db)['questions']


def test_outdated_revision_cannot_save_a_score(db):
    user = make_user(db)
    lesson = make_lesson(db)
    old = listening.get_exercises(lesson.id, user, db)
    lesson.segments = [{'ja': '新しい文章です。'}]
    db.commit()
    body = listening.ListeningAttemptRequest(mode='dictation', revision=old['revision'], answers=[{'question_id': 'dictation-0', 'answer': 'x'}])
    with pytest.raises(HTTPException) as error:
        listening.submit_attempt(lesson.id, body, user, db)
    assert error.value.status_code == 409
    assert db.query(ListeningAttempt).count() == 0
