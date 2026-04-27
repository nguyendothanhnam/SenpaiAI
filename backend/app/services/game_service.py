import random

# =========================
# 🧠 STORAGE (tạm)
# =========================
USER_QUIZ = []
USER_FLASHCARD = []

# =========================
# 🎯 QUIZ
# =========================

def generate_quiz():
    if USER_QUIZ:
        return {"questions": USER_QUIZ}

    # fallback demo
    return {
        "questions": [
            {
                "question": "猫 nghĩa là gì?",
                "options": ["Chó", "Mèo", "Cá", "Chim"],
                "answer": "Mèo"
            }
        ]
    }

def create_quiz(questions):
    global USER_QUIZ
    USER_QUIZ = questions
    return {"message": "Quiz created"}

# =========================
# 🃏 FLASHCARD
# =========================

def get_flashcard():
    if USER_FLASHCARD:
        return random.choice(USER_FLASHCARD)

    return {
        "front": "犬",
        "back": "chó"
    }

def create_flashcard(cards):
    global USER_FLASHCARD
    USER_FLASHCARD = cards
    return {"message": "Flashcard created"}