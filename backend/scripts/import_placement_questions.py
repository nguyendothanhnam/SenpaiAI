"""Explicitly load original N5 demonstration questions after Alembic upgrade head."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.services.placement_question_bank import import_demo_n5

if __name__ == "__main__":
    with SessionLocal() as db:
        added = import_demo_n5(db)
        db.commit()
        print(f"Imported {added} demonstration questions. Demo results do not establish a verified profile level.")
