import pytest

pandas = pytest.importorskip("pandas")
pd = pandas

from app.api.game import parse_flashcard_dataframe


def test_flashcard_import_accepts_common_columns():
    df = pd.DataFrame([
        {
            "Front": "犬",
            "Back": "chó",
            "JLPT Level": "N5",
            "Category": "animals",
        }
    ])

    assert parse_flashcard_dataframe(df) == [
        {"front": "犬", "back": "chó", "jlpt_level": "N5", "category": "animals"}
    ]


def test_flashcard_import_requires_front_and_back():
    df = pd.DataFrame([{"front": "犬", "category": "animals"}])

    with pytest.raises(ValueError) as error:
        parse_flashcard_dataframe(df)

    assert "Missing required columns: front, back" in str(error.value)
