"""Question-bank adapter; selection policy does not know grammar ORM/public payloads."""
from sqlalchemy.orm import joinedload
from sqlalchemy import text
from ..models.database import GrammarQuestion
from .exercise_content import grammar_content
from .exercise_selection import Candidate


def lock_question_bank(db):
    """Serialize reviewed/AI imports across users on PostgreSQL, in the caller's transaction."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": 7365201601})


def grammar_candidate(question):
    return Candidate("grammar", str(question.id), question.jlpt_level, "grammar", question.question_type,
                     grammar_content(question), pattern=f"grammar:{question.grammar_rule_id}" if question.grammar_rule_id else "",
                     category="grammar", value=question)


def load_candidates(db, skill, constraints):
    if skill not in (None, "grammar"):
        raise ValueError("Supply a candidate adapter for this skill")
    query = db.query(GrammarQuestion).options(joinedload(GrammarQuestion.grammar_rule)).filter(GrammarQuestion.is_active.is_(True))
    if constraints.get("question_types"):
        query = query.filter(GrammarQuestion.question_type.in_(constraints["question_types"]))
    if constraints.get("grammar_rule_id") is not None:
        query = query.filter(GrammarQuestion.grammar_rule_id == constraints["grammar_rule_id"])
    if constraints.get("question_ids") is not None:
        query = query.filter(GrammarQuestion.id.in_(constraints["question_ids"]))
    if constraints.get("ai_user_id") is not None:
        query = query.filter(GrammarQuestion.source == "ai", GrammarQuestion.created_by_user_id == constraints["ai_user_id"])
    return [grammar_candidate(question) for question in query.order_by(GrammarQuestion.id).all()]
