"""Build and grade exercises from the published transcript, without LLM answers."""
from functools import lru_cache
from hashlib import sha256
import json
import random
import re
import unicodedata

from .audio_service import furigana_tokens

MODES = ('dictation', 'cloze', 'comprehension')


def normalize_answer(text: str) -> str:
    text = unicodedata.normalize('NFKC', text).strip()
    # Keep meaningful characters such as the long-vowel mark ー and small kana.
    return ''.join(chr(ord(char) - 0x60) if '\u30a1' <= char <= '\u30f6' else char
                   for char in text if not char.isspace() and not unicodedata.category(char).startswith('P'))


@lru_cache(maxsize=2048)
def kana_reading(text: str) -> str:
    try:
        return normalize_answer(''.join(token.get('reading') or token['text'] for token in furigana_tokens(text)))
    except RuntimeError:
        return ''


def answer_matches(answer: str, expected: str) -> bool:
    actual = normalize_answer(answer)
    target = normalize_answer(expected)
    if not actual or not target:
        return False
    if actual == target:
        return True
    # Kana transcriptions are valid listening answers. An incorrect kanji with
    # the same pronunciation is not silently accepted as the expected spelling.
    if re.search(r'[\u3400-\u9fff]', actual):
        return False
    return actual == kana_reading(expected)


def cloze_span(text: str, seed: str) -> tuple[str, str, str]:
    candidates = []
    try:
        cursor = 0
        for token in furigana_tokens(text):
            word = token['text']
            start = text.find(word, cursor)
            if start < 0:
                continue
            cursor = start + len(word)
            if re.search(r'[\u3040-\u30ff\u3400-\u9fff]', word) and (len(word) >= 2 or re.search(r'[\u3400-\u9fff]', word)):
                candidates.append((start, word))
    except RuntimeError:
        pass
    # Prefer a word over a whole kana-only sentence when tokenization has no
    # boundary. The suffixes are exact excerpts, never generated alternatives.
    shorter = [(start, word) for start, word in candidates if normalize_answer(word) != normalize_answer(text)]
    if not shorter:
        shorter = [(match.start(), match.group()) for match in re.finditer(r'ございます|ください|ましょう|ました|ません|です|ます', text)]
    pool = shorter or candidates
    if pool:
        start, word = pool[int(sha256(seed.encode()).hexdigest()[:8], 16) % len(pool)]
    else:
        match = re.search(r'[\u3040-\u30ff\u3400-\u9fff]+', text)
        start, word = (match.start(), match.group()) if match else (0, text)
    return text[:start], word, text[start + len(word):]


def build_exercises(lesson_id: int, segments: list[dict]) -> tuple[str, list[dict]]:
    valid = [(index, str(segment['ja']).strip()) for index, segment in enumerate(segments)
             if isinstance(segment, dict) and isinstance(segment.get('ja'), str)
             and re.search(r'[\u3040-\u30ff\u3400-\u9fff]', segment['ja'])]
    # A lesson currently has 4–10 segments; guard against unexpectedly large
    # imported records while keeping the original audio segment indices.
    valid = valid[:50]
    unique = {}
    for _, text in valid:
        unique.setdefault(kana_reading(text) or normalize_answer(text), text)
    questions = []
    for index, text in valid:
        common = {'segment_index': index}
        questions.append({**common, 'id': f'dictation-{index}', 'mode': 'dictation', 'answer': text,
                          'transcript': text, 'accepts_kana': bool(kana_reading(text))})
        prefix, missing, suffix = cloze_span(text, f'{lesson_id}:{index}:{text}')
        questions.append({**common, 'id': f'cloze-{index}', 'mode': 'cloze', 'prefix': prefix, 'suffix': suffix,
                          'answer': missing, 'transcript': text, 'accepts_kana': bool(kana_reading(missing))})
        alternatives = [value for key, value in unique.items() if key != (kana_reading(text) or normalize_answer(text))]
        if alternatives:
            rng = random.Random(f'{lesson_id}:{index}:{text}')
            rng.shuffle(alternatives)
            choices = [text, *alternatives[:3]]
            rng.shuffle(choices)
            options = [{'id': f'{index}-option-{position}', 'text': value} for position, value in enumerate(choices)]
            correct = next(option['id'] for option in options if option['text'] == text)
            questions.append({**common, 'id': f'comprehension-{index}', 'mode': 'comprehension',
                              'options': options, 'answer': correct, 'transcript': text})
    revision = sha256(json.dumps(questions, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:24]
    return revision, questions


def public_questions(questions: list[dict]) -> list[dict]:
    return [{key: value for key, value in question.items() if key not in {'answer', 'transcript'}} for question in questions]


def grade_questions(questions: list[dict], mode: str, answers: list[dict]) -> dict:
    selected = [question for question in questions if question['mode'] == mode]
    if not selected:
        raise ValueError('listening_exercise_unavailable')
    submitted = {item['question_id']: item['answer'] for item in answers}
    if len(submitted) != len(answers) or set(submitted) != {question['id'] for question in selected}:
        raise ValueError('listening_answers_invalid')
    results = []
    for question in selected:
        answer = submitted[question['id']]
        if mode == 'comprehension':
            option = next((option for option in question['options'] if option['id'] == answer), None)
            if option is None:
                raise ValueError('listening_answers_invalid')
            correct = answer == question['answer']
            submitted_text = option['text']
            expected = question['transcript']
        else:
            correct = answer_matches(answer, question['answer'])
            submitted_text, expected = answer, question['answer']
        results.append({'question_id': question['id'], 'correct': correct, 'submitted': submitted_text,
                        'expected': expected, 'transcript': question['transcript'], 'segment_index': question['segment_index']})
    correct_count = sum(result['correct'] for result in results)
    return {'score': round(100 * correct_count / len(selected), 1), 'correct_count': correct_count,
            'total': len(selected), 'results': results}
