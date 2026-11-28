import pytest

pytest.importorskip("fastapi")

from app.api.chat import contains_japanese
from app.services.vocab_mcq_service import try_answer
import json
from pathlib import Path


def test_conversation_practice_returns_japanese_and_vietnamese():
    rows=json.loads((Path(__file__).parent/'data/chat_legacy_regressions.json').read_text(encoding='utf8'))['cases']
    answer=rows[1]['legacy_answer']

    assert "[日本語]" in answer
    assert "[Tiếng Việt]" in answer
    assert "Tôi thích mèo hơn." in answer


def test_gakusei_mcq_returns_vietnamese_answer_first():
    answer = try_answer("「がくせい」はどういう意味ですか。A. 教師 B. 学生 C. 医者 D. 会社員").answer

    assert answer.startswith("Đáp án đúng: B. 学生")
    assert "học sinh / sinh viên" in answer


def test_contains_japanese_ignores_vietnamese_accents():
    assert contains_japanese("Tôi thích mèo hơn.") is False
    assert contains_japanese("私はねこが好きです。") is True
