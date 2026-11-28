"""Profile summary is derived from persisted results; no duplicate profile/history table."""
from ..models.database import PlacementAttempt
from .placement_assessment_service import utc_timestamp
from .placement_override import manual_placement_level


def profile_summary(db, user):
    manual = manual_placement_level(user)
    completed = db.query(PlacementAttempt).filter_by(user_id=user.id, status="completed")
    rows = completed.order_by(PlacementAttempt.id.desc()).limit(20).all()
    latest = completed.filter(PlacementAttempt.confirmed_at.isnot(None),
        (PlacementAttempt.estimated_level.isnot(None)) | (PlacementAttempt.assessment_mode == "legacy")).order_by(
        PlacementAttempt.confirmed_at.desc(), PlacementAttempt.id.desc()).first()
    current = user.current_jlpt_level if latest and not manual else None
    history = [{"id": row.id, "mode": row.assessment_mode, "selected_level": row.selected_level,
                "estimated_level": row.estimated_level if row.assessment_mode != "legacy" else row.recommended_level,
                "total_score": row.total_score, "skill_scores": row.skill_scores or {},
                "completed_at": utc_timestamp(row.completed_at), "confirmed_at": utc_timestamp(row.confirmed_at),
                "scoring_version": row.scoring_version, "is_demo": bool((row.result or {}).get("is_demo")),
                "evidence_status": (row.result or {}).get("evidence_status", "legacy")}
               for row in rows[:20]]
    result = latest.result or {} if latest else {}
    return {"current_estimated_level": current, "manual_level": manual,
            "source": "manual_override" if manual else "legacy_estimate" if latest and latest.assessment_mode == "legacy" else "assessment" if latest else "unassessed",
            "last_assessed_at": utc_timestamp(rows[0].completed_at) if rows else None,
            "last_confirmed_at": utc_timestamp(latest.confirmed_at) if latest else None,
            "skill_scores": latest.skill_scores or {} if latest and not manual else {}, "focus_skills": result.get("focus_skills", []) if not manual else [],
            "history": history, "is_official_certificate": False}
