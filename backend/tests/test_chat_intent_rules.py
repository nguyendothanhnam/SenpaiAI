import pytest

pytest.importorskip("fastapi")

from app.api.chat import contains_japanese, deterministic_chat_answer


def test_conversation_practice_returns_japanese_and_vietnamese():
    answer = deterministic_chat_answer("「ねこ」と「いぬ」、どちらが好きですか。理由も教えてください。")

    assert "[日本語]" in answer
    assert "[Tiếng Việt]" in answer
    assert "Tôi thích mèo hơn." in answer


def test_gakusei_mcq_returns_vietnamese_answer_first():
    answer = deterministic_chat_answer("「がくせい」はどういう意味ですか。A. 教師 B. 学生 C. 医者 D. 会社員")

    assert answer.startswith("Đáp án đúng: B. 学生")
    assert "học sinh / sinh viên" in answer


def test_contains_japanese_ignores_vietnamese_accents():
    assert contains_japanese("Tôi thích mèo hơn.") is False
    assert contains_japanese("私はねこが好きです。") is True
