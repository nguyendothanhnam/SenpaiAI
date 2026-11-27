"""Runtime guards and task contracts. Does not import benchmark data or its grader."""
import re
from .chat_language import answer_needs_revision, _fold, chitchat_direct_answer

INTERNAL_SOURCE_TERMS=('internal','system_rule','deterministic_chat')
CHINESE_PROSE=re.compile(r'动词|形容词|名词|助词|连体|这个|这是|因为|所以|我们|你们|学习|语法|谢谢|请问|汉语|中文|學習|這個|這是|因為|所以我們|我們|你們|請問|謝謝|漢語|詞彙|語法學|[图书电车门汉语说读听见]')
INTERNAL_LABEL=re.compile(r'(?im)^\s*(?:\*\*)?(?:Intent|Task|Output|Classification|Reviewed reference|Nguồn \d+)\s*[:：]|===.*(?:REFERENCE|THAM KHẢO).*===')


def public_source(source):
    kind=str(source.get('type','')).lower();title=str(source.get('title','')).lower()
    if any(word in kind for word in INTERNAL_SOURCE_TERMS) or any(word in title for word in ('internal rules','intent rules','system rules')):
        return False
    url=source.get('url') or ''
    return not url or isinstance(url,str) and (url.startswith(('https://','http://')) or url.startswith('/') and not url.startswith('//'))


def question_kind(question):
    q=_fold(question)
    if re.search(r'phan tich|analy[sz]e|giai thich cau|文を分析|文の構造',q,re.I):return 'analysis'
    if re.search(r'phan biet|so sanh|khac nhau|difference|compare|khi nao dung.+va|違い|使い分け',q,re.I):return 'comparison'
    if re.search(r'\bdich\b|\btranslate\b|translation|翻訳|訳して',q,re.I) or (re.search(r'nghia la gi|\bmean\b',q,re.I) and re.search(r'[ぁ-んァ-ヶ一-龯ー]{8,}',q)):return 'translation'
    if re.search(r'\bkanji\b|漢字|chu han|tra chu',q,re.I):return 'kanji'
    if re.search(r'bai tap|trac nghiem|luyen tap|quiz|exercise|practice|練習|A[.)].+B[.)]',q,re.I):return 'exercise'
    if re.search(r'ngu phap|cau truc|mau|grammar|cach dung|dien ta|文法|使い方|[～〜]',q,re.I):return 'grammar'
    if re.search(r'\btu\b|tu vung|vocabulary|\bword\b|doc the nao|cach doc|furigana|読み方',q,re.I):return 'vocabulary'
    anchors=re.findall(r'[ぁ-んァ-ヶ一-龯ー]+',question)
    if len(anchors)==1 and len(anchors[0])<=8 and re.search(r'nghĩa|đọc|dùng để|tra',question,re.I):return 'vocabulary'
    if re.search(r'van hoa|nguoi nhat|o nhat|nhat ban|tra dao|culture|keigo|敬語|日本の文化',q,re.I):return 'culture'
    if chitchat_direct_answer(question):return 'greeting'
    if re.search(r'bitcoin|tien ao|phuong trinh|thuoc|dau nguc|co phieu|chung khoan|thoi tiet|bong da|may giat|nau pho|recipe|stock price|football|weather',q,re.I) and not re.search(r'tieng nhat|dich|translate|日本語|japanese',q,re.I):return 'off_topic'
    return 'unclear'


def violations(question,answer,language,context=None):
    errors=[]
    if not answer.strip():return ['empty']
    if INTERNAL_LABEL.search(answer):errors.append('internal_labels')
    if re.search(r'Response language:|Primary Goal:|Do not repeat these instructions|TOÀN BỘ.*PHẢI|HƯỚNG DẪN TRẢ LỜI|Cấu trúc chuẩn cho từng dạng',answer,re.I):errors.append('prompt_echo')
    # Quoted Chinese/old characters explicitly asked about may be legitimate.
    checked_cn=answer
    for phrase in CHINESE_PROSE.findall(question):checked_cn=checked_cn.replace(phrase,'')
    if CHINESE_PROSE.search(checked_cn):errors.append('chinese_prose')
    if answer_needs_revision(answer,language,question):errors.append('language')
    kind=question_kind(question)
    if len(answer.split())>(60 if kind in ('off_topic','greeting') else 200):errors.append('length')
    if context and kind in ('grammar','comparison','analysis'):
        known=re.sub(r'[\s*。、！？!?]','',context+'\n'+question)
        sentences=re.findall(r'[ぁ-んァ-ヶ一-龯ー、]{8,}',answer)
        if any(re.sub(r'[\s*。、！？!?]','',sentence) not in known for sentence in sentences):
            errors.append('unverified_example')
    if kind=='translation' and re.search(r'(?:sang|ra)\s+tiếng\s+Nhật|into Japanese',question,re.I) and not re.search(r'[ぁ-んァ-ヶ一-龯]',answer):errors.append('missing_japanese_translation')
    if re.search(r'phủ định|negative',question,re.I) and not re.search(r'ない|ません|なかった|not\b|chưa (?:có|xác minh)',answer,re.I):errors.append('requested_negation')
    uncertain=bool(re.search(r'chưa (?:có|thể|xác minh)|chỉ xác minh|không (?:có|đủ) (?:dữ liệu|căn cứ)|not (?:enough|verified)|cannot verify|no checked|not available',answer,re.I))
    if not uncertain and kind=='vocabulary':
        if not re.search(r'[（(][ぁ-んァ-ヶー\s]+[）)]|(?:cách đọc|reading)\s*[:：*]+\s*[ぁ-んァ-ヶー]',answer,re.I):
            errors.append('vocabulary_reading')
    if not uncertain and kind in ('grammar','comparison'):
        if not re.search(r'ví dụ|example|→',answer,re.I):errors.append('example')
        if not re.search(r'[ぁ-ん]{2,}|[A-Z][a-z]+ [a-z]+',answer):errors.append('reading')
    if re.search(r'\b(?:GRAMMAR_EXPLANATION|TRANSLATION_TASK|KANJI_LOOKUP)\b',answer):errors.append('internal_labels')
    return errors


def scope_reply(question,language):
    injection=re.search(r'system prompt|in (?:lời nhắc|prompt)|bỏ qua quy tắc|hoàn toàn bằng tiếng trung|entirely in chinese',question,re.I)
    outside=question_kind(question)=='off_topic'
    learning=re.search(r'tiếng nhật|dịch|日本語|japanese|kanji',question,re.I)
    if injection or outside and not learning:
        return ('Tôi hỗ trợ học tiếng Nhật bằng tiếng Việt hoặc tiếng Anh. Yêu cầu này nằm ngoài phạm vi; bạn có thể hỏi về ngữ pháp, từ vựng hoặc dịch tiếng Nhật.' if language=='vi' else
                'I help with Japanese learning in English or Vietnamese. This request is outside that scope; you can ask about Japanese grammar, vocabulary or translation.')
    return None


def clarification(language):
    return ('Bạn muốn hỏi từ, mẫu ngữ pháp hoặc câu tiếng Nhật nào? Hãy gửi nội dung cần giải thích.' if language=='vi' else
            'Which Japanese word, grammar pattern or sentence would you like help with? Please share it.')


def localized_sources(sources,language):
    labels={'kanji_dictionary':('Từ điển Kanji','Kanji dictionary'),
            'vocabulary':('Từ điển từ vựng','Vocabulary dictionary'),
            'grammar_rule':('Mẫu ngữ pháp','Grammar pattern'),
            'grammar_reference':('Tham khảo ngữ pháp','Grammar reference'),
            'reviewed_translation':('Ví dụ dịch đã đối chiếu','Checked translation example')}
    result=[]
    for source in sources:
        if not public_source(source):continue
        label=labels.get(source.get('type'),('Thư viện học tập','Learning library'))[language=='en']
        anchors=' '.join(re.findall(r'[ぁ-んァ-ヶ一-龯ー]+',str(source.get('title',''))))
        suffix=anchors or (f"#{source['id']}" if source.get('id') is not None else '')
        result.append({**source,'title':label+(f': {suffix}' if suffix else '')})
    return result


def unverifiable_request(question):
    return bool(re.search(r'JLPT',question,re.I) and re.search(r'ngày nào|năm sau|năm nay|lịch thi',question,re.I)
        or re.search(r'trích.*trang\s*\d+.*(?:chưa|không).*cung cấp',question,re.I))


def uncertainty(language):
    return ('Mình chưa có đủ căn cứ trong học liệu hiện có để xác minh câu trả lời này. Bạn có thể cung cấp câu ví dụ, ngữ cảnh hoặc tài liệu gốc để mình đối chiếu không?' if language=='vi' else
            'I do not have enough verified material to answer this confidently. Please provide an example, context or the original source so I can check it.')
