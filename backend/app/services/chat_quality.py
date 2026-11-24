"""Runtime guards and task contracts. Does not import benchmark data or its grader."""
import re
from .chat_language import answer_needs_revision

INTERNAL_SOURCE_TERMS=('internal','system_rule','deterministic_chat')
CHINESE_PROSE=re.compile(r'动词|形容词|名词|助词|连体|这个|这是|因为|所以|我们|你们|学习|语法|谢谢|请问|汉语|中文')
INTERNAL_LABEL=re.compile(r'(?im)^\s*(?:\*\*)?(?:Intent|Task|Output|Classification|Reviewed reference|Nguồn \d+)\s*[:：]|===.*(?:REFERENCE|THAM KHẢO).*===')


def public_source(source):
    kind=str(source.get('type','')).lower();title=str(source.get('title','')).lower()
    if any(word in kind for word in INTERNAL_SOURCE_TERMS) or any(word in title for word in ('internal rules','intent rules','system rules')):
        return False
    url=source.get('url') or ''
    return not url or isinstance(url,str) and (url.startswith(('https://','http://')) or url.startswith('/') and not url.startswith('//'))


def question_kind(question):
    if re.search(r'phân tích|analy[sz]e|giải thích câu',question,re.I):return 'analysis'
    if re.search(r'phân biệt|so sánh|khác nhau|difference|compare|khi nào dùng.+và',question,re.I):return 'comparison'
    if re.search(r'\bkanji\b|漢字|chữ hán',question,re.I):return 'kanji'
    if re.search(r'\bdịch\b|\btranslate\b|translation|dịch Nhật',question,re.I):return 'translation'
    if re.search(r'ngữ pháp|cấu trúc|mẫu|grammar|cách dùng|diễn tả|[～〜]',question,re.I):return 'grammar'
    if re.search(r'\btừ\b|từ vựng|vocabulary|\bword\b|đọc thế nào',question,re.I):return 'vocabulary'
    anchors=re.findall(r'[ぁ-んァ-ヶ一-龯ー]+',question)
    if len(anchors)==1 and len(anchors[0])<=8 and re.search(r'nghĩa|đọc|dùng để|tra',question,re.I):return 'vocabulary'
    if re.search(r'văn hóa|người nhật|ở nhật|nhật bản|trà đạo|culture',question,re.I):return 'culture'
    return 'general'


def violations(question,answer,language,context=None):
    errors=[]
    if not answer.strip():return ['empty']
    if INTERNAL_LABEL.search(answer):errors.append('internal_labels')
    if re.search(r'Response language:|Primary Goal:|Do not repeat these instructions|TOÀN BỘ.*PHẢI|HƯỚNG DẪN TRẢ LỜI|Cấu trúc chuẩn cho từng dạng',answer,re.I):errors.append('prompt_echo')
    if CHINESE_PROSE.search(answer):errors.append('chinese_prose')
    if answer_needs_revision(answer,language,question):errors.append('language')
    kind=question_kind(question)
    if context and kind in ('grammar','comparison','analysis'):
        known=re.sub(r'[\s*。、！？!?]','',context+'\n'+question)
        sentences=re.findall(r'[ぁ-んァ-ヶ一-龯ー、]{8,}',answer)
        if any(re.sub(r'[\s*。、！？!?]','',sentence) not in known for sentence in sentences):
            errors.append('unverified_example')
    if kind=='translation' and re.search(r'(?:sang|ra)\s+tiếng\s+Nhật|into Japanese',question,re.I) and not re.search(r'[ぁ-んァ-ヶ一-龯]',answer):errors.append('missing_japanese_translation')
    if re.search(r'phủ định|negative',question,re.I) and not re.search(r'ない|ません|なかった|not\b|chưa (?:có|xác minh)',answer,re.I):errors.append('requested_negation')
    uncertain=bool(re.search(r'chưa (?:có|thể|xác minh)|không (?:có|đủ) (?:dữ liệu|căn cứ)|not (?:enough|verified)|cannot verify',answer,re.I))
    if not uncertain and kind in ('grammar','comparison'):
        if not re.search(r'ví dụ|example|→',answer,re.I):errors.append('example')
        if not re.search(r'[ぁ-ん]{2,}|[A-Z][a-z]+ [a-z]+',answer):errors.append('reading')
    if re.search(r'\b(?:GRAMMAR_EXPLANATION|TRANSLATION_TASK|KANJI_LOOKUP)\b',answer):errors.append('internal_labels')
    return errors


def scope_reply(question,language):
    injection=re.search(r'system prompt|in (?:lời nhắc|prompt)|bỏ qua quy tắc|hoàn toàn bằng tiếng trung|entirely in chinese',question,re.I)
    outside=re.search(r'bitcoin|tiền ảo|phương trình|thuốc điều trị|đau ngực|đào tiền',question,re.I)
    learning=re.search(r'tiếng nhật|dịch|日本語|japanese|kanji',question,re.I)
    if injection or outside and not learning:
        return ('Tôi hỗ trợ học tiếng Nhật bằng tiếng Việt hoặc tiếng Anh. Yêu cầu này nằm ngoài phạm vi; bạn có thể hỏi về ngữ pháp, từ vựng hoặc dịch tiếng Nhật.' if language=='vi' else
                'I help with Japanese learning in English or Vietnamese. This request is outside that scope; you can ask about Japanese grammar, vocabulary or translation.')
    return None


def unverifiable_request(question):
    return bool(re.search(r'JLPT',question,re.I) and re.search(r'ngày nào|năm sau|năm nay|lịch thi',question,re.I)
        or re.search(r'trích.*trang\s*\d+.*(?:chưa|không).*cung cấp',question,re.I))


def uncertainty(language):
    return ('Mình chưa có đủ căn cứ trong học liệu hiện có để xác minh câu trả lời này. Bạn có thể cung cấp câu ví dụ, ngữ cảnh hoặc tài liệu gốc để mình đối chiếu không?' if language=='vi' else
            'I do not have enough verified material to answer this confidently. Please provide an example, context or the original source so I can check it.')
