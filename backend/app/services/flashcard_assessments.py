"""Server-generated private questions and deterministic grading; no model/rewards."""
import json
import random
import re
import unicodedata
import uuid
from pathlib import Path

from fastapi import HTTPException
from ..models.database import FlashcardAssessment as Assessment, FlashcardProgress as Progress, FlashcardSession as Study, FlashcardCard as Card
from . import flashcards as fc

DATA = json.loads((Path(__file__).resolve().parents[1] / 'data/flashcard_kana.json').read_text(encoding='utf-8'))
KANA = dict(zip(DATA['kana'].split(), DATA['romaji'].split()))


def hira(text):
    return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in fc.normalized(text))


def romaji(text):
    text = hira(text); result = ''; double = False; i = 0
    while i < len(text):
        char = text[i]
        if char == 'っ': double = True; i += 1; continue
        if char == 'ー':
            vowels = re.findall('[aeiou]', result)
            result += vowels[-1] if vowels else ''; i += 1; continue
        pair = text[i:i+2]; digraph = DATA['digraphs'].get(pair)
        part = digraph or KANA.get(char, char)
        if double: result += 't' if part[0] == 'c' else part[0]; double = False
        result += part; i += 2 if digraph else 1
    return result


def roman(text):
    text = fc.normalized(text)
    for source, target in [('ā','aa'),('ī','ii'),('ū','uu'),('ē','ee'),('ō','ou')]: text = text.replace(source,target)
    text = re.sub(r"['’\s]", '', text)
    for source, target in [('sya','sha'),('syu','shu'),('syo','sho'),('tya','cha'),('tyu','chu'),('tyo','cho'),('jya','ja'),('jyu','ju'),('jyo','jo'),('si','shi')]: text = text.replace(source,target)
    text = re.sub(r'(^|[^s])ti', r'\1chi', text)
    for source, target in [('tu','tsu'),('hu','fu'),('zi','ji'),('ou','oo')]: text = text.replace(source,target)
    return text


def accepts(answer, accepted):
    if not isinstance(answer, str): return False
    return any(hira(answer) == hira(expected) or (re.fullmatch(r'[ぁ-ゖー\s]+', hira(expected)) and roman(answer) == roman(romaji(expected))) for expected in accepted)


def public_question(q, reveal=False):
    keys = ['id', 'type', 'prompt', 'options', 'targets', 'candidate']
    if reveal: keys += ['expected', 'accepted', 'reading']
    return {k:q[k] for k in keys if k in q}


def view(row):
    return {'id':row.id, 'deck_id':row.deck_id, 'mode':row.mode, 'status':row.status,
        'questions':[public_question(q,row.mode=='learn' or row.status=='completed') for q in row.questions], 'result':row.result}


def generate(cards, progress, mode, count, types, rng, distractor_bank=None):
    pool=list(cards); rng.shuffle(pool); questions=[]
    while pool and len(questions)<count:
        card=pool.pop(0); index=len(questions)
        kind=types[index%len(types)] if mode=='test' else ('typed' if (progress.get(card.id) and progress[card.id].stage>=1) else 'choice')
        q={'id':str(uuid.uuid4()),'type':kind,'prompt':card.back,'card_ids':[card.id],
            'accepted':list(dict.fromkeys([card.front,*[value.strip() for value in re.split(r'[、,;/\n]+',card.reading or '') if value.strip()]])), 'reading':card.reading}
        valid_forms={hira(value) for value in q['accepted']}
        valid_readings={roman(romaji(value)) for value in q['accepted'] if re.fullmatch(r'[ぁ-ゖー\s]+',hira(value))}
        distractors={hira(c.front):c.front for c in (distractor_bank or cards) if hira(c.front) not in valid_forms and roman(c.front) not in valid_readings}
        choices=list(distractors.values()); rng.shuffle(choices)
        if kind=='match':
            selected=[card]; unique={hira(card.front)}; meanings={fc.normalized(card.back)}
            for other in list(pool):
                if len(selected)>=4: break
                if hira(other.front) not in unique and fc.normalized(other.back) not in meanings:
                    selected.append(other); pool.remove(other); unique.add(hira(other.front)); meanings.add(fc.normalized(other.back))
            if len(selected)>1:
                targets=[]; options=[]; expected={}; bindings={}
                for c in selected:
                    left=str(uuid.uuid4()); right=str(uuid.uuid4())
                    targets.append({'id':left,'label':c.back}); options.append({'id':right,'label':c.front})
                    expected[left]=right; bindings[left]=c.id
                rng.shuffle(options)
                q.update(prompt='',targets=targets,options=options,expected=expected,bindings=bindings,card_ids=[c.id for c in selected])
            else: q['type']='typed'
        elif kind in ('choice','true_false'):
            if not choices: q['type']='typed'
            elif kind=='choice':
                options=[{'id':str(uuid.uuid4()),'label':c} for c in [card.front,*choices[:3]]]
                q['expected']=options[0]['id']; rng.shuffle(options); q['options']=options
            else:
                truth=rng.choice([True,False]); q.update(candidate=card.front if truth else choices[0],expected=truth)
        if q['type']=='typed': q['expected']=card.front
        q['fingerprints']={str(c.id):c.fingerprint for c in cards if c.id in q['card_ids']}
        questions.append(q)
    return questions


def create(db,user_id,body):
    fc.lock_owner(db,user_id)
    payload=body.model_dump(); hashed=fc.digest(payload)
    old=db.query(Assessment).filter_by(user_id=user_id,request_key=body.request_id).first()
    if old:
        if old.payload_hash!=hashed: raise HTTPException(409,'flashcards.requestConflict')
        return old
    fc.owned(db,user_id,body.deck_id)
    cards=fc.card_rows(db,body.deck_id)
    if not cards: raise HTTPException(422,'flashcards.emptyCards')
    # Bound abandoned active snapshots instead of allowing unlimited large writes.
    if db.query(Assessment).filter_by(user_id=user_id,status='active').count()>=100:
        raise HTTPException(422,'flashcards.activeLimit')
    progress={p.card_id:p for p in db.query(Progress).join(Card,Card.id==Progress.card_id).filter(Card.deck_id==body.deck_id,Progress.user_id==user_id)}
    if body.mode=='learn':
        clock=fc.now().replace(tzinfo=None)
        cards.sort(key=lambda c:(0 if progress.get(c.id) and progress[c.id].due_at and progress[c.id].due_at.replace(tzinfo=None)<=clock else 1 if c.id not in progress or progress[c.id].state=='new' else 2,c.position))
        start=(body.round_index*7)%len(cards)
        selected=(cards[start:]+cards[:start])[:7]
        # Distractors come from the full deck even in a small final round.
        questions=generate(selected,progress,'learn',len(selected),['choice'],random.Random(),cards)
    else: questions=generate(cards,progress,'test',body.count,body.types,random.Random())
    row=Assessment(id=str(uuid.uuid4()),user_id=user_id,deck_id=body.deck_id,request_key=body.request_id,payload_hash=hashed,mode=body.mode,status='active',questions=questions)
    db.add(row); db.commit(); return row


def owned(db,user_id,key):
    row=db.query(Assessment).filter_by(user_id=user_id,id=key).first()
    if row is None: raise HTTPException(404,'flashcards.notFound')
    return row


def grade(q,answer):
    if q['type']=='typed': return accepts(answer,q['accepted'])
    if q['type']=='match': return isinstance(answer,dict) and set(answer)==set(q['expected']) and all(answer[k]==v for k,v in q['expected'].items())
    return type(answer) is type(q['expected']) and answer==q['expected']


def submit(db,user_id,key,body):
    fc.lock_owner(db,user_id); row=owned(db,user_id,key); hashed=fc.digest(body.model_dump())
    if row.status=='completed':
        if row.submission_hash!=hashed: raise HTTPException(409,'flashcards.requestConflict')
        return view(row)
    if row.status!='active': raise HTTPException(409,'flashcards.closedSession')
    questions={q['id']:q for q in row.questions}; seen=set(); verdicts={}; reports=[]
    if row.mode=='test' and len(body.answers)!=len(questions): raise HTTPException(422,'flashcards.invalidAnswers')
    for response in body.answers:
        q=questions.get(response.question_id)
        if q is None or row.mode=='test' and response.question_id in seen: raise HTTPException(422,'flashcards.invalidAnswers')
        seen.add(q['id']); correct=grade(q,response.answer)
        reports.append({'question_id':q['id'],'correct':correct,'answer':response.answer,'expected':q['expected'],'accepted':q.get('accepted',[]),'reading':q.get('reading','')})
        for cid in q['card_ids']:
            per_card=correct
            if q['type']=='match':
                target=next(t for t,c in q['bindings'].items() if c==cid)
                per_card=isinstance(response.answer,dict) and response.answer.get(target)==q['expected'][target]
            # Same-round recovery never erases a first error from the spaced review plan.
            verdicts[cid]=verdicts.get(cid,True) and per_card
    if not body.answers: raise HTTPException(422,'flashcards.invalidAnswers')
    existing={c.id:c.fingerprint for c in fc.card_rows(db,row.deck_id)}
    if not set(verdicts)<=set(existing) or any(existing.get(cid)!=q['fingerprints'].get(str(cid)) for q in row.questions for cid in q['card_ids'] if cid in verdicts):
        raise HTTPException(409,'flashcards.invalidCards')
    clock=fc.now()
    for cid,correct in verdicts.items():
        progress=db.get(Progress,(user_id,cid))
        if progress is None: progress=Progress(user_id=user_id,card_id=cid,starred=False); db.add(progress)
        fc.schedule(progress,correct,clock)
    correct=sum(verdicts.values())
    result={'total':len(verdicts),'correct':correct,'wrong':len(verdicts)-correct,'accuracy':round(correct*100/len(verdicts)), 'questions':reports}
    db.add(Study(user_id=user_id,request_key='assessment-'+row.id,payload_hash=hashed,mode=row.mode,card_count=len(verdicts),correct=correct,wrong=len(verdicts)-correct,duration_seconds=body.duration_seconds,
        results=[{'card_id':cid,'deck_id':row.deck_id,'correct':value} for cid,value in verdicts.items()]))
    row.status='completed'; row.submission_hash=hashed; row.result=result
    db.commit(); return view(row)
