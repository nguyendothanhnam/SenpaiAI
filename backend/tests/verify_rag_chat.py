import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import asyncio
from app.core.database import SessionLocal
from app.models.database import User, Document
from app.models.schemas import ChatMessage
from app.api.chat import send_message
from app.services.vector_db import chroma_service

async def run_tests():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No user in DB, skipping chat API test")
            return

        print(f"Testing with User: {user.email} (JLPT: {user.current_jlpt_level})")

        queries = [
            ("Cách dùng ngữ pháp 〜てはいけない và ví dụ", "N5"),
            ("Ý nghĩa chữ Kanji 日 và số nét", "N5"),
            ("Mẫu hội thoại chào hỏi ngày đầu đi làm", "N5")
        ]

        for query, level in queries:
            print(f"\n=======================================================")
            print(f"HỎI: {query} (Filter Level: {level})")
            print(f"=======================================================")
            msg = ChatMessage(message=query, jlpt_level=level, response_language="vi")
            res = await send_message(message=msg, current_user=user, db=db)
            print(f"\n[AI TRẢ LỜI]:\n{res.answer[:400]}...")
            print(f"\n[NGUỒN THAM KHẢO DẪN RA]:")
            for s in res.sources or []:
                print(f" - [{s.get('type')}|{s.get('jlpt_level')}] {s.get('title')} (Độ khớp: {s.get('relevance')}) -> URL: {s.get('url')}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_tests())

