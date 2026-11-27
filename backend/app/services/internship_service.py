import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from ..models.database import InternshipProfile, InternshipSession, User
from .internship_data import BUSINESS_HANDBOOK, INDUSTRIES
from .llm_service import japanese_service
from .rewards_service import award_points
from .cv_service import (
    index_cv_into_rag,
    generate_technical_questions_from_cv,
    evaluate_turn_with_ai_rag,
    evaluate_keigo_nuance
)

logger = logging.getLogger(__name__)


def get_or_create_internship_profile(db: Session, user_id: int) -> InternshipProfile:
    profile = db.query(InternshipProfile).filter(InternshipProfile.user_id == user_id).first()
    if profile:
        return profile
    
    default_ind = INDUSTRIES["it"]
    profile = InternshipProfile(
        user_id=user_id,
        current_industry="it",
        current_level=1,
        exp_points=0,
        company_name=default_ind["company_name"],
        job_title="Thực tập sinh IT mới",
        interview_passed=False,
        total_interviews=0,
        total_scenarios_completed=0,
        manner_score_avg=0.0,
        keigo_score_avg=0.0,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_industries_catalog() -> Dict[str, Any]:
    return INDUSTRIES


def get_handbook_data() -> List[Dict[str, Any]]:
    return BUSINESS_HANDBOOK


def start_interview_session(db: Session, user_id: int, industry_id: str, target_level: int = 1) -> Dict[str, Any]:
    industry = INDUSTRIES.get(industry_id, INDUSTRIES["it"])
    session_id = uuid.uuid4()
    
    first_q = industry["interview_questions"][0]
    interviewer = industry["interviewer"]
    
    initial_turns = [
        {
            "turn": 1,
            "speaker": "npc",
            "npc_name": interviewer["name"],
            "npc_title": interviewer["title"],
            "npc_emotion": "neutral",
            "message_ja": first_q["question_ja"],
            "message_vi": first_q["question_vi"],
            "focus": first_q.get("focus", ""),
            "hints": first_q.get("hints", []),
            "user_response": None,
            "feedback": None,
            "scores": None
        }
    ]
    
    session = InternshipSession(
        id=session_id,
        user_id=user_id,
        session_type="interview",
        industry=industry_id,
        level=target_level,
        scenario_id="interview",
        status="in_progress",
        current_turn=1,
        max_turns=len(industry["interview_questions"]),
        overall_score=0.0,
        grammar_score=0.0,
        keigo_score=0.0,
        manner_score=0.0,
        turns_data=initial_turns,
        final_feedback=None,
        offer_letter=None
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return format_session_response(session, industry)


async def start_interview_session_with_cv(
    db: Session,
    user_id: int,
    parsed_cv: Dict[str, Any],
    raw_cv_text: str,
    industry_id: str = "it"
) -> Dict[str, Any]:
    """Starts an interview session with technical questions generated via RAG based on the candidate's CV."""
    industry = INDUSTRIES.get(industry_id, INDUSTRIES["it"])
    session_id = uuid.uuid4()
    
    # 1. Index CV into RAG
    index_cv_into_rag(user_id, parsed_cv, raw_cv_text)
    
    # 2. Generate 4 tailored technical interview questions using RAG
    custom_questions = await generate_technical_questions_from_cv(user_id, parsed_cv, industry_id)
    
    interviewer = industry["interviewer"]
    first_q = custom_questions[0]
    
    initial_turns = [
        {
            "turn": 1,
            "speaker": "npc",
            "npc_name": interviewer["name"],
            "npc_title": interviewer["title"],
            "npc_emotion": "neutral",
            "message_ja": first_q["question_ja"],
            "message_vi": first_q["question_vi"],
            "focus": first_q.get("focus", "Kỹ năng lập trình & Tech stack trong CV"),
            "expected_criteria": first_q.get("expected_criteria", ""),
            "hints": first_q.get("hints", []),
            "user_response": None,
            "feedback": None,
            "scores": None
        }
    ]
    
    session = InternshipSession(
        id=session_id,
        user_id=user_id,
        session_type="interview",
        industry=industry_id,
        level=3,  # Technical interviews match Cấp 3 (N3+) standards
        scenario_id="interview_cv",
        status="in_progress",
        current_turn=1,
        max_turns=len(custom_questions),
        overall_score=0.0,
        grammar_score=0.0,
        keigo_score=0.0,
        manner_score=0.0,
        turns_data=initial_turns,
        final_feedback={
            "cv_profile": parsed_cv,
            "cv_questions": custom_questions
        },
        offer_letter=None
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return format_session_response(session, industry)


def start_workplace_session(db: Session, user_id: int, industry_id: str, scenario_id: str) -> Dict[str, Any]:
    industry = INDUSTRIES.get(industry_id, INDUSTRIES["it"])
    
    target_scenario = None
    for sc in industry.get("scenarios", []):
        if sc["id"] == scenario_id:
            target_scenario = sc
            break
            
    if not target_scenario:
        # Fallback to first scenario
        target_scenario = industry["scenarios"][0]
        scenario_id = target_scenario["id"]
        
    session_id = uuid.uuid4()
    first_step = target_scenario["turns"][0]
    
    initial_turns = [
        {
            "turn": 1,
            "speaker": "npc",
            "npc_name": target_scenario["npc_name"],
            "npc_title": target_scenario["npc_title"],
            "npc_emotion": "neutral",
            "message_ja": first_step["npc_ja"],
            "message_vi": first_step["npc_vi"],
            "focus": target_scenario.get("goal", ""),
            "hints": first_step.get("hints", []),
            "user_response": None,
            "feedback": None,
            "scores": None
        }
    ]
    
    session = InternshipSession(
        id=session_id,
        user_id=user_id,
        session_type="workplace",
        industry=industry_id,
        level=target_scenario["level"],
        scenario_id=scenario_id,
        status="in_progress",
        current_turn=1,
        max_turns=len(target_scenario["turns"]),
        overall_score=0.0,
        grammar_score=0.0,
        keigo_score=0.0,
        manner_score=0.0,
        turns_data=initial_turns,
        final_feedback=None,
        offer_letter=None
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return format_session_response(session, industry, target_scenario)


async def evaluate_turn_with_ai(
    industry_name: str,
    npc_name: str,
    question_ja: str,
    user_text: str,
    session_type: str,
    turn_number: int
) -> Dict[str, Any]:
    """Evaluates Japanese business speech on 3 pillars: Grammar, Keigo (Politeness), and Business Manner."""
    system_prompt = (
        "Bạn là giám khảo phỏng vấn và chuyên gia văn hóa công sở Nhật Bản cho người Việt Nam.\n"
        "Đánh giá câu trả lời của ứng viên/thực tập sinh theo 3 tiêu chí: Ngữ pháp (grammar: 0-100), Kính ngữ (keigo: 0-100), và Tác phong văn hóa công sở Nhật (manner: 0-100).\n"
        "Hãy sửa câu cho tự nhiên, đúng chuẩn văn phong kinh doanh Nhật Bản (business Japanese), và viết lời khuyên bằng tiếng Việt.\n"
        "Đồng thời tạo câu phản hồi tiếp theo của người phỏng vấn/đồng nghiệp Nhật (bằng tiếng Nhật và dịch tiếng Việt).\n"
        "Chỉ trả lời duy nhất JSON hợp lệ theo cấu trúc sau, không kèm bất kỳ giải thích nào khác:\n"
        "{\n"
        '  "grammar_score": 85,\n'
        '  "keigo_score": 90,\n'
        '  "manner_score": 88,\n'
        '  "corrected_sentence": "Câu tiếng Nhật đã được sửa chuẩn phong cách công sở",\n'
        '  "advice_vi": "Lời khuyên chi tiết về kính ngữ và văn hóa công sở Nhật",\n'
        '  "npc_reaction": "happy | neutral | thinking | strict | surprised",\n'
        '  "npc_followup_ja": "Câu nói/câu hỏi tiếp theo của NPC bằng tiếng Nhật",\n'
        '  "npc_followup_vi": "Bản dịch tiếng Việt của câu tiếp theo"\n'
        "}"
    )

    prompt = (
        f"Ngành nghề: {industry_name}\n"
        f"Người hỏi ({npc_name}): {question_ja}\n"
        f"Lượt số: {turn_number}\n"
        f"Câu trả lời của người học: {user_text}\n"
    )

    try:
        raw_reply = await japanese_service.voice_completion(system_prompt, prompt)
        clean_json = raw_reply.strip()
        clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.IGNORECASE).strip()
        
        # Extract json object if surrounded by other characters
        match = re.search(r"\{.*\}", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        data = json.loads(clean_json)
        return {
            "grammar_score": max(0, min(100, int(data.get("grammar_score", 80)))),
            "keigo_score": max(0, min(100, int(data.get("keigo_score", 80)))),
            "manner_score": max(0, min(100, int(data.get("manner_score", 80)))),
            "corrected_sentence": data.get("corrected_sentence", user_text),
            "advice_vi": data.get("advice_vi", "Phát biểu rõ ràng và tự tin."),
            "npc_reaction": data.get("npc_reaction", "happy"),
            "npc_followup_ja": data.get("npc_followup_ja", "承知いたしました。"),
            "npc_followup_vi": data.get("npc_followup_vi", "Tôi đã hiểu rồi.")
        }
    except Exception as exc:
        logger.warning("AI evaluation failed, using rule-based assessment: %s", exc)
        return generate_heuristic_evaluation(user_text, question_ja)


def generate_heuristic_evaluation(user_text: str, question_ja: str) -> Dict[str, Any]:
    """Smart fallback if LLM is unavailable."""
    clean_text = user_text.strip()
    keigo_eval = evaluate_keigo_nuance(clean_text)
    keigo = keigo_eval["score"]
    has_desu_masu = keigo_eval["has_teineigo"]
    has_watakushi = "私" in clean_text or "わたくし" in clean_text or "わたし" in clean_text
    
    if len(clean_text) < 5 or keigo <= 20:
        return {
            "grammar_score": min(40, keigo + 10),
            "keigo_score": keigo,
            "manner_score": 30,
            "corrected_sentence": "はい、承知いたしました。よろしくお願いいたします。",
            "advice_vi": (
                f"{keigo_eval['feedback']}\n\n"
                "👔 Tác phong (マナー): Câu trả lời quá ngắn hoặc chưa hoàn chỉnh. Hãy diễn đạt câu đầy đủ với chủ ngữ, vị ngữ và thể lịch sự (です/ます)."
            ),
            "npc_reaction": "strict",
            "npc_followup_ja": "恐れ入りますが、もう少し詳しくお話しいただけますでしょうか。",
            "npc_followup_vi": "Xin lỗi, bạn có thể nói rõ hơn một chút được không?"
        }

    grammar = 85 if has_desu_masu else 55
    manner = 88 if has_watakushi else 75
    advice = (
        f"{keigo_eval['feedback']}\n\n"
        "👔 Tác phong (マナー): Phát biểu rõ ràng, chú ý xưng hô chuẩn mực khi giao tiếp với cấp trên."
    )
        
    return {
        "grammar_score": grammar,
        "keigo_score": keigo,
        "manner_score": manner,
        "corrected_sentence": clean_text if has_desu_masu else f"{clean_text}です。",
        "advice_vi": advice,
        "npc_reaction": "happy" if (grammar + keigo + manner) // 3 >= 80 else "thinking",
        "npc_followup_ja": "ありがとうございます。よく分かりました。",
        "npc_followup_vi": "Cảm ơn bạn. Tôi đã hiểu rõ rồi."
    }


async def process_turn_answer(
    db: Session,
    user_id: int,
    session_id: uuid.UUID,
    user_response: str
) -> Dict[str, Any]:
    session = db.query(InternshipSession).filter(
        InternshipSession.id == session_id,
        InternshipSession.user_id == user_id
    ).first()
    
    if not session:
        raise ValueError("session_not_found")
    if session.status != "in_progress":
        raise ValueError("session_already_finished")
        
    industry = INDUSTRIES.get(session.industry, INDUSTRIES["it"])
    turns_list = list(session.turns_data or [])
    curr_turn_idx = session.current_turn - 1
    
    if curr_turn_idx >= len(turns_list):
        raise ValueError("invalid_turn_index")
        
    current_turn_data = turns_list[curr_turn_idx]
    
    # AI Evaluation (Grounded with RAG if session is CV-based technical interview)
    is_cv_interview = session.scenario_id == "interview_cv"
    if is_cv_interview:
        cv_profile = (session.final_feedback or {}).get("cv_profile")
        evaluation = await evaluate_turn_with_ai_rag(
            user_id=user_id,
            question_data=current_turn_data,
            user_text=user_response,
            turn_number=session.current_turn,
            parsed_cv=cv_profile
        )
    else:
        evaluation = await evaluate_turn_with_ai(
            industry_name=industry["name"],
            npc_name=current_turn_data.get("npc_name", "NPC"),
            question_ja=current_turn_data.get("message_ja", ""),
            user_text=user_response,
            session_type=session.session_type,
            turn_number=session.current_turn
        )
    
    # Save user response & feedback to current turn
    current_turn_data["user_response"] = user_response
    current_turn_data["feedback"] = {
        "corrected_sentence": evaluation["corrected_sentence"],
        "advice_vi": evaluation["advice_vi"],
        "technical_advice_vi": evaluation.get("technical_advice_vi", "")
    }
    current_turn_data["scores"] = {
        "grammar": evaluation.get("grammar_score", evaluation.get("keigo_score", 80)),
        "keigo": evaluation["keigo_score"],
        "manner": evaluation["manner_score"],
        "technical": evaluation.get("technical_score", 80),
        "cv_alignment": evaluation.get("cv_alignment_score", 80)
    }
    current_turn_data["npc_emotion"] = evaluation["npc_reaction"]
    
    # Check if more turns exist
    next_turn_num = session.current_turn + 1
    is_last_turn = next_turn_num > session.max_turns
    
    if not is_last_turn:
        # Prepare next turn
        if is_cv_interview:
            custom_q_list = (session.final_feedback or {}).get("cv_questions", [])
            if next_turn_num - 1 < len(custom_q_list):
                q_info = custom_q_list[next_turn_num - 1]
            else:
                q_info = industry["interview_questions"][min(next_turn_num - 1, len(industry["interview_questions"]) - 1)]
            interviewer = industry["interviewer"]
            next_turn_data = {
                "turn": next_turn_num,
                "speaker": "npc",
                "npc_name": interviewer["name"],
                "npc_title": interviewer["title"],
                "npc_emotion": "neutral",
                "message_ja": q_info["question_ja"],
                "message_vi": q_info["question_vi"],
                "focus": q_info.get("focus", ""),
                "expected_criteria": q_info.get("expected_criteria", ""),
                "hints": q_info.get("hints", []),
                "user_response": None,
                "feedback": None,
                "scores": None
            }
        elif session.session_type == "interview":
            q_info = industry["interview_questions"][next_turn_num - 1]
            interviewer = industry["interviewer"]
            next_turn_data = {
                "turn": next_turn_num,
                "speaker": "npc",
                "npc_name": interviewer["name"],
                "npc_title": interviewer["title"],
                "npc_emotion": "neutral",
                "message_ja": q_info["question_ja"],
                "message_vi": q_info["question_vi"],
                "focus": q_info.get("focus", ""),
                "hints": q_info.get("hints", []),
                "user_response": None,
                "feedback": None,
                "scores": None
            }
        else:
            # workplace scenario
            target_scenario = None
            for sc in industry.get("scenarios", []):
                if sc["id"] == session.scenario_id:
                    target_scenario = sc
                    break
            step_info = target_scenario["turns"][next_turn_num - 1]
            next_turn_data = {
                "turn": next_turn_num,
                "speaker": "npc",
                "npc_name": target_scenario["npc_name"],
                "npc_title": target_scenario["npc_title"],
                "npc_emotion": "neutral",
                "message_ja": step_info["npc_ja"],
                "message_vi": step_info["npc_vi"],
                "focus": target_scenario.get("goal", ""),
                "hints": step_info.get("hints", []),
                "user_response": None,
                "feedback": None,
                "scores": None
            }
        turns_list.append(next_turn_data)
        session.current_turn = next_turn_num
    else:
        # All turns completed! Calculate final scores & generate Offer Letter / Completion Summary
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        
        # Calculate averages across all criteria
        valid_turns = [t for t in turns_list if t.get("scores")]
        grammar_avg = sum(t["scores"].get("grammar", 80) for t in valid_turns) / len(valid_turns)
        keigo_avg = sum(t["scores"].get("keigo", 80) for t in valid_turns) / len(valid_turns)
        manner_avg = sum(t["scores"].get("manner", 80) for t in valid_turns) / len(valid_turns)
        
        has_technical = any("technical" in t["scores"] for t in valid_turns)
        if has_technical:
            technical_avg = sum(t["scores"].get("technical", 80) for t in valid_turns) / len(valid_turns)
            cv_alignment_avg = sum(t["scores"].get("cv_alignment", 80) for t in valid_turns) / len(valid_turns)
            overall_avg = round((technical_avg * 0.4) + (keigo_avg * 0.25) + (manner_avg * 0.2) + (cv_alignment_avg * 0.15), 1)
        else:
            technical_avg = None
            cv_alignment_avg = None
            overall_avg = round((grammar_avg + keigo_avg + manner_avg) / 3, 1)
        
        session.grammar_score = round(grammar_avg, 1)
        session.keigo_score = round(keigo_avg, 1)
        session.manner_score = round(manner_avg, 1)
        session.overall_score = overall_avg
        
        profile = get_or_create_internship_profile(db, user_id)
        
        if session.session_type == "interview":
            profile.total_interviews += 1
            passed = overall_avg >= 60.0
            
            assigned_level = 1
            if overall_avg >= 90:
                assigned_level = 3
            elif overall_avg >= 75:
                assigned_level = 2
                
            scores_breakdown = {
                "grammar": session.grammar_score,
                "keigo": session.keigo_score,
                "manner": session.manner_score,
            }
            if technical_avg is not None:
                scores_breakdown["technical"] = round(technical_avg, 1)
            if cv_alignment_avg is not None:
                scores_breakdown["cv_alignment"] = round(cv_alignment_avg, 1)

            cv_profile = (session.final_feedback or {}).get("cv_profile")
            candidate_display_name = cv_profile.get("candidate_name") if cv_profile else (profile.user.username if profile.user else "Bạn")

            ceo_msg = (
                f"Chúc mừng bạn đã vượt qua kỳ phỏng vấn kỹ thuật gia nhập {industry['company_name']}! "
                "Hội đồng tuyển dụng và CTO đánh giá rất cao nền tảng chuyên môn, năng lực giải quyết vấn đề và tinh thần cầu thị của bạn."
            ) if passed else "Bạn chưa đạt yêu cầu kỳ phỏng vấn này. Hãy trau dồi thêm thuật ngữ kỹ thuật và cấu trúc câu PREP để thử sức lại nhé!"

            offer_data = {
                "passed": passed,
                "company_name": industry["company_name"],
                "company_location": industry["location"],
                "candidate_name": candidate_display_name,
                "assigned_level": assigned_level,
                "assigned_position": f"Kỹ sư {industry['name']} - Cấp {assigned_level}",
                "interviewer_name": industry["interviewer"]["name"],
                "overall_score": overall_avg,
                "scores_breakdown": scores_breakdown,
                "monthly_stipend_exp": 120 * assigned_level,
                "points_reward": 60 if is_cv_interview else 50,
                "hanko_seal_text": "内定",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "ceo_message": ceo_msg,
                "is_cv_interview": is_cv_interview
            }
            session.offer_letter = offer_data
            
            if passed:
                profile.interview_passed = True
                profile.current_industry = session.industry
                profile.current_level = assigned_level
                profile.company_name = industry["company_name"]
                profile.job_title = f"Thực tập sinh {industry['name']} Cấp {assigned_level}"
                profile.exp_points += offer_data["monthly_stipend_exp"]
                
                # Reward points to user profile
                try:
                    award_points(
                        db=db,
                        user_id=user_id,
                        amount=50,
                        reason="Đỗ phỏng vấn thực tập sinh Nhật Bản",
                        ref_type="internship_interview",
                        ref_id=str(session.id),
                        idempotency_key=f"interview_{session.id}"
                    )
                except Exception as r_err:
                    logger.warning("Could not award game points: %s", r_err)
        else:
            # workplace scenario completed
            profile.total_scenarios_completed += 1
            exp_earned = 60 * session.level
            profile.exp_points += exp_earned
            
            # Check level progression:
            # Level 1: 0, Level 2: 150, Level 3: 400, Level 4: 800, Level 5: 1500
            new_lvl = profile.current_level
            if profile.exp_points >= 1500:
                new_lvl = 5
            elif profile.exp_points >= 800:
                new_lvl = 4
            elif profile.exp_points >= 400:
                new_lvl = 3
            elif profile.exp_points >= 150:
                new_lvl = 2
            profile.current_level = max(profile.current_level, new_lvl)
            
            try:
                award_points(
                    db=db,
                    user_id=user_id,
                    amount=25,
                    reason=f"Hoàn thành tình huống công sở cấp {session.level}",
                    ref_type="internship_workplace",
                    ref_id=str(session.id),
                    idempotency_key=f"workplace_{session.id}"
                )
            except Exception as r_err:
                logger.warning("Could not award game points: %s", r_err)

        # Update running averages
        profile.manner_score_avg = round((profile.manner_score_avg + session.manner_score) / 2 if profile.manner_score_avg > 0 else session.manner_score, 1)
        profile.keigo_score_avg = round((profile.keigo_score_avg + session.keigo_score) / 2 if profile.keigo_score_avg > 0 else session.keigo_score, 1)

    session.turns_data = turns_list
    db.commit()
    db.refresh(session)
    
    return format_session_response(session, industry)


def format_session_response(session: InternshipSession, industry: Dict[str, Any], scenario: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "id": str(session.id),
        "session_type": session.session_type,
        "industry": session.industry,
        "industry_name": industry.get("name", ""),
        "company_name": industry.get("company_name", ""),
        "level": session.level,
        "scenario_id": session.scenario_id,
        "scenario_title": scenario.get("title", "Phỏng vấn tuyển dụng") if scenario else "Phỏng vấn tuyển dụng",
        "status": session.status,
        "current_turn": session.current_turn,
        "max_turns": session.max_turns,
        "overall_score": session.overall_score,
        "grammar_score": session.grammar_score,
        "keigo_score": session.keigo_score,
        "manner_score": session.manner_score,
        "turns": session.turns_data,
        "offer_letter": session.offer_letter,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None
    }

