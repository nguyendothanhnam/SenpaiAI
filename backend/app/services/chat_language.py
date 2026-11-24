"""Language and task boundaries for bilingual text chat."""
import re
import unicodedata


def _fold(text: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(c)).replace('đ', 'd')


def detect_chat_language(question: str, fallback: str | None = None) -> str:
    # Quoted material is often the sentence being translated, not the language
    # in which the learner is giving instructions.
    instructions = re.sub(r'[「『"“\'].*?[」』"”\']', ' ', question, flags=re.DOTALL)
    folded = _fold(instructions)
    vi = re.findall(r'\b(?:toi|ban|nghia|dich|tieng|cau|giai|thich|khac|nhau|gi|chao|minh|muon|hoc|ngu|phap)\b', folded)
    en = re.findall(r'\b(?:what|does|mean|explain|translate|hello|please|difference|between|how|why|english|vietnamese|japanese|sentence|want|learn)\b', folded)
    if len(vi) > len(en):
        return 'vi'
    if en:
        return 'en'
    if instructions.lower() != _fold(instructions) and re.search(r'[a-zA-Z]', instructions):
        return 'vi'
    if re.search(r'\b[a-zA-Z]{3,}\b', instructions):
        return 'en'
    return fallback if fallback in ('vi', 'en') else 'vi'


def needs_history(question: str) -> bool:
    return bool(re.search(r'câu (?:trên|trước|đó)|giải thích thêm|ví dụ (?:khác|thêm)|tiếp tục|như trên|(?:mẫu|chữ|trợ từ) (?:vừa rồi|trên)|hai trợ từ trên|\b(?:previous|above|that|it|more|continue|follow.up)\b', question, re.IGNORECASE))


def is_chitchat_query(question: str) -> bool:
    folded = _fold(question.strip().lower())
    if re.search(r'^(?:xin\s+)?chao(?:\s+(?:ban|senpai|ai|ad|em|anh|chi))?\s*[!?.]*$', folded):
        return True
    if re.search(r'^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b', folded):
        return True
    if re.search(r'^(?:ban|senpai)\s+(?:la\s+ai|ten\s+gi|la\s+gi)\b', folded):
        return True
    if re.search(r'^(?:who\s+are\s+you|what\s+is\s+your\s+name)\b', folded):
        return True
    if re.search(r'^(?:cam\s+on|thank\s+you|thanks|arigato|arigatou)\b', folded):
        return True
    if re.search(r'^(?:tam\s+biet|bye|goodbye|sayonara)\b', folded):
        return True
    return False


def chitchat_direct_answer(question: str, language: str = 'vi') -> str | None:
    folded = _fold(question.strip().lower())
    if re.fullmatch(r'(?:こんにちは|こんばんは|おはようございます)[!！。\s]*',question.strip()) or re.match(r'^(?:good morning|good afternoon|good evening)\b',folded):
        return 'Hello! I am SenpaiAI. What would you like to learn about Japanese today?' if language=='en' else 'Chào bạn! Tôi là SenpaiAI. Hôm nay bạn muốn học gì về tiếng Nhật?'
    if re.search(r'^(?:xin\s+)?chao(?:\s+(?:ban|senpai|ai|ad|em|anh|chi))?\s*[!?.]*$', folded) or re.search(r'^(?:hello|hi|hey)\b', folded):
        return 'Hello! I am SenpaiAI, your Japanese learning assistant. How can I help you today?' if language=='en' else 'Chào bạn! Tôi là SenpaiAI, trợ lý hỗ trợ học tiếng Nhật. Bạn muốn luyện ngữ pháp, từ vựng hay dịch câu hôm nay?'

    if re.search(r'^(?:ban|senpai)\s+(?:la\s+ai|ten\s+gi|la\s+gi)\b', folded) or re.search(r'^(?:who\s+are\s+you|what\s+is\s+your\s+name)\b', folded):
        if language == 'en':
            return (
                "I am **SenpaiAI**, your dedicated AI Japanese tutor built on standard JLPT curriculum and verified learning knowledge. "
                "I'm here to help you master Japanese vocabulary, Kanji, grammar, and reading comprehension!"
            )
        return (
            "Tôi là **SenpaiAI**, trợ lý AI đồng hành học tiếng Nhật được xây dựng dựa trên giáo trình chuẩn JLPT (N5 ~ N1) và thư viện học liệu chuyên sâu. "
            "Tôi luôn sẵn sàng giải đáp thắc mắc về ngữ pháp, từ vựng, chữ Hán và luyện thi tiếng Nhật cho bạn!"
        )

    if re.search(r'^(?:cam\s+on|thank\s+you|thanks|arigato|arigatou)\b', folded):
        if language == 'en':
            return "You're very welcome! Keep up the great work with your Japanese studies! (どういたしまして！ 頑張ってください！)"
        return "Không có gì đâu bạn! Chúc bạn học tiếng Nhật thật tốt và tiến bộ mỗi ngày nhé! Nếu có cấu trúc nào chưa hiểu, hãy cứ hỏi tôi nha. (どういたしまして！ 頑張ってください！)"

    if re.search(r'^(?:tam\s+biet|bye|goodbye|sayonara)\b', folded):
        if language == 'en':
            return "Goodbye! See you next time! (またね！)"
        return "Tạm biệt bạn! Hẹn gặp lại bạn trong buổi học tiếp theo nhé! (またね！)"

    return None


def is_translation_question(question: str) -> bool:
    return bool(re.search(r'\b(?:dich|nghia la gi|translate|translation|meaning|mean)\b', _fold(question)))


def same_language_translation(question: str, language: str) -> str | None:
    # Handle a complete sentence followed by "dịch câu này sang tiếng Việt"
    # without inventing a translation of a previous message.
    match = re.search(r'(?:dịch|translate)\b.*?(?:sang|into|to)\s+(?:tiếng\s+)?(việt|anh|vietnamese|english)', question, re.IGNORECASE)
    if not match:
        return None
    target = 'vi' if match[1].lower() in ('việt', 'vietnamese') else 'en'
    source = question[:match.start()].strip(' \n\r.:“”"')
    if not source or re.search(r'[\u3040-\u30ff\u3400-\u9fff]', source):
        return None
    if detect_chat_language(source) != target:
        return None
    if language == 'en':
        name = 'Vietnamese' if target == 'vi' else 'English'
        return f'This sentence is already in {name}:\n\n{source}\n\nWhich language would you like to translate it into?'
    name = 'tiếng Việt' if target == 'vi' else 'tiếng Anh'
    return f'Câu này đã là {name}:\n\n{source}\n\nBạn muốn dịch câu này sang ngôn ngữ nào?'


def answer_needs_revision(answer: str, language: str, question: str = '') -> bool:
    target_match = re.search(r'(?:sang|into|to)\s+(?:tieng\s+)?(anh|viet|nhat|english|vietnamese|japanese)\b', _fold(question))
    target = ('en' if target_match[1] in ('anh', 'english') else 'ja' if target_match[1] in ('nhat','japanese') else 'vi') if target_match else None
    # A requested translation may legitimately be in the other language. Check
    # the explanation separately and allow one paragraph for the translation.
    checked = []
    allowed_translation = False
    for paragraph in re.split(r'\n\s*\n', answer):
        words = _fold(paragraph)
        en_prose = len(re.findall(r'\b(?:the|is|are|this|that|you|your|can|cannot|meaning|means|sentence|explanation|subject|topic|object|because|which|would)\b', words)) >= 4
        vi_prose = len(re.findall(r'\b(?:cua|ban|toi|nghia|dich|cau|chu|ngu|danh|dau|nguoi|hoc|mot|nay|khong|trong|voi|duoc|muon|thanh)\b', words)) >= 4
        foreign = en_prose and not vi_prose if language == 'vi' else vi_prose and not en_prose
        if foreign:
            if target and target != language and not allowed_translation:
                allowed_translation = True
                continue
            return True
        checked.append(paragraph)
    answer = '\n\n'.join(checked)
    plain = re.sub(r'[\u3040-\u30ff\u3400-\u9fff]+', ' ', answer)
    folded = _fold(plain)
    vi = len(re.findall(r'\b(?:la|cua|ban|toi|nghia|dich|cau|chu|ngu|de|danh|dau|nguoi|hoc|mot|nay|khong|trong|voi|duoc|gi|hom|muon|thanh)\b', folded))
    en = len(re.findall(r'\b(?:the|is|are|this|that|you|your|can|cannot|meaning|means|sentence|explanation|subject|topic|object|translate|translation|because|therefore|which|would)\b', folded))
    if not re.search(r'[a-zA-ZÀ-ỹ]', plain):
        if allowed_translation or target=='ja' and re.search(r'[ぁ-んァ-ヶ一-龯]',answer):
            return False
        return True
    if re.search(r'cannot (?:access|answer)|can.t (?:access|answer)|không thể truy cập.*từ điển', plain, re.IGNORECASE):
        return True
    return (en >= 4 and en > vi) if language == 'vi' else (vi >= 4 and vi > en)
