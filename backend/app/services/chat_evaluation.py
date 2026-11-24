"""Fixed automatic rubric, separate from answer generation; semantics still require review."""
import re
import unicodedata
from collections import defaultdict
from statistics import mean

RUBRIC_VERSION='chat-quality-v2'
INTERNAL=re.compile(r'(?im)(?:^|\n)\s*(?:\*\*)?(?:Intent|Task|Output|Classification|Reviewed reference|Conversation context|Nguồn \d+)\s*[:：]|===.*(?:THAM KHẢO|REFERENCE).*===')
CHINESE=re.compile(r'动词|形容词|名词|助词|连体|这个|这是|因为|所以|我们|你们|学习|语法|谢谢|请问|汉语|中文')


def folded(text):
    return unicodedata.normalize('NFC',''.join(c for c in unicodedata.normalize('NFD',text.lower().replace('đ','d')) if unicodedata.category(c)!='Mn' or c in '\u3099\u309a'))


def grade(case,answer,sources,error=None):
    text=folded(answer); group=case['group']; language=case.get('language','vi')
    vi=len(re.findall(r'\b(?:la|cua|ban|toi|nghia|dich|cau|ngu|dau|nguoi|hoc|nay|khong|trong|voi|duoc|chua|mot|tieng|dung)\b',text))
    en=len(re.findall(r'\b(?:the|is|are|this|that|you|your|can|cannot|meaning|means|sentence|explanation|subject|topic|because|would)\b',text))
    language_ok=bool(answer.strip()) and ((en<4 or vi>=en) if language=='vi' else (vi<4 or en>=vi))
    if group=='vi_ja': language_ok=language_ok and bool(re.search(r'[ぁ-んァ-ヶ]',answer))
    content=all(any(folded(term) in text for term in options) for options in case['required'])
    content=content and not any(folded(term) in text for term in case.get('forbidden',[]))
    # Ordinary Vietnamese/English prose is not a pronunciation guide. Require
    # kana/romaji in parentheses or an explicit reading label.
    reading=bool(re.search(r'[（(][^\n()（）]*(?:[ぁ-ん]{2,}|[A-Za-z]{2,}(?: [A-Za-z]+)+)[^\n()（）]*[）)]',answer)
        or re.search(r'(?:cách đọc|reading|romaji|onyomi|kunyomi|âm on|âm kun)\s*[:：*]*[^\n]*[ぁ-んA-Za-z]',answer,re.I))
    if case.get('examples'):
        reading=reading and bool(re.search(r'→|nghĩa|dịch|ví dụ|\):|：',answer,re.I))
    elif not case.get('reading'): reading=True
    structure=bool(answer.strip())
    if group=='grammar': structure=bool(re.search(r'cấu trúc|mẫu|cách dùng|ý nghĩa|diễn tả',answer,re.I)) and bool(re.search(r'ví dụ|例|→',answer,re.I))
    if group=='comparison': structure=all(any(term in answer for term in opts) for opts in case['required'][:2]) and bool(re.search(r'ví dụ|→|khác|trong khi',answer,re.I))
    if group=='analysis': structure=bool(re.search(r'ngữ pháp|cấu trúc|chủ đề|trợ từ|thành phần',answer,re.I))
    if group=='greeting': structure=len(answer.split())<=75
    if group in ('ja_vi','vi_ja'): structure=bool(answer.strip()) and not bool(re.search(r'Intent:|Cấu trúc chuẩn|USER QUESTION',answer,re.I))
    public=[s for s in sources if not any(k in str(s.get('type','')).lower() for k in ('internal','system_rule','deterministic'))]
    source_ok=len(public)==len(sources)
    terms=case.get('source_terms',[])
    if terms:
        source_ok=source_ok and bool(public) and all(any(folded(term) in folded(str(s.get('title',''))) for term in terms) for s in public)
    else:
        source_ok=source_ok and (not public if group in ('greeting','off_topic','uncertain') else True)
    checks={'language':language_ok,'structure':structure,'no_internal_labels':not bool(INTERNAL.search(answer)),
            'no_chinese_prose':not bool(CHINESE.search(answer)),'content_keywords':content,'reading_and_meaning':reading,
            'relevant_sources':source_ok}
    if error: checks={key:False for key in checks}
    return checks


def summarize(rows):
    groups=defaultdict(list)
    for row in rows:groups[row['group']].append(row)
    def stats(items):
        durations=sorted(r['seconds'] for r in items)
        return {'cases':len(items),'automatic_score':round(100*mean(mean(r['checks'].values()) for r in items),2),
            'all_checks_passed':sum(all(r['checks'].values()) for r in items),'content_keyword_passed':sum(r['checks']['content_keywords'] for r in items),
            'errors':sum(bool(r['error']) for r in items),'mean_seconds':round(mean(durations),3),
            'p95_seconds':round(durations[min(len(durations)-1,int(len(durations)*.95))],3),
            'criteria':{key:round(100*mean(r['checks'][key] for r in items),2) for key in items[0]['checks']}}
    return {'overall':stats(rows),'groups':{key:stats(items) for key,items in groups.items()},
            'failed_ids':[r['id'] for r in rows if not all(r['checks'].values())]}
