USER_QUIZ = []
USER_FLASHCARD = []


def generate_quiz():
    return {
        "source": "generated",
        "questions": [
            {
                "question": "猫 nghĩa là gì?",
                "options": ["Chó", "Mèo", "Cá", "Chim"],
                "answer": "Mèo",
            }
        ],
    }


def create_quiz(questions):
    global USER_QUIZ
    USER_QUIZ = questions if isinstance(questions, list) else [questions]
    return {
        "message": "Quiz created",
        "count": len(USER_QUIZ),
        "questions": USER_QUIZ,
        "source": "user_created",
    }


def get_flashcard():
    if USER_FLASHCARD:
        return USER_FLASHCARD

    return [
        {
            "front": "犬",
            "back": "chó",
        },
        {
            "front": "猫",
            "back": "mèo",
        },
        {
            "front": "木",
            "back": "cây",
        },
    ]


def create_flashcard(cards):
    global USER_FLASHCARD
    if isinstance(cards, list):
        USER_FLASHCARD.extend(cards)
    else:
        USER_FLASHCARD.append(cards)
    return {"message": "Flashcard created", "count": len(USER_FLASHCARD)}
