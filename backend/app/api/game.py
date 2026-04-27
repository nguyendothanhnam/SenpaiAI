from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd

from app.services import game_service

from typing import List
from pydantic import BaseModel

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardCreate(BaseModel):
    cards: List[Flashcard]

router = APIRouter(prefix="/game", tags=["Game"])

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
    return {
        "questions": data.questions
    }


# 🔹 Upload Excel để tạo quiz
@router.post("/quiz/upload")
def upload_quiz_excel(file: UploadFile = File(...)):
    try:
        df = pd.read_excel(file.file)

        questions = []
        for _, row in df.iterrows():
            questions.append({
                "question": row["question"],
                "options": [row["A"], row["B"], row["C"], row["D"]],
                "answer": row["answer"]
            })

        return {"questions": questions}

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
    return game_service.get_flashcard()

@router.post("/quiz/create")
def create_quiz(data: QuizCreateRequest):
    return game_service.create_quiz(data.questions)


@router.post("/flashcard/create")
def create_flashcard(data: FlashcardCreate):
    return game_service.create_flashcard(data.cards)