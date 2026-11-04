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
    return bool(re.search(r'câu (?:trên|trước|đó)|giải thích thêm|ví dụ (?:khác|thêm)|tiếp tục|như trên|\b(?:previous|above|that|it|more|continue|follow.up)\b', question, re.IGNORECASE))


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
    target_match = re.search(r'(?:sang|into|to)\s+(?:tieng\s+)?(anh|viet|english|vietnamese)\b', _fold(question))
    target = ('en' if target_match[1] in ('anh', 'english') else 'vi') if target_match else None
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
        if allowed_translation:
            return False
        return True
    if re.search(r'cannot (?:access|answer)|can.t (?:access|answer)|không thể truy cập.*từ điển', plain, re.IGNORECASE):
        return True
    return (en >= 4 and en > vi) if language == 'vi' else (vi >= 4 and vi > en)
