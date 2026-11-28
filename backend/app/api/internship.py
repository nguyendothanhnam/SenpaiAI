import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import InternshipProfile, InternshipSession, User
from ..services import cv_service, internship_service
from ..services.internship_data import INDUSTRIES

router = APIRouter(prefix="/internship", tags=["Internship"])


class StartInterviewRequest(BaseModel):
    industry_id: str = Field(default="it", description="ID của ngành nghề (it, hospitality, kaigo, engineering, manufacturing, business)")
    target_level: Optional[int] = Field(default=1, ge=1, le=5)


class StartInterviewWithCVRequest(BaseModel):
    industry_id: str = Field(default="it", description="ID của ngành nghề")
    cv_text: str = Field(min_length=10, description="Nội dung văn bản CV của ứng viên")
    parsed_cv: Optional[Dict[str, Any]] = None


class ParseCVTextRequest(BaseModel):
    cv_text: str = Field(min_length=10, description="Nội dung văn bản CV")


class StartWorkplaceRequest(BaseModel):
    industry_id: str
    scenario_id: str


class TurnAnswerRequest(BaseModel):
    user_response: str = Field(min_length=1, max_length=2000, description="Câu trả lời của người học")


@router.get("/profile")
def get_user_internship_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    profile = internship_service.get_or_create_internship_profile(db, current_user.id)
    
    # Calculate next level EXP thresholds
    # Level 1: 0 -> 150, Level 2: 150 -> 400, Level 3: 400 -> 800, Level 4: 800 -> 1500, Level 5: 1500+
    level_thresholds = {1: 150, 2: 400, 3: 800, 4: 1500, 5: 3000}
    current_threshold = level_thresholds.get(profile.current_level, 3000)
    prev_threshold = {1: 0, 2: 150, 3: 400, 4: 800, 5: 1500}.get(profile.current_level, 0)
    
    # Recent sessions
    recent_sessions = db.query(InternshipSession).filter(
        InternshipSession.user_id == current_user.id
    ).order_by(InternshipSession.created_at.desc()).limit(5).all()

    recent_sessions_summary = [
        {
            "id": str(s.id),
            "session_type": s.session_type,
            "industry": s.industry,
            "level": s.level,
            "status": s.status,
            "overall_score": s.overall_score,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in recent_sessions
    ]

    return {
        "user_id": profile.user_id,
        "username": current_user.username,
        "current_industry": profile.current_industry,
        "current_level": profile.current_level,
        "exp_points": profile.exp_points,
        "next_level_exp": current_threshold,
        "prev_level_exp": prev_threshold,
        "company_name": profile.company_name,
        "job_title": profile.job_title,
        "interview_passed": profile.interview_passed,
        "total_interviews": profile.total_interviews,
        "total_scenarios_completed": profile.total_scenarios_completed,
        "manner_score_avg": profile.manner_score_avg,
        "keigo_score_avg": profile.keigo_score_avg,
        "recent_sessions": recent_sessions_summary
    }


@router.get("/industries")
def get_industries():
    """Returns the 6 curated industries, companies, NPC interviewers, and workplace scenarios."""
    return internship_service.get_industries_catalog()


@router.get("/handbook")
def get_handbook():
    """Returns the Japanese business etiquette handbook."""
    return internship_service.get_handbook_data()


@router.post("/interview/start")
def start_interview(
    payload: StartInterviewRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session_data = internship_service.start_interview_session(
        db=db,
        user_id=current_user.id,
        industry_id=payload.industry_id,
        target_level=payload.target_level or 1
    )
    return session_data


@router.post("/cv/parse-text")
async def parse_cv_text(payload: ParseCVTextRequest):
    """Parses raw text of candidate CV using AI & returns extracted profile."""
    try:
        parsed = await cv_service.parse_candidate_cv(payload.cv_text)
        return {
            "raw_cv_text": payload.cv_text,
            "parsed_cv": parsed
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CV parsing failed: {str(exc)}")


@router.post("/cv/upload")
async def upload_and_parse_cv(file: UploadFile = File(...)):
    """Uploads a CV file (.pdf, .docx, .txt), extracts real text, and parses structured candidate profile."""
    try:
        content = await file.read()
        extracted_text = cv_service.extract_cv_text_from_file(content, file.filename or "cv.txt")
        if not extracted_text or len(extracted_text.strip()) < 15:
            raise HTTPException(
                status_code=400,
                detail="File CV không có đủ nội dung văn bản. Vui lòng chuyển sang tab 'Dán văn bản CV' để nhập trực tiếp."
            )
            
        parsed = await cv_service.parse_candidate_cv(extracted_text)
        return {
            "filename": file.filename,
            "raw_cv_text": extracted_text,
            "parsed_cv": parsed
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[CV Upload] Error processing CV: %s", exc)
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc file CV: {str(exc)}")


@router.post("/interview/start-with-cv")
async def start_interview_with_cv(
    payload: StartInterviewWithCVRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Indexes CV into RAG, generates 4 tailored technical interview questions, and launches the session."""
    try:
        parsed = payload.parsed_cv
        if not parsed:
            parsed = await cv_service.parse_candidate_cv(payload.cv_text)
            
        session_data = await internship_service.start_interview_session_with_cv(
            db=db,
            user_id=current_user.id,
            parsed_cv=parsed,
            raw_cv_text=payload.cv_text,
            industry_id=payload.industry_id
        )
        return session_data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể khởi tạo phỏng vấn kỹ thuật theo CV: {str(exc)}")


@router.post("/workplace/start")
def start_workplace_scenario(
    payload: StartWorkplaceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session_data = internship_service.start_workplace_session(
        db=db,
        user_id=current_user.id,
        industry_id=payload.industry_id,
        scenario_id=payload.scenario_id
    )
    return session_data


@router.post("/sessions/{session_id}/turn")
async def answer_session_turn(
    session_id: uuid.UUID,
    payload: TurnAnswerRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        session_data = await internship_service.process_turn_answer(
            db=db,
            user_id=current_user.id,
            session_id=session_id,
            user_response=payload.user_response
        )
        return session_data
    except internship_service.InterviewEvaluationUnavailable:
        raise HTTPException(status_code=503, detail="interview_evaluation_unavailable")
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"turn_processing_failed: {str(exc)}")


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session = db.query(InternshipSession).filter(
        InternshipSession.id == session_id,
        InternshipSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")
    
    industry = INDUSTRIES.get(session.industry, INDUSTRIES["it"])
    return internship_service.format_session_response(session, industry)


@router.get("/sessions")
def list_user_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(InternshipSession).filter(
        InternshipSession.user_id == current_user.id
    ).order_by(InternshipSession.created_at.desc())
    
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "items": [
            {
                "id": str(s.id),
                "session_type": s.session_type,
                "industry": s.industry,
                "level": s.level,
                "scenario_id": s.scenario_id,
                "status": s.status,
                "overall_score": s.overall_score,
                "grammar_score": s.grammar_score,
                "keigo_score": s.keigo_score,
                "manner_score": s.manner_score,
                "has_offer_letter": s.offer_letter is not None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            }
            for s in items
        ]
    }

