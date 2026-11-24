"""Server-owned question snapshots and bounded adaptive placement, independent of clients."""
import random
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from ..core.config import settings
from ..models.database import GrammarQuestion, ListeningLesson, PlacementAttempt, Vocabulary
from .grammar_practice_service import grade_answer, public_question
from .kanji_dictionary_service import kanji_dictionary_service
from .vocab_mcq_service import VOCABULARY

LEVELS = ("N5", "N4", "N3", "N2", "N1")
SKILLS = ("grammar", "vocab", "kanji")
MIN_QUESTIONS, MAX_QUESTIONS = 20, 30


def build_bank(db, language):
    bank = []
    for question in db.query(GrammarQuestion).filter(GrammarQuestion.is_active.is_(True)).all():
        public = public_question(question)
        if question.question_type == "fill_blank" and question.correct_answer not in public.get("options", []):
            continue
        bank.append(dict(key=f"grammar:{question.id}", skill="grammar", level=question.jlpt_level,
                         public=public, answer=question.correct_answer, accepted=question.accepted_answers))
    # Reuse the existing vocabulary bank, supplementing database entries with the MCQ service.
    vocab = {}
    for entry in VOCABULARY.values():
        meanings = entry.en if language == "en" else entry.vi
        if meanings:
            vocab[(entry.jlpt, entry.kanji or entry.kana)] = (entry.kana, meanings[0], language)
    for entry in db.query(Vocabulary).all():
        if entry.meaning:
            vocab.setdefault((entry.jlpt_level, entry.japanese_word), (entry.reading, entry.meaning, "bank"))
    for (level, word), (reading, meaning, cohort) in vocab.items():
        # Keep translated MCQ definitions together; mixing translated and original
        # definitions in one option set could reveal the answer by language alone.
        alternatives = list({value[1] for key, value in vocab.items()
                             if key[0] == level and value[1] != meaning and value[2] == cohort})
        if len(alternatives) < 3:
            continue
        options = [meaning, *random.sample(sorted(alternatives), 3)]
        random.shuffle(options)
        bank.append(dict(key=f"vocab:{level}:{word}", skill="vocab", level=level,
                         public=dict(question_type="mcq", prompt_key="vocabPrompt", prompt=f"{word} ({reading or ''})", options=options),
                         answer=meaning))
    for level in LEVELS:
        for question in kanji_dictionary_service.quiz(mode="reading_match", jlpt=level, count=10000):
            if len(set(question["options"])) < 4:
                continue
            kanji = question["kanji"]["kanji"]
            bank.append(dict(key=f"kanji:{kanji}", skill="kanji", level=level,
                             public=dict(question_type="mcq", prompt_key="kanjiPrompt", prompt=kanji, options=question["options"]),
                             answer=question["correct_answer"]))
    # Include listening only with existing audio, verified segment boundaries and published seed content.
    media_root = Path(settings.listening_media_dir).resolve()
    for lesson in db.query(ListeningLesson).filter(ListeningLesson.is_published.is_(True), ListeningLesson.source != "library",
                                                  ListeningLesson.source_document_id.is_(None)).all():
        audio = (media_root / lesson.audio_path).resolve() if lesson.audio_path else None
        if not audio or not audio.is_relative_to(media_root) or not audio.is_file():
            continue
        for index, segment in enumerate(lesson.segments or []):
            start, end = segment.get("start_ms"), segment.get("end_ms")
            if not segment.get("ja") or not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not 0 <= start < end:
                continue
            bank.append(dict(key=f"listening:{lesson.id}:{index}", skill="listening", level=lesson.jlpt_level,
                             public=dict(question_type="listening", prompt_key="listeningPrompt", prompt="",
                                         lesson_id=lesson.id, start_ms=start, end_ms=end), answer=segment["ja"]))
    return bank


def supported_levels(bank):
    """Require all core skills and enough distinct questions; do not bridge missing levels."""
    result = []
    for level in LEVELS:
        counts = Counter(item["skill"] for item in bank if item["level"] == level)
        if counts["grammar"] < 6 or counts["vocab"] < 4 or counts["kanji"] < 6 or sum(counts.values()) < MIN_QUESTIONS:
            break
        result.append(level)
    return result


def choose_next(attempt, seen=()):
    used = set(attempt.questions)
    pool = [item for item in attempt.bank if item["key"] not in used]
    if not pool:
        return None
    counts = Counter(item["skill"] for item in attempt.bank if item["key"] in used)
    skills = set(item["skill"] for item in pool)
    skill = min(sorted(skills), key=lambda value: counts[value])
    pool = [item for item in pool if item["skill"] == skill]
    # Prefer the adaptive level; within that level, prefer never encountered sources.
    random.shuffle(pool)
    return min(pool, key=lambda item: (abs(LEVELS.index(item["level"]) - LEVELS.index(attempt.target_level)), item["key"] in seen))


def seen_keys(db, user_id):
    return {key for (questions,) in db.query(PlacementAttempt.questions).filter(PlacementAttempt.user_id == user_id).all()
            for key in questions}


def start_attempt(db, user, language):
    # Lock the owner too: prevent concurrent starts from creating multiple active attempts.
    from ..models.database import User
    db.query(User).filter(User.id == user.id).with_for_update().one()
    active = db.query(PlacementAttempt).filter_by(user_id=user.id, status="in_progress").first()
    if active:
        return active
    bank = build_bank(db, language)
    levels = supported_levels(bank)
    if not levels:
        raise HTTPException(409, "placement_insufficient_data")
    attempt = PlacementAttempt(user_id=user.id, language=language, bank=[item for item in bank if item["level"] in levels],
                               questions=[], answers=[], available_levels=levels, target_level="N5", status="in_progress")
    first = choose_next(attempt, seen_keys(db, user.id))
    attempt.questions = [first["key"]]
    db.add(attempt)
    db.flush()
    return attempt


def estimate(attempt):
    items = {item["key"]: item for item in attempt.bank}
    skill_scores = {}
    evidence = {}
    for skill in (*SKILLS, "listening"):
        answers = [answer for answer in attempt.answers if items[answer["key"]]["skill"] == skill]
        correct = sum(answer["correct"] for answer in answers)
        skill_scores[skill] = dict(total=len(answers), correct=correct, score=round(100 * correct / len(answers)) if answers else None)
    recommended = "N5"
    for level in attempt.available_levels:
        evidence[level] = {}
        for skill in SKILLS:
            answers = [answer for answer in attempt.answers if items[answer["key"]]["level"] == level and items[answer["key"]]["skill"] == skill]
            evidence[level][skill] = dict(total=len(answers), correct=sum(answer["correct"] for answer in answers))
        if all(value["total"] >= 2 and value["correct"] / value["total"] >= .7 for value in evidence[level].values()):
            recommended = level
    tested = [level for level in attempt.available_levels if any(items[answer["key"]]["level"] == level for answer in attempt.answers)]
    scores = {skill: value["score"] for skill, value in skill_scores.items() if value["score"] is not None}
    weak = [skill for skill, score in scores.items() if score < 60]
    strong = [skill for skill, score in scores.items() if score >= 80]
    return dict(recommended_level=recommended, estimated_up_to=tested[-1] if tested else "N5",
                data_ceiling=attempt.available_levels[-1], skill_scores=skill_scores, evidence=evidence,
                strengths=strong, weaknesses=weak, focus_skills=weak or sorted(scores, key=scores.get)[:1],
                foundation_needed=all(value["score"] is None or value["score"] < 60 for value in skill_scores.values()),
                is_estimate=True)


def answer_question(db, attempt, question_key, answer):
    # Retry of a previously accepted answer returns current progress without advancing again.
    previous = next((entry for entry in attempt.answers if entry["key"] == question_key), None)
    if previous:
        if previous["answer"] != answer or type(previous["answer"]) is not type(answer):
            raise HTTPException(409, "placement_answer_conflict")
        return attempt
    if attempt.status != "in_progress" or question_key != attempt.questions[-1]:
        raise HTTPException(409, "placement_question_changed")
    question = next(item for item in attempt.bank if item["key"] == question_key)
    kind = question["public"]["question_type"]
    if kind in {"mcq", "fill_blank"} and answer not in question["public"].get("options", []):
        raise HTTPException(422, "placement_invalid_answer")
    if kind == "true_false" and not isinstance(answer, bool):
        raise HTTPException(422, "placement_invalid_answer")
    if kind == "reorder" and (not isinstance(answer, list) or Counter(answer) != Counter(question["public"].get("tokens", []))):
        raise HTTPException(422, "placement_invalid_answer")
    if kind in {"conjugation", "listening"} and (not isinstance(answer, str) or not answer.strip()):
        raise HTTPException(422, "placement_invalid_answer")
    if kind == "listening":
        from .listening_exercises import answer_matches
        correct = answer_matches(answer, question["answer"])
    else:
        correct = (answer == question["answer"]) if kind == "mcq" else grade_answer(kind, answer, question["answer"], question.get("accepted"))
    attempt.answers = [*attempt.answers, dict(key=question_key, answer=answer, correct=correct)]
    rank = attempt.available_levels.index(question["level"])
    attempt.target_level = attempt.available_levels[max(0, min(len(attempt.available_levels) - 1, rank + (1 if correct else -1)))]
    result = estimate(attempt)
    # At least 20 responses, >=4 per core skill and >=6 at the measured ceiling.
    ceiling = result["evidence"].get(result["estimated_up_to"], {})
    confident = (all(result["skill_scores"][skill]["total"] >= 4 for skill in SKILLS)
                 and all(value["total"] >= 2 for value in ceiling.values())
                 and all(value["score"] <= 30 or value["score"] >= 80 for value in result["skill_scores"].values() if value["score"] is not None))
    next_item = choose_next(attempt, seen_keys(db, attempt.user_id))
    count = len(attempt.answers)
    if count >= MAX_QUESTIONS or (count >= MIN_QUESTIONS and confident) or next_item is None:
        attempt.status = "completed"
        attempt.completed_at = datetime.now(timezone.utc)
        attempt.result = {**result, "stop_reason": "confidence" if count >= MIN_QUESTIONS and confident else "limit" if count >= MAX_QUESTIONS else "exhausted"}
        attempt.skill_scores = result["skill_scores"]
        attempt.recommended_level = result["recommended_level"]
    else:
        attempt.questions = [*attempt.questions, next_item["key"]]
    db.flush()
    return attempt


def public_attempt(attempt):
    question = None
    if attempt.status == "in_progress":
        item = next(item for item in attempt.bank if item["key"] == attempt.questions[-1])
        question = {**item["public"], "key": item["key"], "skill": item["skill"], "level": item["level"]}
    return dict(id=attempt.id, status=attempt.status, language=attempt.language, answered_count=len(attempt.answers),
                min_questions=MIN_QUESTIONS, max_questions=MAX_QUESTIONS, available_levels=attempt.available_levels,
                question=question, result=attempt.result, created_at=attempt.created_at,
                completed_at=attempt.completed_at, confirmed_at=attempt.confirmed_at)
