import json

import pytest

from app.services.grammar_practice_service import (
    GeneratedQuestion,
    grade_answer,
    is_duplicate_question,
    parse_generated_questions,
)


@pytest.mark.parametrize(
    "kind,answer,correct,accepted,expected",
    [
        ("fill_blank", "は", "は", None, True),
        ("fill_blank", "が", "は", ["も"], False),
        ("reorder", ["私は", "学生", "です。"], "私は学生です。", None, True),
        ("reorder", ["学生", "私は", "です。"], "私は学生です。", None, False),
        ("true_false", True, True, None, True),
        ("true_false", 1, True, None, False),
        ("conjugation", "ｶﾞｸｾｲ", "がくせい", None, True),
        ("conjugation", "カキマス", "かきます", ["書きます"], True),
        ("conjugation", "たべます", "食べます", None, False),
    ],
)
def test_grade_answer(kind, answer, correct, accepted, expected):
    assert grade_answer(kind, answer, correct, accepted) is expected


@pytest.mark.parametrize(
    "item",
    [
        {
            "question_type": "fill_blank", "prompt": "私は____学生です。",
            "payload": {"options": ["は", "が", "を", "に"]}, "correct_answer": "は",
            "explanation_vi": "は đánh dấu chủ đề.",
        },
        {
            "question_type": "reorder", "prompt": "Sắp xếp câu.",
            "payload": {"tokens": ["私", "は", "学生", "です。"]}, "correct_answer": "私は学生です。",
            "explanation_vi": "Ghép theo trật tự câu tiếng Nhật.",
        },
        {
            "question_type": "true_false", "prompt": "Nhận định.",
            "payload": {"statement": "私は学生です。"}, "correct_answer": True,
            "explanation_vi": "Nhận định đúng vì 私 là chủ đề.",
        },
        {
            "question_type": "conjugation", "prompt": "Đổi sang thể ます.",
            "payload": {"base_form": "書く", "target_form": "thể ます"}, "correct_answer": "書きます",
            "explanation_vi": "書く đổi thành 書きます.",
        },
    ],
)
def test_generated_question_accepts_each_type(item):
    question = GeneratedQuestion.model_validate({"jlpt_level": "N5", **item})
    assert question.question_type == item["question_type"]


@pytest.mark.parametrize(
    "item",
    [
        {"question_type": "fill_blank", "prompt": "私は____学生です。____", "payload": {"options": ["は", "は", "を", "に"]}, "correct_answer": "は", "explanation_vi": "Giải thích."},
        {"question_type": "fill_blank", "prompt": "私は学生です。", "payload": {"options": ["は", "が", "を", "に"]}, "correct_answer": "は", "explanation_vi": "Giải thích."},
        {"question_type": "reorder", "prompt": "Sắp xếp.", "payload": {"tokens": ["私", "は", "学生"]}, "correct_answer": "私は学生", "explanation_vi": "Giải thích."},
        {"question_type": "reorder", "prompt": "Sắp xếp.", "payload": {"tokens": ["私", "は", "学生", "です。"]}, "correct_answer": "私学生です。", "explanation_vi": "Giải thích."},
        {"question_type": "true_false", "prompt": "Nhận định.", "payload": {}, "correct_answer": "true", "explanation_vi": "Giải thích."},
        {"question_type": "conjugation", "prompt": "Đổi thể.", "payload": {"base_form": "書く"}, "correct_answer": "書きます", "explanation_vi": "Giải thích."},
    ],
)
def test_generated_question_rejects_invalid_type_payloads(item):
    with pytest.raises(ValueError):
        GeneratedQuestion.model_validate({"jlpt_level": "N5", **item})


def test_parse_generated_json_validates_each_question_independently():
    raw = "```json\n" + json.dumps({"questions": [
        {"question_type": "true_false", "prompt": "Mệnh đề.", "payload": {"statement": "私は学生です。"}, "correct_answer": True, "explanation_vi": "Đúng theo cấu trúc."},
        {"question_type": "fill_blank", "prompt": "Không có chỗ trống", "payload": {"options": ["a", "b", "c", "d"]}, "correct_answer": "a", "explanation_vi": "Không hợp lệ."},
    ]}, ensure_ascii=False) + "\n```"
    valid, rejected = parse_generated_questions(raw, "N5", "true_false")
    assert len(valid) == 1
    assert rejected == 1


def test_parse_generated_json_rejects_malformed_json():
    valid, rejected = parse_generated_questions("not json", "N5", "fill_blank")
    assert valid == []
    assert rejected == 1


def test_duplicate_detection_normalizes_whitespace_and_case():
    assert is_duplicate_question("  What   is this? ", "fill_blank", [("what is this?", "fill_blank")])
    assert not is_duplicate_question("What is this?", "reorder", [("What is this?", "fill_blank")])
