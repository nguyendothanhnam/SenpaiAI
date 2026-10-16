from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import GrammarPracticeAttempt, GrammarQuestion, GrammarRule, LearningSession, User
from ..services.grammar_practice_service import (
    QUESTION_TYPES, grade_answer, is_duplicate_question, parse_generated_questions, public_question,
)

router = APIRouter(prefix="/grammar-practice", tags=["grammar practice"])
LEVELS = {"N5", "N4", "N3", "N2", "N1"}


class SessionRequest(BaseModel):
    jlpt_level: str
    grammar_rule_id: Optional[int] = None
    question_types: List[str] = Field(min_length=1)
    count: int = Field(ge=5, le=20)
    mode: Literal["bank", "ai", "mixed"] = "bank"
    question_ids: Optional[List[int]] = None


class AnswerRequest(BaseModel):
    question_id: int
    answer: Any
    time_spent_ms: int = Field(default=0, ge=0, le=3600000)


class GenerateRequest(BaseModel):
    jlpt_level: str
    grammar_rule_id: int
    question_type: str
    count: int = Field(ge=1, le=5)


def _validate_level(level: str) -> None:
    if level not in LEVELS:
        raise HTTPException(422, "jlpt_level must be N5, N4, N3, N2, or N1")


async def _ai_questions(db: Session, user_id: int, level: str, rule: GrammarRule, kind: str, count: int) -> Dict[str, int]:
    recent = datetime.now(timezone.utc) - timedelta(hours=1)
    used = db.query(func.count(GrammarQuestion.id)).filter(
        GrammarQuestion.source == "ai", GrammarQuestion.created_by_user_id == user_id,
        GrammarQuestion.created_at >= recent,
    ).scalar() or 0
    allowed = max(0, min(count, 30 - used))
    if allowed == 0:
        return {"requested": count, "saved": 0, "rejected": count, "limited": True}
    from ..services.grammar_practice_service import generate_raw_questions
    try:
        raw = await generate_raw_questions(level, rule.rule_name, kind, allowed)
    except Exception as exc:
        return {"requested": count, "saved": 0, "rejected": count, "error": str(exc)}
    parsed, rejected = parse_generated_questions(raw, level, kind)
    existing = db.query(GrammarQuestion.prompt, GrammarQuestion.question_type).all()
    existing_keys = [(prompt, qtype) for prompt, qtype in existing]
    saved = 0
    for candidate in parsed:
        if candidate.jlpt_level != level or candidate.question_type != kind:
            rejected += 1
            continue
        if is_duplicate_question(candidate.prompt, kind, existing_keys):
            rejected += 1
            continue
        obj = GrammarQuestion(
            grammar_rule_id=rule.id, jlpt_level=level, question_type=kind,
            prompt=candidate.prompt, payload=candidate.payload,
            correct_answer=candidate.correct_answer, accepted_answers=candidate.accepted_answers,
            explanation_vi=candidate.explanation_vi, examples=candidate.examples,
            source="ai", created_by_user_id=user_id, is_active=True,
        )
        db.add(obj)
        existing_keys.append((candidate.prompt, kind))
        saved += 1
    db.flush()
    return {"requested": count, "saved": saved, "rejected": rejected + max(0, allowed - saved - rejected), "limited": allowed < count}


@router.get("/patterns")
async def get_patterns(jlpt_level: str = Query(...), current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    _validate_level(jlpt_level)
    rules = db.query(GrammarRule).filter(GrammarRule.jlpt_level == jlpt_level).order_by(GrammarRule.id).all()
    rows = db.query(GrammarQuestion.grammar_rule_id, GrammarQuestion.question_type, func.count(GrammarQuestion.id)).filter(
        GrammarQuestion.jlpt_level == jlpt_level, GrammarQuestion.is_active.is_(True)
    ).group_by(GrammarQuestion.grammar_rule_id, GrammarQuestion.question_type).all()
    counts: Dict[Optional[int], Dict[str, int]] = {}
    for rule_id, kind, count in rows:
        counts.setdefault(rule_id, {})[kind] = count
    return {"jlpt_level": jlpt_level, "patterns": [
        {"id": r.id, "rule_name": r.rule_name, "japanese_pattern": r.japanese_pattern,
         "meaning": r.meaning, "usage_notes": r.usage_notes,
         "question_counts": {kind: counts.get(r.id, {}).get(kind, 0) for kind in sorted(QUESTION_TYPES)}}
        for r in rules
    ]}


@router.post("/sessions")
async def create_session(body: SessionRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    _validate_level(body.jlpt_level)
    if not set(body.question_types) <= QUESTION_TYPES:
        raise HTTPException(422, "Unsupported question type")
    if body.grammar_rule_id is not None and not db.query(GrammarRule.id).filter(GrammarRule.id == body.grammar_rule_id, GrammarRule.jlpt_level == body.jlpt_level).first():
        raise HTTPException(404, "Grammar pattern not found")
    query = db.query(GrammarQuestion).options(joinedload(GrammarQuestion.grammar_rule)).filter(
        GrammarQuestion.is_active.is_(True), GrammarQuestion.jlpt_level == body.jlpt_level,
        GrammarQuestion.question_type.in_(body.question_types),
    )
    if body.grammar_rule_id is not None:
        query = query.filter(GrammarQuestion.grammar_rule_id == body.grammar_rule_id)
    if body.question_ids is not None:
        query = query.filter(GrammarQuestion.id.in_(body.question_ids))
    bank = query.all()
    attempted_rows = db.query(GrammarPracticeAttempt.question_id, GrammarPracticeAttempt.is_correct).filter(
        GrammarPracticeAttempt.user_id == current_user.id,
        GrammarPracticeAttempt.question_id.in_([q.id for q in bank] or [-1]),
    ).order_by(GrammarPracticeAttempt.created_at.desc(), GrammarPracticeAttempt.id.desc()).all()
    latest_attempt = {}
    for qid, correct in attempted_rows:
        latest_attempt.setdefault(qid, correct)
    wrong = {qid for qid, correct in latest_attempt.items() if not correct}
    unseen = {q.id for q in bank} - set(latest_attempt)
    bank.sort(key=lambda q: (q.id not in unseen, q.id not in wrong))
    selected = [] if body.mode == "ai" else bank[:body.count]
    messages = []
    if body.mode in {"ai", "mixed"} and (body.mode == "ai" or len(selected) < body.count):
        rules = ([db.query(GrammarRule).filter(GrammarRule.id == body.grammar_rule_id).first()]
                 if body.grammar_rule_id else db.query(GrammarRule).filter(GrammarRule.jlpt_level == body.jlpt_level).all())
        rules = [rule for rule in rules if rule]
        if rules:
            for kind_index, kind in enumerate(body.question_types):
                while len(selected) < body.count:
                    missing = body.count - len(selected)
                    rule = rules[kind_index % len(rules)]
                    result = await _ai_questions(db, current_user.id, body.jlpt_level, rule, kind, min(5, missing))
                    if result["saved"]:
                        extra = db.query(GrammarQuestion).options(joinedload(GrammarQuestion.grammar_rule)).filter(
                            GrammarQuestion.created_by_user_id == current_user.id,
                            GrammarQuestion.source == "ai", GrammarQuestion.grammar_rule_id == rule.id,
                            GrammarQuestion.question_type == kind, GrammarQuestion.id.notin_([q.id for q in selected] or [-1]),
                        ).order_by(GrammarQuestion.id.desc()).limit(result["saved"]).all()
                        selected.extend(extra)
                    if result.get("error") or result.get("limited"):
                        messages.append(result.get("error") or "Đã chạm giới hạn sinh câu AI theo giờ.")
                        break
                    if result["saved"] == 0:
                        break
                if len(selected) >= body.count:
                    break
    if len(selected) < body.count:
        messages.append(f"Ngân hàng hiện có {len(selected)}/{body.count} câu phù hợp.")
    if not selected:
        raise HTTPException(404, "Không có câu hỏi phù hợp ở cấp độ và dạng đã chọn.")
    selected_ids = ",".join(str(question.id) for question in selected)
    session = LearningSession(user_id=current_user.id, session_type="grammar", topic=f"grammar_practice:{selected_ids}", difficulty_level=body.jlpt_level, questions_answered=0, correct_answers=0)
    db.add(session)
    db.commit()
    return {"session_id": session.id, "questions": [public_question(q, q.grammar_rule) for q in selected], "message": " ".join(messages) or None}


def _owned_session(db: Session, session_id: int, user_id: int) -> LearningSession:
    session = db.query(LearningSession).filter(LearningSession.id == session_id, LearningSession.user_id == user_id, LearningSession.session_type == "grammar").first()
    if not session:
        raise HTTPException(404, "Grammar practice session not found")
    return session


@router.post("/sessions/{session_id}/answer")
async def answer_question(session_id: int, body: AnswerRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    session = _owned_session(db, session_id, current_user.id)
    if session.completed_at:
        raise HTTPException(409, "Session is already finished")
    selected_ids = set((session.topic or "").partition(":")[2].split(","))
    if str(body.question_id) not in selected_ids:
        raise HTTPException(404, "Question is not part of this session")
    if db.query(GrammarPracticeAttempt.id).filter(GrammarPracticeAttempt.learning_session_id == session.id, GrammarPracticeAttempt.question_id == body.question_id).first():
        raise HTTPException(409, "Question already answered in this session")
    question = db.query(GrammarQuestion).options(joinedload(GrammarQuestion.grammar_rule)).filter(GrammarQuestion.id == body.question_id, GrammarQuestion.is_active.is_(True)).first()
    if not question:
        raise HTTPException(404, "Question not found")
    if question.jlpt_level != session.difficulty_level:
        raise HTTPException(404, "Question is not part of this session")
    is_correct = grade_answer(question.question_type, body.answer, question.correct_answer, question.accepted_answers)
    attempt = GrammarPracticeAttempt(
        user_id=current_user.id, learning_session_id=session.id, question_id=question.id,
        grammar_rule_id=question.grammar_rule_id, jlpt_level=question.jlpt_level,
        question_type=question.question_type, user_answer=body.answer, is_correct=is_correct,
        time_spent_ms=body.time_spent_ms,
    )
    db.add(attempt)
    session.questions_answered = (session.questions_answered or 0) + 1
    session.correct_answers = (session.correct_answers or 0) + int(is_correct)
    db.commit()
    return {"is_correct": is_correct, "correct_answer": question.correct_answer,
            "accepted_answers": question.accepted_answers or [], "explanation_vi": question.explanation_vi,
            "examples": question.examples or []}


@router.post("/sessions/{session_id}/finish")
async def finish_session(session_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    session = _owned_session(db, session_id, current_user.id)
    now = datetime.now(timezone.utc)
    if not session.completed_at:
        session.completed_at = now
        session.duration_minutes = max(0, int((now - session.created_at.replace(tzinfo=timezone.utc)).total_seconds() // 60)) if session.created_at else 0
        db.commit()
    attempts = db.query(GrammarPracticeAttempt).filter(GrammarPracticeAttempt.learning_session_id == session.id).all()
    by_rule: Dict[str, Dict[str, int]] = {}
    wrong = []
    for attempt in attempts:
        key = str(attempt.grammar_rule_id or "unknown")
        item = by_rule.setdefault(key, {"grammar_rule_id": attempt.grammar_rule_id, "rule_name": attempt.grammar_rule.rule_name if attempt.grammar_rule else None, "questions": 0, "correct": 0})
        item["questions"] += 1
        item["correct"] += int(attempt.is_correct)
        if not attempt.is_correct and attempt.question_id:
            wrong.append(attempt.question_id)
    seconds = max(0, int((session.completed_at.replace(tzinfo=timezone.utc) - session.created_at.replace(tzinfo=timezone.utc)).total_seconds())) if session.created_at else 0
    return {"score": session.correct_answers or 0, "total": session.questions_answered or 0,
            "duration_seconds": seconds, "by_rule": list(by_rule.values()), "wrong_question_ids": wrong}


@router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    attempts = db.query(GrammarPracticeAttempt).filter(GrammarPracticeAttempt.user_id == current_user.id).all()
    by_level: Dict[str, Dict[str, int]] = {}
    by_rule: Dict[int, Dict[str, Any]] = {}
    activity: Dict[str, Dict[str, int]] = {}
    for a in attempts:
        level = by_level.setdefault(a.jlpt_level, {"total": 0, "correct": 0})
        level["total"] += 1
        level["correct"] += int(a.is_correct)
        if a.grammar_rule_id:
            rule = by_rule.setdefault(a.grammar_rule_id, {"grammar_rule_id": a.grammar_rule_id, "total": 0, "correct": 0})
            rule["total"] += 1
            rule["correct"] += int(a.is_correct)
        if a.created_at and a.created_at.replace(tzinfo=timezone.utc) >= since:
            day = a.created_at.date().isoformat()
            d = activity.setdefault(day, {"total": 0, "correct": 0})
            d["total"] += 1
            d["correct"] += int(a.is_correct)
    for values in by_rule.values():
        values["accuracy"] = round(values["correct"] / values["total"], 4) if values["total"] else 0
    ids = list(by_rule)
    rules = {r.id: r.rule_name for r in db.query(GrammarRule).filter(GrammarRule.id.in_(ids or [-1])).all()}
    for rid, values in by_rule.items():
        values["rule_name"] = rules.get(rid)
    weak = sorted((v for v in by_rule.values() if v["total"] >= 2), key=lambda x: (x["accuracy"], -x["total"]))[:5]
    for values in by_level.values():
        values["accuracy"] = round(values["correct"] / values["total"], 4) if values["total"] else 0
    return {"by_jlpt": by_level, "by_pattern": list(by_rule.values()), "weak_patterns": weak,
            "activity_7_days": [{"date": day, **activity.get(day, {"total": 0, "correct": 0})} for day in [(datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]]}


@router.post("/generate")
async def generate_questions(body: GenerateRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    _validate_level(body.jlpt_level)
    if body.question_type not in QUESTION_TYPES:
        raise HTTPException(422, "Unsupported question_type")
    rule = db.query(GrammarRule).filter(GrammarRule.id == body.grammar_rule_id, GrammarRule.jlpt_level == body.jlpt_level).first()
    if not rule:
        raise HTTPException(404, "Grammar pattern not found")
    result = await _ai_questions(db, current_user.id, body.jlpt_level, rule, body.question_type, body.count)
    db.commit()
    return result
