"""Bounded local knowledge adapters; no benchmark answers or model-generated facts."""
import re
from functools import lru_cache
from ..models.database import GrammarRule,Vocabulary,Document
from .kanji_dictionary_service import kanji_dictionary_service
from .grammar_grounded import grounded_patterns
from .chat_quality import question_kind


@lru_cache(maxsize=2048)
def reading(text):
    from pykakasi import kakasi
    return ''.join(part['hira'] for part in kakasi().convert(text))


def example_lines(examples,language='vi'):
    rows=[]
    for example in examples[:2]:
        ja=example.get('ja') or example.get('word') or example.get('japanese')
        meaning=example.get('vi') or example.get('meaning_vi') or example.get('meaning') if language=='vi' else example.get('en') or example.get('meaning_en')
        if ja and meaning:
            rows.append(f"- {ja}\n  ({example.get('reading') or reading(ja)}) → {meaning}")
    return '\n'.join(rows)


def normalize_pattern(text):
    return re.sub(r'[～〜~\s＋+（）()VＮN]','',text)


def local_translation(db,question,language):
    if language!='vi':return '',[],None
    to_japanese=bool(re.search(r'(?:sang|ra)\s+tiếng\s+Nhật',question,re.I))
    if ':' in question:
        sentence=question.split(':',1)[1].strip(' “”、。.!?\n')
    else:
        sentence=re.split(r'\bdịch\b|\bcó nghĩa là gì',question,flags=re.I)[0].strip(' “”、。.!?\n')
    canonical=lambda text:re.sub(r'[\s。.!?、]','',text).lower()
    if not sentence:return '',[],None
    for row in db.query(GrammarRule).order_by(GrammarRule.id).limit(200).all():
        for example in row.examples or []:
            ja,vi=example.get('ja'),example.get('vi')
            if not ja or not vi:continue
            original,target=(vi,ja) if to_japanese else (ja,vi)
            if canonical(original)!=canonical(sentence):continue
            answer=f'**Bản dịch:** {target}\n\n**Câu tiếng Nhật:** {ja}\n**Cách đọc:** {reading(ja)}\n**Nghĩa:** {vi}'
            return answer,[{'title':f'Ví dụ ngữ pháp: {row.rule_name}','type':'reviewed_translation','url':'/grammar','relevance':1.0}],answer
    return '',[],None


def local_knowledge(db,question,language):
    """Returns context, public sources, a safe offline answer (possibly partial)."""
    kind=question_kind(question)
    chunks=re.findall(r'[ぁ-んァ-ヶ一-龯ー]+',question)
    if kind=='vocabulary' or re.search(r'đọc thế nào|trong từ',question,re.I) or kind=='general' and any(len(x)>1 for x in chunks):
        words=db.query(Vocabulary).filter(Vocabulary.japanese_word.in_(chunks)).order_by(Vocabulary.id).limit(3).all() if chunks else []
        entries=[]
        for word in words:
            if language=='vi':entries.append({'word':word.japanese_word,'reading':word.reading,'meaning':word.meaning,'examples':word.example_sentences or [],'level':word.jlpt_level})
        if not entries:
            dictionary,_=kanji_dictionary_service.list_entries(limit=10000)
            for entry in dictionary:
                for ex in entry.get('examples',[]):
                    if ex.get('word') in chunks and (language=='vi' or ex.get('meaning_en')):
                        entries.append({'word':ex['word'],'reading':ex.get('reading') or reading(ex['word']),
                            'meaning':ex.get('meaning_vi') or ex.get('meaning') if language=='vi' else ex.get('meaning_en'),
                            'examples':[],'level':entry['jlpt']})
        if entries:
            unique={e['word']:e for e in entries};entry=next(iter(unique.values()))
            meaning=entry['meaning']
            label='Nghĩa' if language=='vi' else 'Meaning'
            answer=f"**{entry['word']}** ({entry['reading']})\n\n**{label}:** {meaning}"
            examples=example_lines(entry['examples'],language)
            if examples:answer+=f"\n\n**{'Ví dụ' if language=='vi' else 'Example'}:**\n{examples}"
            else:answer+='\n\n'+('Chưa có câu ví dụ đã đối chiếu cho từ này trong kho hiện tại.' if language=='vi' else 'No checked example sentence is available in the current catalog.')
            sources=[{'title':f"Từ điển: {entry['word']}",'type':'vocabulary','url':'/library','relevance':1.0}]
            return answer,sources,answer
    if kind=='grammar':
        candidates=db.query(GrammarRule).order_by(GrammarRule.id).limit(201).all()
        q=normalize_pattern(question).replace('てはいけません','てはいけない')
        matches=[row for row in candidates if len(normalize_pattern(row.japanese_pattern))>=2 and normalize_pattern(row.japanese_pattern) in q]
        if matches:
            rule=max(matches,key=lambda r:len(normalize_pattern(r.japanese_pattern)))
            if language=='vi':
                notes=(rule.usage_notes or '').strip()
                if notes==rule.meaning.strip():notes=''
                answer=f"**Cấu trúc:** {rule.japanese_pattern}\n\n**Ý nghĩa và cách dùng:** {rule.meaning}"
                if notes:answer+='\n'+notes
                examples=example_lines(rule.examples or [],language)
                if examples:answer+='\n\n**Ví dụ:**\n'+examples
                source={'title':f'Ngữ pháp: {rule.rule_name}','type':'grammar_rule','url':'/grammar','jlpt_level':rule.jlpt_level,'relevance':1.0}
                return answer,[source],answer
    if kind=='analysis':
        points=grounded_patterns(question,language)
        if points:
            heading='Các cấu trúc nhận diện trong câu' if language=='vi' else 'Identified structures in the sentence'
            note='Chỉ xác minh các thành phần dưới đây; chưa xác minh bản dịch toàn câu.' if language=='vi' else 'Only these forms are identified; a full sentence translation has not been verified.'
            answer=f'**{heading}:**\n\n'+ '\n'.join(f"- {p['pattern']}: {p['explanation']}" for p in points)+'\n\n'+note
            sources=[{'title':f"Ngữ pháp: {p['pattern']}",'type':'grammar_reference','url':'/grammar','relevance':1.0} for p in points[:3]]
            return answer,sources,answer
    return '',[],None


def library_knowledge(db,question,language):
    """Exact anchors before vector search; never use similarity alone as proof."""
    if language!='vi' or question_kind(question) not in ('culture','grammar','vocabulary','comparison'):
        return '',[],None
    anchors=re.findall(r'[ぁ-んァ-ヶ一-龯ー]{2,}',question)
    anchors += [word for word in ('cúi chào','giày','いただきます','trà đạo','phân loại rác','đi tàu') if word in question.lower()]
    if not anchors:return '',[],None
    candidates=[]
    for row in db.query(Document).order_by(Document.id).limit(300).all():
        if row.document_type not in ('grammar','vocabulary','culture','lesson','example'):continue
        text=row.title+'\n'+row.content
        if not any(anchor.lower() in text.lower() for anchor in anchors):continue
        if question_kind(question)=='comparison' and not all(anchor.lower() in text.lower() for anchor in anchors):continue
        paragraphs=re.split(r'\n\s*\n',row.content)
        selected=[p for p in paragraphs if any(a.lower() in p.lower() for a in anchors)]
        if not selected:continue
        excerpt='\n\n'.join(selected)[:1600]
        candidates.append((sum(a.lower() in text.lower() for a in anchors),row,excerpt))
    if not candidates:return '',[],None
    _,row,excerpt=max(candidates,key=lambda item:(item[0],-item[1].id))
    answer='**Đoạn học liệu liên quan:**\n\n'+excerpt+'\n\nĐây là nội dung tra cứu trong thư viện; các quy định có thể khác theo tình huống hoặc địa phương.'
    return excerpt,[{'id':row.id,'title':row.title,'type':row.document_type,'url':row.source_url or f'/library?doc_id={row.id}','relevance':1.0}],answer
