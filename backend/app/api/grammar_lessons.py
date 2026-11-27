from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import GrammarLesson, GrammarLessonProgress, GrammarQuestion, User
from ..services.grammar_practice_service import public_question

router = APIRouter(prefix='/grammar-lessons', tags=['grammar lessons'])
Level = Literal['N5', 'N4', 'N3', 'N2', 'N1']


def lesson_data(row, progress):
    return {'id': row.id, 'grammar_rule_id': row.grammar_rule_id, 'pattern': row.grammar_rule.japanese_pattern,
            'title': row.grammar_rule.rule_name, 'jlpt_level': row.jlpt_level, 'sort_order': row.sort_order,
            'status': progress.status if progress else 'not_started'}


@router.get('')
def list_lessons(level: Level, status: Literal['not_started','studied','mastered'] | None = None,
                 user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    rows = db.query(GrammarLesson, GrammarLessonProgress).outerjoin(GrammarLessonProgress,
        (GrammarLessonProgress.lesson_id == GrammarLesson.id) & (GrammarLessonProgress.user_id == user.id)).filter(
        GrammarLesson.jlpt_level == level).order_by(GrammarLesson.sort_order, GrammarLesson.id).all()
    items = [lesson_data(lesson, progress) for lesson, progress in rows]
    return {'items': [item for item in items if status is None or item['status'] == status]}


@router.get('/next')
def next_lesson(level: Level, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    items = list_lessons(level, None, user, db)['items']
    return {'lesson': next((item for item in items if item['status'] == 'not_started'), None)}


@router.get('/{lesson_id}')
def detail(lesson_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    lesson = db.get(GrammarLesson, lesson_id)
    if not lesson: raise HTTPException(404, 'grammar_lesson_not_found')
    progress = db.get(GrammarLessonProgress, (user.id, lesson.id))
    candidates = db.query(GrammarQuestion).filter(GrammarQuestion.grammar_rule_id == lesson.grammar_rule_id,
        GrammarQuestion.jlpt_level == lesson.jlpt_level, GrammarQuestion.is_active.is_(True), GrammarQuestion.source == 'seed').order_by(GrammarQuestion.id).limit(100).all()
    questions, seen = [], set()
    for question in candidates:
        key = ' '.join(question.prompt.casefold().split())
        if key in seen:
            continue
        seen.add(key); questions.append(question)
        if len(questions) == 3:
            break
    return {**lesson_data(lesson, progress), 'formation': lesson.formation, 'meaning': lesson.meaning,
            'usage_notes': lesson.usage_notes, 'examples': lesson.examples, 'common_errors': lesson.common_errors,
            'comparisons': lesson.comparisons, 'quick_questions': [public_question(q, q.grammar_rule) for q in questions]}


class ProgressRequest(BaseModel):
    status: Literal['studied', 'mastered'] = 'studied'


@router.put('/{lesson_id}/progress')
def mark(lesson_id: int, body: ProgressRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not db.get(GrammarLesson, lesson_id): raise HTTPException(404, 'grammar_lesson_not_found')
    db.query(User.id).filter(User.id == user.id).with_for_update().one()
    row = db.get(GrammarLessonProgress, (user.id, lesson_id))
    if row is None:
        row = GrammarLessonProgress(user_id=user.id, lesson_id=lesson_id, status=body.status); db.add(row)
    elif row.status != 'mastered' or body.status == 'mastered':
        row.status = body.status
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {'lesson_id': lesson_id, 'status': row.status}
