"""Bounded local knowledge adapters; no benchmark answers or model-generated facts."""
import re
from functools import lru_cache
from ..models.database import GrammarRule,GrammarQuestion,Vocabulary,Document
from .kanji_dictionary_service import kanji_dictionary_service
from .grammar_grounded import grounded_patterns
from .chat_quality import question_kind
from .chat_language import ENGLISH_WORDS, VIETNAMESE_WORDS, _fold
from .chat_grounding import CHAT_DOCUMENT_TYPES, GENERIC_QUERY_STOPWORDS
from . import vocab_mcq_service


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
    normalized=re.sub(r'[～〜~\s＋+（）()VＮN]','',text)
    for polite,base in (('ています','ている'),('でいます','でいる'),('たことがあります','たことがある'),
                        ('てはいけません','てはいけない'),('てもいいです','てもいい')):
        normalized=normalized.replace(polite,base)
    return normalized


def local_translation(db,question,language):
    to_japanese=bool(re.search(r'(?:sang|ra)\s+tieng\s+Nhat|(?:into|to) Japanese',_fold(question),re.I))
    if ':' in question:
        sentence=question.split(':',1)[1].strip(' “”、。.!?\n')
    else:
        sentence=re.split(r'\bdịch\b|\bcó nghĩa là gì',question,flags=re.I)[0].strip(' “”、。.!?\n')
    canonical=lambda text:re.sub(r'[\s。.!?、]','',text).lower()
    if not sentence:return '',[],None
    for row in db.query(GrammarRule).order_by(GrammarRule.id).limit(200).all():
        for example in row.examples or []:
            ja=example.get('ja');meaning=example.get('vi') if language=='vi' else example.get('en')
            if not ja or not meaning:continue
            original,target=(meaning,ja) if to_japanese else (ja,meaning)
            if canonical(original)!=canonical(sentence):continue
            labels=('Bản dịch','Câu tiếng Nhật','Cách đọc','Nghĩa')if language=='vi'else('Translation','Japanese sentence','Reading','Meaning')
            answer=f'**{labels[0]}:** {target}\n\n**{labels[1]}:** {ja}\n**{labels[2]}:** {reading(ja)}\n**{labels[3]}:** {meaning}'
            return answer,[{'title':f'Ví dụ ngữ pháp: {row.rule_name}','type':'reviewed_translation','url':'/grammar','relevance':1.0}],answer
    return '',[],None


def local_knowledge(db,question,language):
    """Returns context, public sources, a safe offline answer (possibly partial)."""
    kind=question_kind(question)
    chunks=re.findall(r'[ぁ-んァ-ヶ一-龯ー]+',question)
    # Resolve all supported lexicon MCQs through the catalog, never a question string.
    mcq=vocab_mcq_service.try_answer(question) if kind in ('exercise','vocabulary') else None
    if mcq:
        entry=vocab_mcq_service.lookup_vocab(mcq.target)
        meanings=entry.vi if language=='vi' else entry.en
        label='Đáp án'if language=='vi'else'Answer'
        answer=(f'**{label}: {mcq.matched_label}. {mcq.matched_text}**\n\n'if mcq.matched_label else '')+f'**{entry.kanji}** ({entry.kana}) → '+', '.join(meanings)
        if language=='vi':answer+=f'\n\nVí dụ: {entry.example_ja}\n({reading(entry.example_ja)}) → {entry.example_vi}'
        else:answer+='\n\nNo checked English example translation is available in this catalog.'
        return answer,[{'title':entry.kanji,'type':'vocabulary','url':'/library','relevance':1.0}],answer
    if kind=='vocabulary' or re.search(r'doc the nao|trong tu',_fold(question),re.I):
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
    if kind in ('grammar','comparison','exercise'):
        candidates=db.query(GrammarRule).order_by(GrammarRule.id).limit(201).all()
        q=normalize_pattern(question).replace('てはいけません','てはいけない')
        matches=[row for row in candidates if len(normalize_pattern(row.japanese_pattern))>=2 and normalize_pattern(row.japanese_pattern) in q]
        if matches and kind=='exercise':
            ids=[r.id for r in matches]
            exercise=db.query(GrammarQuestion).filter(GrammarQuestion.grammar_rule_id.in_(ids),GrammarQuestion.is_active==True,
                GrammarQuestion.source.in_(('seed','manual')),GrammarQuestion.created_by_user_id.is_(None)).order_by(GrammarQuestion.id).first()
            if exercise:
                labels=('Bài tập mẫu','Đáp án đã lưu')if language=='vi'else('Question-bank example','Stored answer')
                import json
                answer=f'**{labels[0]}:** {exercise.prompt}\n\n**{labels[1]}:** '+json.dumps(exercise.correct_answer,ensure_ascii=False)
                if language=='vi':answer+='\n\n'+exercise.explanation_vi
                return answer,[{'title':matches[0].japanese_pattern,'type':'grammar_rule','url':'/grammar','relevance':1.0}],answer
        if matches:
            rule=max(matches,key=lambda r:len(normalize_pattern(r.japanese_pattern)))
            if kind=='comparison' and len(matches)>=2:
                blocks=[]
                for row in sorted(matches,key=lambda r:-len(normalize_pattern(r.japanese_pattern)))[:2]:
                    blocks.append(f'**{row.japanese_pattern}:** {row.meaning}\n'+example_lines(row.examples or [],language))
                context='\n\n'.join(blocks)
                return context,[{'title':row.japanese_pattern,'type':'grammar_rule','url':'/grammar','relevance':1.0}for row in matches[:2]],None
            if language=='vi' and kind=='grammar':
                notes=(rule.usage_notes or '').strip()
                if notes==rule.meaning.strip():notes=''
                answer=f"**Cấu trúc:** {rule.japanese_pattern}\n\n**Ý nghĩa và cách dùng:** {rule.meaning}"
                if notes:answer+='\n'+notes
                examples=example_lines(rule.examples or [],language)
                if examples:answer+='\n\n**Ví dụ:**\n'+examples
                source={'title':f'Ngữ pháp: {rule.rule_name}','type':'grammar_rule','url':'/grammar','jlpt_level':rule.jlpt_level,'relevance':1.0}
                return answer,[source],answer
            if language=='en':
                points=grounded_patterns(rule.japanese_pattern,'en')
                if points:
                    explanation=' '.join(p['explanation']for p in points)
                    examples=example_lines(rule.examples or [],'en')
                    answer=f'**Formula:** {rule.japanese_pattern}\n\n**Meaning and usage:** {explanation}'
                    answer+='\n\n**Example:**\n'+examples if examples else '\n\nNo checked example with an English meaning is available.'
                    return answer,[{'title':rule.japanese_pattern,'type':'grammar_rule','url':'/grammar','relevance':1.0}],answer
                return f'{rule.japanese_pattern}: {rule.meaning}\n'+example_lines(rule.examples or [],'vi'),[{'title':rule.japanese_pattern,'type':'grammar_rule','url':'/grammar','relevance':1.0}],None
    if kind in ('analysis','grammar'):
        points=grounded_patterns(question,language)
        if points:
            heading='Các cấu trúc nhận diện trong câu' if language=='vi' else 'Identified structures in the sentence'
            if kind=='grammar':heading='Cấu trúc và cách dùng đã đối chiếu'if language=='vi'else'Formula and checked usage'
            if kind == 'analysis':
                note = ('Chỉ xác minh các thành phần dưới đây; chưa xác minh bản dịch toàn câu.'
                        if language == 'vi' else 'Only these forms are identified; a full sentence translation has not been verified.')
            else:
                note = ('Chưa có ví dụ đã đối chiếu cho mẫu này trong kho hiện tại.'
                        if language == 'vi' else 'No checked example is available for this form in the current catalog.')
            answer=f'**{heading}:**\n\n'+ '\n'.join(f"- {p['pattern']}: {p['explanation']}" for p in points)+'\n\n'+note
            sources=[{'title':f"Ngữ pháp: {p['pattern']}",'type':'grammar_reference','url':'/grammar','relevance':1.0} for p in points[:3]]
            return answer,sources,answer
    return '',[],None


def library_knowledge(db,question,language):
    """Find passages with Japanese anchors or substantial topic-word overlap."""
    kind = question_kind(question)
    if kind not in ('culture', 'grammar', 'vocabulary', 'comparison', 'exercise', 'conversation'):
        return '',[],None
    anchors=re.findall(r'[ぁ-んァ-ヶ一-龯ー]{2,}',question)
    anchors += [word for word in ('cui chao','giay','いただきます','tra dao','phan loai rac','di tau','furigana','keigo','jlpt','the te') if word in _fold(question)]
    stopwords = ({_fold(word) for word in GENERIC_QUERY_STOPWORDS} | ENGLISH_WORDS | VIETNAMESE_WORDS
                 | {'conversation', 'dialogue', 'hoi', 'thoai', 'di', 'tai'})
    terms = set(re.findall(r'[a-z]{2,}', _fold(question))) - stopwords
    if not anchors and len(terms) < 2:
        return '', [], None
    candidates=[]
    rows = db.query(Document).filter(
        Document.user_id.is_(None), Document.document_type.in_(CHAT_DOCUMENT_TYPES),
    ).order_by(Document.id).limit(300)
    for row in rows:
        title = _fold(row.title)
        text = _fold(row.title + '\n' + row.content)
        anchor_hits = sum(_fold(anchor) in text for anchor in anchors)
        if anchors and (not anchor_hits or kind == 'comparison' and anchor_hits != len(anchors)):
            continue
        title_hits = len(terms.intersection(re.findall(r'[a-z]{2,}', title)))
        topic_hits = len(terms.intersection(re.findall(r'[a-z]{2,}', text)))
        if not anchors and (topic_hits < 2 or topic_hits * 3 < len(terms) * 2):
            continue
        paragraphs = re.split(r'\n\s*\n', row.content)
        def passage_score(paragraph):
            folded = _fold(paragraph)
            return sum(_fold(anchor) in folded for anchor in anchors) * 3 + len(
                terms.intersection(re.findall(r'[a-z]{2,}', folded))
            )
        selected = sorted(paragraphs, key=passage_score, reverse=True)
        excerpt = '\n\n'.join(p for p in selected[:2] if passage_score(p) or title_hits)[:1000].strip()
        if excerpt:
            candidates.append(((anchor_hits, title_hits, topic_hits, kind == 'conversation' and row.document_type == kind), row, excerpt))
    if not candidates:return '',[],None
    _,row,excerpt=max(candidates,key=lambda item:(item[0],-item[1].id))
    answer='**Đoạn học liệu liên quan**\n\n'+excerpt
    return excerpt,[{'id':row.id,'title':row.title,'type':row.document_type,'url':row.source_url or f'/library?doc_id={row.id}',
                    'jlpt_level':row.jlpt_level,'relevance':1.0}],answer if language=='vi' else None
