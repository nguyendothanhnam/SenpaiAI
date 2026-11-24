"""Owned, bounded learning projections shared by web and future mobile clients."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User, WeeklyLearningGoal
from ..services.learning_history import LearningSnapshot, local_date
from ..services import learning_progress as service

router = APIRouter(prefix='/learning', tags=['learning progress'])
Skill = Literal['vocab', 'grammar', 'kanji', 'listening', 'conversation', 'interview']
Level = Literal['N5', 'N4', 'N3', 'N2', 'N1']


def snapshot(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return LearningSnapshot(db, user)


@router.get('/overview')
def overview(data=Depends(snapshot)):
    return service.overview(data)


@router.get('/roadmap')
def roadmap(data=Depends(snapshot)):
    return service.roadmap(data)


@router.get('/mastery')
def mastery(skill: Skill | None = None, level: Level | None = None,
            offset: int = Query(0, ge=0, le=100000), limit: int = Query(20, ge=1, le=100), data=Depends(snapshot)):
    rows = service.mastery_items(data, skill, level)
    return {'items': rows[offset:offset + limit], 'total': len(rows), 'offset': offset, 'limit': limit,
            'has_more': offset + limit < len(rows), 'skills': service.skills(data, level), 'coverage': data.coverage()}


@router.get('/reports')
def reports(period: Literal['week', 'month'] = 'week', anchor: date | None = None,
            offset: int = Query(0, ge=0, le=51), limit: int = Query(1, ge=1, le=12), data=Depends(snapshot)):
    anchor = anchor or data.today
    if anchor > data.today or anchor < local_date(data.since):
        raise HTTPException(422, 'learning_period_out_of_range')
    start, _ = service.period_bounds(period, anchor)
    starts = []
    while start >= local_date(data.since):
        starts.append(start)
        start = service.previous_start(period, start)
    selected = starts[offset:offset + limit]
    return {'items': [service.report(data, period, start) for start in selected], 'offset': offset,
            'limit': limit, 'total': len(starts), 'has_more': offset + limit < len(starts), 'coverage': data.coverage()}


class GoalRequest(BaseModel):
    study_days: int = Field(ge=1, le=7)
    lessons: int = Field(ge=1, le=100)


@router.get('/goals')
def goals(data=Depends(snapshot)):
    return service.weekly_goals(data)


@router.put('/goals')
def update_goals(body: GoalRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    db.query(User.id).filter_by(id=user.id).with_for_update().one()
    row = db.query(WeeklyLearningGoal).filter_by(user_id=user.id).first()
    if row is None:
        row = WeeklyLearningGoal(user_id=user.id)
        db.add(row)
    row.study_days, row.lessons = body.study_days, body.lessons
    db.commit()
    return {'study_days': row.study_days, 'lessons': row.lessons}
