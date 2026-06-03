import pytest

pandas = pytest.importorskip("pandas")
pd = pandas

from app.api.game import parse_quiz_dataframe


def test_quiz_import_accepts_case_and_header_variants():
    df = pd.DataFrame([
        {
            "Question": "猫 nghĩa là gì?",
            "Option A": "Chó",
            "Option B": "Mèo",
            "Option C": "Cá",
            "Option D": "Chim",
            "Correct Answer": "B",
            "Explanation": "猫 là mèo.",
            "JLPT Level": "N5",
            "Category": "vocabulary",
        }
    ])

    questions = parse_quiz_dataframe(df)

    assert questions == [
        {
            "question": "猫 nghĩa là gì?",
            "options": ["Chó", "Mèo", "Cá", "Chim"],
            "answer": "B",
            "correct_answer": "B",
            "explanation": "猫 là mèo.",
            "jlpt_level": "N5",
            "category": "vocabulary",
        }
    ]


def test_quiz_import_reports_row_validation_errors():
    df = pd.DataFrame([
        {
            "question": "",
            "option_a": "Chó",
            "option_b": "",
            "option_c": "Cá",
            "option_d": "Chim",
            "correctAnswer": "Z",
        }
    ])

    with pytest.raises(ValueError) as error:
        parse_quiz_dataframe(df)

    message = str(error.value)
    assert "Row 2" in message
    assert "Missing question" in message
    assert "Missing options" in message
    assert "Invalid correct answer" in message


def test_quiz_import_extracts_letter_from_prefixed_answer():
    df = pd.DataFrame([
        {
            "question": "When?",
            "option_a": "before eating",
            "option_b": "after eating",
            "option_c": "at school",
            "option_d": "tomorrow",
            "correct_answer": "A. before eating",
        }
    ])

    questions = parse_quiz_dataframe(df)

    assert questions[0]["correct_answer"] == "A"
