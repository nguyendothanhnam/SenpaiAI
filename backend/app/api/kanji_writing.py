"""Targeted writing is distinct from recognition. Preview never persists."""
import uuid
import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, FiniteFloat
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User, KanjiWritingAttempt, KanjiWritingReport
from ..services.kanji_stroke_geometry import length
from ..services.kanji_writing_templates import templates, template_response, evaluate_character
from ..services.kanji_writing_recognizer import recognizer_advice

router = APIRouter(prefix='/kanji-writing',tags=['kanji writing'])


class Point(BaseModel):
    x: FiniteFloat = Field(ge=-10000,le=10000)
    y: FiniteFloat = Field(ge=-10000,le=10000)


class WritingRequest(BaseModel):
    kanji: str = Field(min_length=1,max_length=1)
    strokes: list[list[Point]] = Field(max_length=40)
    final: bool = False
    mode: Literal['practice','test'] = 'practice'
    strictness: Literal['easy','standard','strict'] = 'standard'
    attempt_id: uuid.UUID | None = None
    include_recognizer_warning: bool = False
    elapsed_seconds: int = Field(default=0,ge=0,le=3600)


def request_digest(kanji, raw, mode, strictness):
    # Preserve old default requests/retries while distinguishing the new profiles.
    value = [kanji, raw, mode]
    if strictness != 'standard':
        value.append(strictness)
    return hashlib.sha256(json.dumps(value,separators=(',',':')).encode()).hexdigest()


class WritingReportRequest(BaseModel):
    attempt_id: uuid.UUID
    report_id: uuid.UUID
    strokes: list[list[Point]] = Field(max_length=40)
    comment: str = Field(default='', max_length=2000)
    confirmed: bool = False


@router.post('/reports')
def report(body: WritingReportRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not body.confirmed:
        raise HTTPException(422, 'kanji_writing_report_consent_required')
    if sum(len(s) for s in body.strokes)>20000 or any(not 2<=len(s)<=2000 for s in body.strokes):
        raise HTTPException(422, 'kanji_writing_invalid_points')
    db.query(User.id).filter_by(id=user.id).with_for_update().one()
    attempt = db.query(KanjiWritingAttempt).filter_by(user_id=user.id,attempt_key=str(body.attempt_id)).first()
    if attempt is None:
        raise HTTPException(404, 'kanji_writing_attempt_not_found')
    raw = [[(p.x,p.y) for p in stroke] for stroke in body.strokes]
    if request_digest(attempt.kanji,raw,attempt.mode,attempt.result.get('strictness','standard')) != attempt.result.get('request_digest'):
        raise HTTPException(409, 'kanji_writing_report_strokes_conflict')
    existing = db.query(KanjiWritingReport).filter_by(user_id=user.id,report_key=str(body.report_id)).first()
    if existing:
        if existing.attempt_key != str(body.attempt_id) or existing.comment != body.comment.strip():
            raise HTTPException(409, 'kanji_writing_report_conflict')
        return {'id':existing.report_key,'saved':True}
    row = KanjiWritingReport(user_id=user.id,report_key=str(body.report_id),attempt_key=attempt.attempt_key,
        kanji=attempt.kanji,strokes=body.model_dump()['strokes'],result=attempt.result,comment=body.comment.strip())
    db.add(row); db.commit()
    return {'id':row.report_key,'saved':True}


@router.get('/reports')
def reports(offset: int = Query(default=0,ge=0,le=100000), limit: int = Query(default=20,ge=1,le=100),
            user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    rows = db.query(KanjiWritingReport).filter_by(user_id=user.id).order_by(KanjiWritingReport.id.desc()).offset(offset).limit(limit+1).all()
    return {'items':[{'id':r.report_key,'attempt_id':r.attempt_key,'kanji':r.kanji,'strokes':r.strokes,'result':r.result,
                     'comment':r.comment,'created_at':r.created_at} for r in rows[:limit]],'offset':offset,'limit':limit,'has_more':len(rows)>limit}


@router.get('/supported')
def supported(level: Literal['N5','N4','N3'] | None = None):
    rows = [{'kanji':key,'level':item['level'],'stroke_count':len(item['raw'])} for key,item in templates().items() if not level or item['level']==level]
    return {'items':rows,'total':len(rows)}


@router.get('/progress')
def progress(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Compact per-character writing history; no other user's evidence or raw traces."""
    ranked = db.query(KanjiWritingAttempt.kanji.label('kanji'),
        KanjiWritingAttempt.result.label('result'), KanjiWritingAttempt.created_at.label('at'),
        func.row_number().over(partition_by=KanjiWritingAttempt.kanji,
            order_by=KanjiWritingAttempt.id.desc()).label('rank')).filter_by(user_id=user.id).subquery()
    totals = db.query(KanjiWritingAttempt.kanji,
        func.count(KanjiWritingAttempt.id),
        func.sum(case((KanjiWritingAttempt.result['passed'].as_boolean() == True, 1), else_=0))
    ).filter_by(user_id=user.id).group_by(KanjiWritingAttempt.kanji).all()
    latest = {row.kanji:row for row in db.query(ranked).filter(ranked.c.rank == 1).all()}
    bank = templates()
    return {'items':[{'kanji':key,'attempts':count,'passed_count':int(passed or 0),
        'last_passed':bool(latest[key].result.get('passed')),
        'last_score':latest[key].result.get('overall_score',0),'last_practiced':latest[key].at}
        for key,count,passed in totals if key in bank],
        'mastery_rule':{'minimum_passes':2,'latest_must_pass':True}}


@router.get('/template/{kanji}')
def template(kanji: str):
    if kanji not in templates():
        raise HTTPException(404,'kanji_writing_unavailable')
    return template_response(kanji)


@router.post('/evaluate')
def assess(body: WritingRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if body.kanji not in templates():
        raise HTTPException(404,'kanji_writing_unavailable')
    if sum(len(s) for s in body.strokes)>20000 or any(not 2<=len(s)<=2000 for s in body.strokes):
        raise HTTPException(422,'kanji_writing_invalid_points')
    raw = [[(p.x,p.y) for p in stroke] for stroke in body.strokes]
    if any(length(stroke)<1e-6 for stroke in raw):
        raise HTTPException(422,'kanji_writing_degenerate_stroke')
    if body.final and body.attempt_id is None:
        raise HTTPException(422,'kanji_writing_attempt_id_required')
    digest = request_digest(body.kanji,raw,body.mode,body.strictness)
    if body.final:
        # Serialize retries per user, so a repeated mobile/web request cannot add evidence twice.
        db.query(User.id).filter_by(id=user.id).with_for_update().one()
        existing = db.query(KanjiWritingAttempt).filter_by(user_id=user.id,attempt_key=str(body.attempt_id)).first()
        if existing:
            if existing.kanji!=body.kanji or existing.result.get('request_digest')!=digest:
                raise HTTPException(409,'kanji_writing_attempt_conflict')
            return {**existing.result,'saved':True,'attempt_id':existing.attempt_key}
    result = evaluate_character(body.kanji,raw,body.final,body.strictness)
    result['kanji'] = body.kanji
    advice = recognizer_advice(raw) if body.final and body.include_recognizer_warning else {'status':'not_requested','kanji':None}
    result['recognizer_status'] = advice['status']
    result['recognizer_warning'] = advice['kanji'] if advice['kanji'] and advice['kanji']!=body.kanji else None
    result['summary_key'] = 'writing.summary_pass' if result['passed'] else 'writing.summary_review'
    for row in result['strokes']:
        row['message_key'] = f"writing.status.{row['status']}"
    if body.final:
        result['request_digest']=digest
        row = KanjiWritingAttempt(user_id=user.id,attempt_key=str(body.attempt_id),kanji=body.kanji,
            jlpt_level=templates()[body.kanji]['level'],mode=body.mode,result=result,
            elapsed_seconds=body.elapsed_seconds,created_at=datetime.now(timezone.utc))
        db.add(row); db.commit()
    return {**result,'saved':body.final,'attempt_id':str(body.attempt_id) if body.final else None}
