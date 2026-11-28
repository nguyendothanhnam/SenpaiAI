"""Language and task boundaries for bilingual text chat."""
import re
import unicodedata


def _fold(text: str) -> str:
    return unicodedata.normalize('NFC',''.join(c for c in unicodedata.normalize('NFD', text.lower())
        if not unicodedata.combining(c) or c in '\u3099\u309a')).replace('đ', 'd')


def unquoted_instructions(question: str) -> str:
    text=question
    for pattern in (r'「[^」]*」',r'『[^』]*』',r'“[^”]*”',r'"[^"]*"',
                    r"(?<!\w)'[^']*'(?!\w)",r'\([^)]*\)',r'（[^）]*）',r'\[[^]]*\]'):
        text=re.sub(pattern,' ',text,flags=re.S)
    return text.strip()


# Function words, not Japanese-study jargon. A technical Latin noun alone never
# constitutes English prose. Vietnamese words protect unaccented/mixed questions.
ENGLISH_WORDS=set('a an the is are am was were be been being do does did have has had can could would should will may might must i me my mine we us our you your he she it they them their this that these those what how why when where which who whose whom and or but if then because so as for from to of in on at with without about into than not no yes please explain describe define compare translate show tell give help understand learn study use used means mean meaning example sentence word want like need know'.split())
VIETNAMESE_WORDS=set('toi minh ban chung chungta anh chi em mot nhung cac nay do kia gi nao sao khi dau bao nhieu la cua co khong chua roi se dang da duoc cho voi ve va hay hoac nhung neu thi vi nen tu sang trong ngoai tren duoi dung hoc tieng nhat ngu phap mau cau cach doc nghia giai thich dich phan biet khac nhau muon can giup the nao them nua truoc sau hom nay mai nhe voi a oi'.split())


def detect_chat_language(question: str, fallback: str | None = None) -> str:
    instructions = unquoted_instructions(question)
    folded = _fold(instructions)
    default=fallback if fallback in ('vi','en') else 'vi'
    requests=[]
    pattern=r'\b(?:tra loi|giai thich|noi|viet|answer|reply|respond|explain)(?:\s+[a-z]+){0,3}?\s+(?:bang\s+(?:tieng\s+)?|in\s+)(anh|viet|english|vietnamese)\b'
    for match in re.finditer(pattern,folded):
        prefix=folded[max(0,match.start()-18):match.start()]
        if re.search(r'khong(?: can)?\s*$|dung\s*$|do not\s*$|don.t\s*$',prefix):continue
        requests.append('en' if match[1] in ('anh','english') else 'vi')
    if re.search(r'英語で(?:説明|答|返事)',instructions):requests.append('en')
    if re.search(r'ベトナム語で(?:説明|答|返事)',instructions):requests.append('vi')
    if requests:return requests[-1]
    words=re.findall(r'[a-z]+',folded)
    vi=sum(w in VIETNAMESE_WORDS and w not in ENGLISH_WORDS for w in words)
    en=sum(w in ENGLISH_WORDS for w in words)
    if vi>=2 or re.search(r'[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]',instructions,re.I):return default
    if re.fullmatch(r'(?:hello|hi|hey|good morning|good afternoon|good evening|thank you|thanks)[!?.\s]*',folded):return 'en'
    imperative=re.match(r'^(?:please\s+)?(?:explain|describe|define|compare|translate|show|tell|give|help|analy[sz]e)\b',folded)
    clause=re.match(r'^(?:(?:hello|hi|hey)[,!.\s]+)?(?:what|how|why|when|where|which|who|can|could|would|do|does|is|are|i|we|you|it|the|this|that)\b',folded)
    if vi==0 and ((imperative and len(words)>=2 and en>=1) or (clause and len(words)>=3 and en>=2 and en/len(words)>=.3)):return 'en'
    return default


def needs_history(question: str) -> bool:
    return bool(re.search(r'cau (?:tren|truoc|do)|giai thich (?:them|lai)|vi du (?:khac|them)|tiep tuc|nhu tren|(?:mau|chu|tro tu) (?:vua roi|tren|do)|hai tro tu tren|dang phu dinh|vi du ay|ngan hon|\b(?:previous|above|that|it|more|continue|follow.up)\b|その|先ほど|もう一つ', _fold(question), re.IGNORECASE))


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
    folded=re.sub(r'^(?:please\s+)?(?:answer|reply|respond)\s+in\s+(?:english|vietnamese)[.:;\s]+','',folded)
    folded=re.sub(r'[.!?;\s]*(?:hay\s+)?tra loi bang (?:tieng )?(?:viet|anh)[.!?\s]*$','',folded)
    if re.search(r'nghia|la gi|what does|meaning|cach doc|furigana',folded) and re.search(r'\bhello\b',folded):return None
    if re.fullmatch(r'(?:こんにちは|こんばんは|おはようございます)[!！。\s]*',question.strip()) or re.match(r'^(?:good morning|good afternoon|good evening)\b',folded):
        return 'Hello! I am SenpaiAI. What would you like to learn about Japanese today?' if language=='en' else 'Chào bạn! Tôi là SenpaiAI. Hôm nay bạn muốn học gì về tiếng Nhật?'
    if re.search(r'^(?:xin\s+)?chao(?:\s+(?:ban|senpaiai|senpai|ai|ad|em|anh|chi))?\s*[!?.]*$', folded) or re.search(r'^(?:hello|hi|hey)\b', folded):
        return 'Hello! I am SenpaiAI, your Japanese learning assistant. How can I help you today?' if language=='en' else 'Chào bạn! Tôi là SenpaiAI, trợ lý hỗ trợ học tiếng Nhật. Bạn muốn luyện ngữ pháp, từ vựng hay dịch câu hôm nay?'

    if re.search(r'^(?:ban|senpai)\s+(?:la\s+ai|ten\s+gi|la\s+gi)\b', folded) or re.search(r'^(?:who\s+are\s+you|what\s+is\s+your\s+name)\b', folded):
        if language == 'en':
            return 'I am SenpaiAI, a Japanese-learning assistant. What word or grammar pattern would you like to study?'
        return 'Tôi là SenpaiAI, trợ lý học tiếng Nhật. Bạn muốn học từ hay mẫu ngữ pháp nào?'

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
            foreign_language='en' if language=='vi' else 'vi'
            if target == foreign_language and not allowed_translation:
                allowed_translation = True
                continue
            return True
        checked.append(paragraph)
    answer = '\n\n'.join(checked)
    plain = re.sub(r'[\u3040-\u30ff\u3400-\u9fff]+', ' ', answer)
    folded = _fold(plain)
    vi = len(re.findall(r'\b(?:la|cua|ban|toi|nghia|dich|cau|chu|ngu|de|danh|dau|nguoi|hoc|mot|nay|khong|trong|voi|duoc|gi|hom|muon|thanh)\b', folded))
    en = len(re.findall(r'\b(?:the|is|are|this|that|you|your|can|cannot|meaning|means|sentence|explanation|subject|topic|object|translate|translation|because|therefore|which|would)\b', folded))
    words=re.findall(r'[a-z]+',folded)
    english=sum(w in ENGLISH_WORDS or w in ('answer','plain') for w in words)
    vietnamese=sum(w in VIETNAMESE_WORDS and w not in ENGLISH_WORDS for w in words)
    if not re.search(r'[a-zA-ZÀ-ỹ]', plain):
        if allowed_translation or target=='ja' and re.search(r'[ぁ-んァ-ヶ一-龯]',answer):
            return False
        return True
    if re.search(r'cannot (?:access|answer)|can.t (?:access|answer)|không thể truy cập.*từ điển', plain, re.IGNORECASE):
        return True
    return (en >= 4 and en > vi or english>=2 and vietnamese==0) if language == 'vi' else (vi >= 4 and vi > en)
