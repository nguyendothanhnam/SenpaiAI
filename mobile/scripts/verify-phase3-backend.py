"""Exercise existing backend routers in-process against isolated SQLite only.

No listening server, production DB, external AI request or backend edit.
Run with backend/venv/Scripts/python.exe from the repository root.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api import auth, grammar_practice, kanji, rewards
from app.core.auth import get_current_active_user
from app.core.database import Base, get_db
from app.models.database import GrammarQuestion, GrammarRule, LearningSession, User, UserGameProfile

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
@event.listens_for(engine, "connect")
def sqlite_functions(connection, _record):
    connection.create_function("char_length", 1, len, deterministic=True)

Base.metadata.create_all(engine)
sessions = sessionmaker(bind=engine, expire_on_commit=False)
db = sessions()
user = User(email="phase3@example.com", username="phase3_contract", hashed_password="not-a-real-password", ui_language="vi")
rule = GrammarRule(rule_name="Test pattern", japanese_pattern="test", meaning="fixture", jlpt_level="N5")
db.add_all([user, rule]); db.commit()
user_id, rule_id = user.id, rule.id
for n in range(5):
    db.add(GrammarQuestion(grammar_rule_id=rule_id, jlpt_level="N5", question_type="fill_blank", prompt=f"fixture {n} ____", payload={"options": ["a", "b", "c", "d"]}, correct_answer="a", explanation_vi="fixture explanation", examples=[], source="manual"))
db.commit(); db.close()

app = FastAPI()
for router in [auth.router, grammar_practice.router, kanji.router, rewards.router]:
    app.include_router(router)
    app.include_router(router, prefix="/api")

def isolated_db():
    session = sessions()
    try:
        yield session
    finally:
        session.close()

def isolated_user():
    with sessions() as session:
        return session.get(User, user_id)

app.dependency_overrides[get_db] = isolated_db
app.dependency_overrides[get_current_active_user] = isolated_user
original_ai = grammar_practice._ai_questions

async def unavailable_ai(*_args, **_kwargs):
    return {"requested": 5, "saved": 0, "rejected": 5, "error": "fixture provider unavailable"}

grammar_practice._ai_questions = unavailable_ai
try:
    with TestClient(app) as client:
        for prefix in ["", "/api"]:
            assert client.get(prefix + "/grammar-practice/patterns?jlpt_level=N5").status_code == 200
            generated = client.post(prefix + "/grammar-practice/generate", json={"jlpt_level": "N5", "grammar_rule_id": rule_id, "question_type": "fill_blank", "count": 5})
            assert generated.status_code == 200 and generated.json()["saved"] == 0
            failed = client.post(prefix + "/grammar-practice/sessions", json={"jlpt_level": "N5", "question_types": ["fill_blank"], "count": 5, "mode": "ai"})
            assert failed.status_code == 404
            assert failed.json()["detail"] != "Not Found", "Business 404 must be distinguished from missing route"
        print("PASS dual grammar routes; unavailable AI returns a business 404, not a missing route")
        bank = client.post("/api/grammar-practice/sessions", json={"jlpt_level": "N5", "question_types": ["fill_blank"], "count": 5, "mode": "bank"})
        assert bank.status_code == 200 and len(bank.json()["questions"]) == 5
        assert client.post("/api/grammar-practice/sessions", json={"jlpt_level": "N5", "question_types": ["fill_blank"], "count": 5, "mode": "mixed"}).status_code == 200
        with sessions() as session:
            assert session.query(LearningSession).count() == 2, "Failed AI must not create a practice session"
        print("PASS bank/mixed remain available without AI; failed AI preserves sessions")
        for level in ["N5", "N4", "N3"]:
            page = client.get(f"/api/kanji/list?jlpt={level}&limit=2").json()
            assert len(page["items"]) == 2 and page["total"] > 0
            char = page["items"][0]["kanji"]
            assert client.get(f"/api/kanji/{char}").status_code == 200
            assert client.get(f"/api/kanji/{char}/stroke-order").json()["available"]
        assert client.get("/api/kanji/\U0001f642/stroke-order").json()["available"] is False
        for mode in ["meaning_match", "reading_match", "kanji_match"]:
            items = client.get(f"/api/kanji/quiz?mode={mode}&jlpt=N5&count=5").json()["items"]
            assert len(items) == 5 and all(q["correct_answer"] in q["options"] for q in items)
        print("PASS kanji levels/paging/detail/strokes/unavailable strokes and all quiz modes")
        denied = client.put("/api/auth/me", json={"current_jlpt_level": "N4"})
        assert denied.status_code == 403 and denied.json()["detail"] == "jlpt_level_requires_placement"
        update = client.put("/api/auth/me", json={"username": "phase3_updated", "learning_goals": ["JLPT N3"], "ui_language": "en"})
        assert update.status_code == 200 and update.json()["learning_goals"] == ["JLPT N3"]
        profile = client.get("/api/rewards/me").json()
        with sessions() as session:
            stored = session.query(UserGameProfile).filter(UserGameProfile.user_id == user_id).one()
            stored.points_balance = 37
            session.commit()
        profile = client.get("/api/rewards/me").json()
        catalog = client.get("/api/rewards/shop").json()
        assert any(t["id"] == "classic" and t["owned"] for t in catalog["themes"])
        assert client.put("/api/rewards/equip", json={"theme_id": "classic"}).status_code == 200
        assert client.put("/api/rewards/equip", json={"theme_id": "sakura"}).status_code == 409
        export = client.get("/api/auth/me/export")
        assert export.status_code == 200 and export.json()["user_profile"]["username"] == "phase3_updated"
        assert "hashed_password" not in export.text
        reset = client.post("/api/auth/me/reset-progress")
        assert reset.status_code == 200 and "daily_tasks" in reset.json()["preserved_items"]
        assert client.get("/api/rewards/me").json()["points_balance"] == profile["points_balance"]
        assert client.delete("/api/auth/me").status_code == 204
        with sessions() as session:
            assert session.query(User).count() == 0
            assert session.query(UserGameProfile).count() == 0
        print("PASS profile/language/learning goals, owned theme rights, export, reset preservation and deletion")
finally:
    grammar_practice._ai_questions = original_ai
    engine.dispose()
print("Isolated contract verification complete. No running backend or production data was changed.")
