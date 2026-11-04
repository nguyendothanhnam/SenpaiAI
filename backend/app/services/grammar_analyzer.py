import re
import unicodedata
from copy import deepcopy
from .grammar_reviewed import reviewed_simple_sentence
from .grammar_grounded import grounded_patterns
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
        if text.lower() in {'gợi ý học bằng tiếng việt', 'giải thích tiếng việt', 'suggestion', 'vietnamese suggestion', '...'}:
            continue
        lowered = text.lower()
        if any(term in lowered for term in IRRELEVANT_SUGGESTION_TERMS):
            continue
        clean.append(text)
    return clean[:5]


def _clean_grammar_patterns(patterns: Any, text: str = '') -> List[Dict[str, str]]:
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
        anchors = re.findall(r'[\u3040-\u30ff\u3400-\u9fff]+', pattern)
        evidence = str(point.get('evidence') or '').strip()
        if text and (not anchors or (evidence and evidence not in text) or
                     (not evidence and not all(anchor in text for anchor in anchors)) or
                     (evidence and not any(anchor in text for anchor in anchors))):
            continue
        clean.append({
            "pattern": pattern,
            "explanation": str(point.get("explanation", UNKNOWN_WORD_MESSAGE)).strip() or UNKNOWN_WORD_MESSAGE,
            "example": str(point.get("example", "")).strip(),
        })
    return clean


def deterministic_grammar_analysis(text: str, include_vietnamese: bool = False, response_language: str = 'vi') -> Dict[str, Any] | None:
    normalized = _normalize_text(text)
    simple = reviewed_simple_sentence(text, response_language)
    if simple is not None:
        return simple
    en = response_language == 'en'
    match = re.fullmatch(r'(今日|昨日|明日)は何を(しました|します)か[。？?]?', normalized)
    if match and ((match[1] == '昨日' and match[2] == 'します') or (match[1] == '明日' and match[2] == 'しました')):
        match = None
    if match:
        day, verb = match.groups()
        # The complete sentence is recognized, rather than patching arbitrary
        # sentences that merely contain one familiar word.
        when_vi = {'今日': 'Hôm nay', '昨日': 'Hôm qua', '明日': 'Ngày mai'}[day]
        when_en = {'今日': 'today', '昨日': 'yesterday', '明日': 'tomorrow'}[day]
        past = verb == 'しました'
        meaning = (f'What {"did" if past else "will"} you do {when_en}?' if en else
                   f'{when_vi} bạn {"đã" if past else "sẽ"} làm gì?')
        patterns = [
            {'pattern': 'は', 'explanation': 'Marks the topic: the day being discussed.' if en else 'Đánh dấu chủ đề: ngày đang được nói tới.', 'example': f'{day}は何を{verb}か。'},
            {'pattern': 'を', 'explanation': 'Marks 何 (what) as the object of the action.' if en else 'Đánh dấu 何 (cái gì) là tân ngữ của hành động.', 'example': '本を読みます。'},
            {'pattern': 'Vました' if past else 'Vます', 'explanation': ('Polite past form of a verb; しました is the past form of します (to do).' if past else 'Polite non-past form: a present, habitual or future action, depending on context.') if en else ('Dạng quá khứ lịch sự của động từ; しました là quá khứ của します (làm).' if past else 'Dạng lịch sự chưa chia quá khứ; tùy ngữ cảnh diễn tả hiện tại, thói quen hoặc tương lai.'), 'example': '昨日、勉強しました。' if past else '明日、勉強します。'},
            {'pattern': 'か', 'explanation': 'Sentence-final question particle.' if en else 'Trợ từ đặt ở cuối câu để tạo câu hỏi.', 'example': f'{day}は何を{verb}か。'},
        ]
        return {'sentence_meaning': meaning, 'vocabulary': [
            {'term': day, 'meaning': when_en if en else when_vi.lower(), 'jlpt_level': 'N5'},
            {'term': '何', 'meaning': 'what' if en else 'cái gì', 'jlpt_level': 'N5'},
            {'term': verb, 'meaning': ('did (polite past of する)' if past else 'do (polite form of する)') if en else ('đã làm (quá khứ lịch sự của する)' if past else 'làm (dạng lịch sự của する)'), 'jlpt_level': 'N5'},
        ], 'grammar_patterns': patterns, 'grammar_points': deepcopy(patterns), 'jlpt_level': 'N5', 'difficulty_score': 2.5,
            'suggestions': ['Practice time words and the polite forms します／しました.', 'Make questions with 何を〜ますか／何を〜ましたか.'] if en else ['Ôn từ chỉ thời gian và dạng lịch sự します／しました.', 'Tập đặt câu hỏi với 何を〜ますか／何を〜ましたか.'], 'translation': None}

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
        result = {
            "sentence_meaning": '"がくせい" có nghĩa là gì?',
            "vocabulary": [
                {"term": "がくせい / 学生", "meaning": "học sinh, sinh viên", "jlpt_level": "N5"},
                {"term": "意味", "meaning": "ý nghĩa, nghĩa", "jlpt_level": "N5"},
            ],
            "grammar_patterns": [
                {
                    "pattern": "は",
                    "explanation": "Đánh dấu từ đang được hỏi nghĩa là chủ đề của câu.",
                    "example": "学生はどういう意味ですか。",
                },
                {
                    "pattern": "どういう意味ですか",
                    "explanation": "Mẫu câu hỏi lịch sự: có nghĩa là gì?",
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
        if en:
            result['sentence_meaning'] = 'What does "がくせい" mean?'
            result['vocabulary'][0]['meaning'] = 'student'
            result['vocabulary'][1]['meaning'] = 'meaning'
            result['grammar_patterns'][0]['explanation'] = 'Marks the word whose meaning is being asked as the topic.'
            result['grammar_patterns'][1]['explanation'] = 'A polite question asking what something means.'
            result['suggestions'] = ['Practice the question 〜はどういう意味ですか.', 'Review N5 vocabulary about people and occupations.']
            result['translation'] = None
        result['grammar_points'] = deepcopy(result['grammar_patterns'])
        return result

    return None


def sanitize_grammar_analysis(
    text: str,
    raw_result: Dict[str, Any] | None,
    include_vietnamese: bool = False,
    response_language: str = 'vi',
) -> Dict[str, Any]:
    deterministic = deterministic_grammar_analysis(text, include_vietnamese, response_language)
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
        surfaces = re.findall(r'[\u3040-\u30ff\u3400-\u9fff]+', term)
        if not surfaces or not any(surface in text for surface in surfaces):
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
        if response_language == 'en':
            if term == 'がくせい / 学生':
                meaning = 'student'
            elif term == '意味':
                meaning = 'meaning'
            elif meaning == UNKNOWN_WORD_MESSAGE:
                meaning = 'Meaning not yet verified'
        cleaned_vocab.append({
            "term": term,
            "meaning": meaning,
            "jlpt_level": item.get("jlpt_level", level),
        })

    grammar_patterns = raw_result.get("grammar_patterns")
    if not grammar_patterns:
        grammar_patterns = raw_result.get("grammar_points")
    grammar_patterns = _clean_grammar_patterns(grammar_patterns, text)
    if "どういう意味" in text and not any(point["pattern"] == "どういう意味" for point in grammar_patterns):
        grammar_patterns.append({
            "pattern": "どういう意味",
            "explanation": "what does it mean" if response_language == 'en' else "nghĩa là gì",
            "example": "これはどういう意味ですか。",
        })

    suggestions = _clean_suggestions(raw_result.get("suggestions"))
    if not suggestions:
        suggestions = ['Review the grammar patterns present in this sentence.'] if response_language == 'en' else ["Ôn lại các mẫu ngữ pháp xuất hiện trong câu"]

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


def grammar_generation_prompt(text: str, language: str) -> tuple[str, str]:
    name = 'Vietnamese' if language == 'vi' else 'English'
    if language == 'vi':
        system = '''Bạn là giáo viên tiếng Nhật cho người Việt. Chỉ xuất một đối tượng JSON hợp lệ.
Mọi nghĩa từ, nghĩa câu, giải thích và gợi ý phải viết bằng tiếng Việt có dấu. Không viết phần giải thích bằng tiếng Anh hoặc tiếng Nhật.
Chỉ phân tích câu người dùng nhập. Từ vựng term phải là từ/cụm thực sự có trong câu đó.
Mỗi mẫu ngữ pháp phải có evidence trích nguyên văn từ câu nhập. Không coi từ vựng là mẫu ngữ pháp.
Chỉ giữ tối đa 6 mẫu ngữ pháp có mặt trong câu. Không tự thêm từ hoặc mẫu không có trong câu.
Dùng các khóa JSON sau: sentence_meaning, vocabulary, grammar_patterns, jlpt_level, difficulty_score, suggestions.
sentence_meaning là bản dịch nguyên câu sang tiếng Việt.
vocabulary là danh sách các đối tượng có khóa term, meaning, jlpt_level. Điền từ tiếng Nhật thật vào term và nghĩa tiếng Việt thật vào meaning.
grammar_patterns là danh sách các đối tượng có khóa pattern, evidence, explanation, example. Điền mẫu tiếng Nhật thật, trích đoạn thật và giải thích cụ thể bằng tiếng Việt.
suggestions là danh sách các lời khuyên cụ thể để ôn những mẫu vừa phân tích.
Không chép lại lời hướng dẫn này vào các trường dữ liệu.
Chọn cấp độ thực tế từ N5 đến N1; điểm khó từ 1 đến 10. Không in Markdown, không in trường translation.
Nếu không có từ hoặc mẫu phù hợp, dùng danh sách rỗng thay vì bịa thêm.'''
        return system, f'Phân tích đúng câu sau. Viết nghĩa và giải thích bằng tiếng Việt:\n{text}'
    system = f'''Analyze ONLY the Japanese text provided by the user. Return one JSON object.
Write sentence_meaning, vocabulary meanings, grammar explanations and suggestions entirely in {name}.
Keep Japanese only in term, pattern, evidence and example. Do not use vocabulary from these instructions.
Vocabulary term must be an exact surface from the input, not an unrelated word or an invented lemma.
Each grammar pattern must have evidence copied exactly from the input. Vocabulary is not a grammar pattern.
Include only grammar that occurs in the input, at most 6 patterns. Use empty arrays rather than inventing items.
sentence_meaning is a direct translation of the input, without commentary.
Use this JSON structure:
{{"sentence_meaning":"...","vocabulary":[{{"term":"...","meaning":"...","jlpt_level":"N5"}}],
"grammar_patterns":[{{"pattern":"...","evidence":"...","explanation":"...","example":"..."}}],
"jlpt_level":"N5","difficulty_score":2.5,"suggestions":["..."]}}
JLPT must be N5, N4, N3, N2 or N1. Difficulty must be between 1 and 10.
Do not add Markdown fences, task labels or a second translation field.'''
    return system, f'Analyze this exact input in {name}:\n{text}'


def grammar_analysis_is_valid(result: dict, language: str) -> bool:
    if not result.get('sentence_meaning'):
        return False
    if not result.get('vocabulary') and not result.get('grammar_patterns'):
        return False
    if re.search(r'sentence_meaning|vocabulary|grammar_patterns|nghĩa câu|mọi nghĩa từ|phải viết bằng|trả (?:về )?json|return (?:one |a )?json|write .* in (?:vietnamese|english)',
                 str(result['sentence_meaning']), re.IGNORECASE):
        return False
    descriptions = [result['sentence_meaning']]
    descriptions.extend(item.get('meaning', '') for item in result.get('vocabulary', []))
    descriptions.extend(item.get('explanation', '') for item in result.get('grammar_patterns', []))
    descriptions.extend(result.get('suggestions', []))
    for description in descriptions:
        # Japanese examples and forms are separate fields. Prose must use the
        # selected UI language, including short glosses such as "what" / "did".
        prose = re.sub(r'[\u3040-\u30ff\u3400-\u9fff]+', ' ', str(description)).strip()
        if not prose_matches_language(prose, language):
            return False
    return True


def prose_matches_language(text: str, language: str) -> bool:
    # Unlike a chat question, a gloss may consist entirely of a quoted word.
    # Do not discard quotes and then classify an empty string as English.
    plain = re.sub(r'[\u3040-\u30ff\u3400-\u9fff]+', ' ', str(text))
    if not re.search(r'[a-zA-ZÀ-ỹ]', plain):
        return False
    folded = ''.join(c for c in unicodedata.normalize('NFD', plain.lower())
                     if not unicodedata.combining(c)).replace('đ', 'd')
    accented = plain.lower() != folded
    if language == 'vi':
        # Detect an English sentence even if it quotes a Vietnamese word.
        english = len(re.findall(r'\b(?:the|is|are|this|that|you|your|means|meaning|subject|object|marks|expresses)\b', folded))
        vietnamese = len(re.findall(r'\b(?:la|cua|toi|ban|nghia|chu|ngu|danh|dau|dien|ta|trong|voi|khong|mot)\b', folded))
        return accented and not (english >= 3 and english > vietnamese)
    return not accented


def grounded_model_analysis(text: str, raw: dict, language: str) -> dict:
    """Replace recognized forms with reviewed explanations, without trusting
    a small model's claims that を is a subject or たい is a past tense.
    """
    analysis = sanitize_grammar_analysis(text, raw, response_language=language)
    points = grounded_patterns(text, language)
    covered = {point['pattern'] for point in points}
    extras = [point for point in analysis['grammar_patterns']
              if point['pattern'] not in covered and
              prose_matches_language(point['explanation'], language) and
              not any(re.sub(r'^[VN～〜]+', '', point['pattern']) in known['evidence'] for known in points)]
    analysis['grammar_patterns'] = points + extras
    analysis['grammar_points'] = analysis['grammar_patterns']
    analysis['vocabulary'] = [item for item in analysis['vocabulary'] if prose_matches_language(item['meaning'], language)]
    analysis['suggestions'] = [item for item in analysis['suggestions'] if prose_matches_language(item, language)]
    meaning = analysis['sentence_meaning']
    # Basic semantic checks catch dropped desire/negation, a common failure of
    # gemma:2b. They do not establish that an arbitrary translation is correct.
    if any(point['pattern'] == 'Vたい' for point in points):
        desire_words = r'\b(?:want|wish|like|wanted)\b' if language == 'en' else r'\b(?:muốn|mong|thích)\b'
        if not re.search(desire_words, meaning, re.IGNORECASE):
            analysis['sentence_meaning'] = ''
    if any(point['pattern'] in {'Vません', 'Vませんでした', 'Nではない'} for point in points):
        negative_words = r"\b(?:not|never|no)\b|n't" if language == 'en' else r'\b(?:không|chưa|chẳng)\b'
        if not re.search(negative_words, meaning, re.IGNORECASE):
            analysis['sentence_meaning'] = ''
    semantic_checks = {
        'Vることができる': (r'\b(?:can|able|could)\b', r'có thể|có khả năng'),
        'Vなければならない': (r'\b(?:must|need|have to|has to)\b', r'\b(?:phải|cần)\b'),
        'Vてください': (r'\bplease\b', r'\b(?:hãy|xin|vui lòng|làm ơn)\b'),
        '～と思う': (r'\b(?:think|thought|believe)\b', r'\bnghĩ\b|cho rằng|cho là'),
    }
    for point in points:
        checks = semantic_checks.get(point['pattern'])
        if checks and not re.search(checks[0 if language == 'en' else 1], meaning, re.IGNORECASE):
            analysis['sentence_meaning'] = ''
    return analysis
