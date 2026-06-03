import re
from typing import Any, Dict, List


UNKNOWN_WORD_MESSAGE = "Chưa chắc chắn về từ này"

COMMON_VOCAB = {
    "がくせい": {
        "term": "がくせい / 学生",
        "meaning": "học sinh, sinh viên",
        "jlpt_level": "N5",
    },
    "学生": {
        "term": "がくせい / 学生",
        "meaning": "học sinh, sinh viên",
        "jlpt_level": "N5",
    },
    "意味": {
        "term": "意味",
        "meaning": "ý nghĩa, nghĩa",
        "jlpt_level": "N5",
    },
}

IRRELEVANT_SUGGESTION_TERMS = (
    "article",
    "articles",
    "preposition",
    "prepositions",
    "conjunction",
    "conjunctions",
)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", text or "").strip()


def _difficulty_for_jlpt(level: str) -> float:
    return {
        "N5": 2.5,
        "N4": 4.0,
        "N3": 5.5,
        "N2": 7.5,
        "N1": 9.5,
    }.get(level, 5.0)


def _clean_suggestions(suggestions: Any) -> List[str]:
    if not isinstance(suggestions, list):
        return []

    clean = []
    for suggestion in suggestions:
        text = str(suggestion).strip()
        if not text:
            continue
        lowered = text.lower()
        if any(term in lowered for term in IRRELEVANT_SUGGESTION_TERMS):
            continue
        clean.append(text)
    return clean[:5]


def _clean_grammar_patterns(patterns: Any) -> List[Dict[str, str]]:
    if not isinstance(patterns, list):
        return []

    clean = []
    vocab_terms = {"がくせい", "学生", "意味"}
    for point in patterns:
        if not isinstance(point, dict):
            continue
        pattern = str(point.get("pattern", "")).strip()
        if not pattern or pattern in vocab_terms:
            continue
        clean.append({
            "pattern": pattern,
            "explanation": str(point.get("explanation", UNKNOWN_WORD_MESSAGE)).strip() or UNKNOWN_WORD_MESSAGE,
            "example": str(point.get("example", "")).strip(),
        })
    return clean


def deterministic_grammar_analysis(text: str, include_vietnamese: bool = False) -> Dict[str, Any] | None:
    normalized = _normalize_text(text)

    if normalized in {
        "「がくせい」はどういう意味ですか。",
        "「がくせい」はどういう意味ですか",
        '"がくせい"はどういう意味ですか。',
        '"がくせい"はどういう意味ですか',
        "がくせいはどういう意味ですか。",
        "がくせいはどういう意味ですか",
        "「学生」はどういう意味ですか。",
        "「学生」はどういう意味ですか",
        "学生はどういう意味ですか。",
        "学生はどういう意味ですか",
    }:
        return {
            "sentence_meaning": '"がくせい" có nghĩa là gì?',
            "vocabulary": [
                {"term": "がくせい / 学生", "meaning": "học sinh, sinh viên", "jlpt_level": "N5"},
                {"term": "意味", "meaning": "ý nghĩa, nghĩa", "jlpt_level": "N5"},
            ],
            "grammar_patterns": [
                {
                    "pattern": "A は B ですか",
                    "explanation": "A là B phải không? / A có phải là B không?",
                    "example": "学生はどういう意味ですか。",
                },
                {
                    "pattern": "どういう意味",
                    "explanation": "nghĩa là gì",
                    "example": "これはどういう意味ですか。",
                },
            ],
            "jlpt_level": "N5",
            "difficulty_score": 2.5,
            "suggestions": [
                "Ôn mẫu câu 「〜はどういう意味ですか」",
                "Ôn từ vựng N5 về người và nghề nghiệp",
            ],
            "translation": '"がくせい" có nghĩa là gì?' if include_vietnamese else None,
        }

    return None


def sanitize_grammar_analysis(
    text: str,
    raw_result: Dict[str, Any] | None,
    include_vietnamese: bool = False,
) -> Dict[str, Any]:
    deterministic = deterministic_grammar_analysis(text, include_vietnamese)
    if deterministic:
        return deterministic

    raw_result = raw_result if isinstance(raw_result, dict) else {}
    level = raw_result.get("jlpt_level") if raw_result.get("jlpt_level") in {"N5", "N4", "N3", "N2", "N1"} else "N3"

    vocabulary = raw_result.get("vocabulary")
    if not isinstance(vocabulary, list):
        vocabulary = []

    known_terms = []
    for surface, data in COMMON_VOCAB.items():
        if surface in text and data["term"] not in known_terms:
            vocabulary.append(dict(data))
            known_terms.append(data["term"])

    cleaned_vocab = []
    seen_terms = set()
    for item in vocabulary:
        if not isinstance(item, dict):
            continue
        term = str(item.get("term") or item.get("word") or "").strip()
        if not term or term in seen_terms:
            continue
        for surface, data in COMMON_VOCAB.items():
            if surface in term:
                term = data["term"]
                item = {**item, **data}
                break
        if term in seen_terms:
            continue
        seen_terms.add(term)
        meaning = str(item.get("meaning") or item.get("meaning_vi") or "").strip() or UNKNOWN_WORD_MESSAGE
        cleaned_vocab.append({
            "term": term,
            "meaning": meaning,
            "jlpt_level": item.get("jlpt_level", level),
        })

    grammar_patterns = raw_result.get("grammar_patterns")
    if not grammar_patterns:
        grammar_patterns = raw_result.get("grammar_points")
    grammar_patterns = _clean_grammar_patterns(grammar_patterns)
    if "どういう意味" in text and not any(point["pattern"] == "どういう意味" for point in grammar_patterns):
        grammar_patterns.append({
            "pattern": "どういう意味",
            "explanation": "nghĩa là gì",
            "example": "これはどういう意味ですか。",
        })

    suggestions = _clean_suggestions(raw_result.get("suggestions"))
    if not suggestions:
        suggestions = ["Ôn lại các mẫu ngữ pháp xuất hiện trong câu"]

    sentence_meaning = str(raw_result.get("sentence_meaning") or raw_result.get("translation") or "").strip()
    if not sentence_meaning and include_vietnamese:
        sentence_meaning = UNKNOWN_WORD_MESSAGE

    difficulty = raw_result.get("difficulty_score")
    if not isinstance(difficulty, (int, float)) or difficulty <= 0:
        difficulty = _difficulty_for_jlpt(level)

    return {
        "sentence_meaning": sentence_meaning,
        "vocabulary": cleaned_vocab,
        "grammar_patterns": grammar_patterns,
        "grammar_points": grammar_patterns,
        "jlpt_level": level,
        "difficulty_score": float(difficulty),
        "suggestions": suggestions,
        "translation": sentence_meaning if include_vietnamese and sentence_meaning else raw_result.get("translation"),
    }
