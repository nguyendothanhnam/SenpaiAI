from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Any, List
import json
import pandas as pd

from app.services import game_service

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardCreate(BaseModel):
    cards: List[Flashcard]

router = APIRouter(prefix="/game", tags=["Game"])


def normalize_flashcard_column(column: Any) -> str:
    key = "".join(char.lower() for char in str(column).strip() if char.isalnum())
    return {
        "front": "front",
        "word": "front",
        "japanese": "front",
        "term": "front",
        "back": "back",
        "meaning": "back",
        "meaningvi": "back",
        "vietnamese": "back",
        "definition": "back",
        "jlpt": "jlpt_level",
        "jlptlevel": "jlpt_level",
        "category": "category",
    }.get(key, "")


def parse_flashcard_dataframe(df: pd.DataFrame) -> List[dict]:
    column_map = {}
    for column in df.columns:
        normalized = normalize_flashcard_column(column)
        if normalized and normalized not in column_map:
            column_map[normalized] = column

    if "front" not in column_map or "back" not in column_map:
        raise ValueError("Missing required columns: front, back")

    cards = []
    row_errors = []
    for index, row in df.iterrows():
        row_number = index + 2
        front = clean_cell(row[column_map["front"]])
        back = clean_cell(row[column_map["back"]])
        if not front or not back:
            row_errors.append(f"Row {row_number}: Missing front or back")
            continue

        card = {"front": front, "back": back}
        for optional_column in ("jlpt_level", "category"):
            if optional_column in column_map:
                card[optional_column] = clean_cell(row[column_map[optional_column]])
        cards.append(card)

    if row_errors:
        raise ValueError("; ".join(row_errors))
    if not cards:
        raise ValueError("No valid flashcards found")
    return cards

# ==============================
# 📦 Models
# ==============================

class Question(BaseModel):
    question: str
    options: List[str]
    answer: str

class QuizCreateRequest(BaseModel):
    questions: List[Question]

class AnswerRequest(BaseModel):
    question: str
    selected: str
    correct: str


SUPPORTED_QUIZ_COLUMNS = {
    "question": "question",
    "optiona": "option_a",
    "a": "option_a",
    "optionb": "option_b",
    "b": "option_b",
    "optionc": "option_c",
    "c": "option_c",
    "optiond": "option_d",
    "d": "option_d",
    "correctanswer": "correct_answer",
    "answer": "correct_answer",
    "correct": "correct_answer",
    "explanation": "explanation",
    "jlptlevel": "jlpt_level",
    "jlpt": "jlpt_level",
    "category": "category",
}


def normalize_column_name(column: Any) -> str:
    key = "".join(char.lower() for char in str(column).strip() if char.isalnum())
    return SUPPORTED_QUIZ_COLUMNS.get(key, "")


def clean_cell(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def parse_correct_answer(raw_answer: str, options: List[str]) -> str:
    normalized = raw_answer.strip()
    answer_key = normalized.lower().replace(" ", "").replace("_", "").replace(".", "").replace(")", "")
    option_aliases = {
        "a": "A",
        "optiona": "A",
        "1": "A",
        "b": "B",
        "optionb": "B",
        "2": "B",
        "c": "C",
        "optionc": "C",
        "3": "C",
        "d": "D",
        "optiond": "D",
        "4": "D",
    }

    if answer_key in option_aliases:
        return option_aliases[answer_key]

    prefixed_answer = normalized.upper()
    for key in ("A", "B", "C", "D"):
        if prefixed_answer.startswith(f"{key} ") or prefixed_answer.startswith(f"{key}.") or prefixed_answer.startswith(f"{key})"):
            return key

    for option in options:
        if normalized == option:
            return option

    return ""


def parse_quiz_dataframe(df: pd.DataFrame) -> List[dict]:
    column_map = {}
    for column in df.columns:
        normalized = normalize_column_name(column)
        if normalized and normalized not in column_map:
            column_map[normalized] = column

    required_columns = ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer"]
    missing_columns = [column for column in required_columns if column not in column_map]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    questions = []
    row_errors = []

    for index, row in df.iterrows():
        row_number = index + 2
        question = clean_cell(row[column_map["question"]])
        options = [
            clean_cell(row[column_map["option_a"]]),
            clean_cell(row[column_map["option_b"]]),
            clean_cell(row[column_map["option_c"]]),
            clean_cell(row[column_map["option_d"]]),
        ]
        raw_answer = clean_cell(row[column_map["correct_answer"]])

        errors = []
        if not question:
            errors.append("Missing question")
        if any(not option for option in options):
            errors.append("Missing options")
        answer = parse_correct_answer(raw_answer, options) if raw_answer else ""
        if not answer:
            errors.append("Invalid correct answer")

        if errors:
            row_errors.append(f"Row {row_number}: {', '.join(errors)}")
            continue

        quiz_question = {
            "question": question,
            "options": options,
            "answer": answer,
            "correct_answer": answer,
        }
        for optional_column in ("explanation", "jlpt_level", "category"):
            if optional_column in column_map:
                quiz_question[optional_column] = clean_cell(row[column_map[optional_column]])

        questions.append(quiz_question)

    if row_errors:
        raise ValueError("; ".join(row_errors))
    if not questions:
        raise ValueError("No valid quiz questions found")

    return questions

# ==============================
# 🎯 QUIZ
# ==============================

# 🔹 Lấy quiz (auto generate)
@router.get("/quiz")
def get_quiz():
    return game_service.generate_quiz()


# 🔹 Tạo quiz thủ công (POST JSON)
@router.post("/quiz/create")
def create_quiz(data: QuizCreateRequest):
    return game_service.create_quiz(data.questions)


# 🔹 Upload Excel để tạo quiz
@router.post("/quiz/upload")
def upload_quiz_excel(file: UploadFile = File(...)):
    try:
        df = pd.read_excel(file.file)
        questions = parse_quiz_dataframe(df)
        return {"questions": questions, "file_name": file.filename}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file format: {str(e)}")


# 🔹 Submit answer
@router.post("/quiz/submit")
def submit_answer(data: AnswerRequest):
    is_correct = data.selected == data.correct
    return {
        "correct": is_correct,
        "message": "Correct!" if is_correct else "Wrong!"
    }

# ==============================
# 🃏 FLASHCARD
# ==============================

@router.get("/flashcard")
def get_flashcard():
    data = game_service.get_flashcard()
    # Ensure we always return an array
    if isinstance(data, list):
        return {"cards": data}
    return {"cards": [data]}


@router.post("/flashcard/create")
def create_flashcard(data: FlashcardCreate):
    result = game_service.create_flashcard(data.cards)
    return {"message": result.get("message", "Flashcards created"), "cards": data.cards}


@router.post("/flashcard/import")
def import_flashcard_set(file: UploadFile = File(...)):
    try:
        filename = file.filename or ""
        lower_name = filename.lower()
        if lower_name.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif lower_name.endswith(".json"):
            raw = json.load(file.file)
            rows = raw.get("cards", raw) if isinstance(raw, dict) else raw
            df = pd.DataFrame(rows)
        else:
            df = pd.read_excel(file.file)

        cards = parse_flashcard_dataframe(df)
        return {"cards": cards, "file_name": filename}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid flashcard file: {str(e)}")
