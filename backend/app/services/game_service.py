
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
    # Merge: append to existing instead of overwriting
    if isinstance(questions, list):
        USER_QUIZ.extend(questions)
    else:
        USER_QUIZ.append(questions)
    return {"message": "Quiz created", "count": len(USER_QUIZ), "questions": USER_QUIZ}

# =========================
# 🃏 FLASHCARD
# =========================

def get_flashcard():
    if USER_FLASHCARD:
        # Return all flashcards as a list
        return USER_FLASHCARD

    # Return demo data as a list
    return [
        {
            "front": "犬",
            "back": "chó"
        },
        {
            "front": "猫",
            "back": "mèo"
        },
        {
            "front": "木",
            "back": "cây"
        }
    ]

def create_flashcard(cards):
    global USER_FLASHCARD
    # Store as list, merge with existing
    if isinstance(cards, list):
        USER_FLASHCARD.extend(cards)
    else:
        USER_FLASHCARD.append(cards)
    return {"message": "Flashcard created", "count": len(USER_FLASHCARD)}
