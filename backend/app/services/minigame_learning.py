import json,re
from functools import lru_cache
from pathlib import Path
from sqlalchemy import func,case
from ..models.database import MinigameLearningEvent
from .kanji_dictionary_service import kanji_dictionary_service
GAMES=('falling','shiritori','cipher','memory','battle','workshop','wordsearch','ninja','missing')

@lru_cache(maxsize=1)
def words():
    data=json.loads((Path(__file__).resolve().parents[1]/'data/minigame_words.json').read_text(encoding='utf-8'))
    return {w['id']:w for w in data['words']}

@lru_cache(maxsize=2048)
def canonical(kind,key):
    if kind=='kanji':
        entry=kanji_dictionary_service.get_entry(key)
        if entry:return {'id':key,'kind':kind,'label':key,'reading':next(iter(entry['onyomi']+entry['kunyomi']),''),'meaning':entry['meaning_vi'],'level':entry['jlpt']}
    if kind=='word' and key in words():
        row=words()[key];return {'id':key,'kind':kind,'label':row['word'],'reading':row['reading'],'meaning':row.get('meaning',''),'level':row['level']}
    if kind=='kana' and re.fullmatch('[ぁ-ゖァ-ヶ]',key):return {'id':key,'kind':kind,'label':key,'reading':key,'meaning':'','level':None}
    if kind=='mechanic' and key.split(':')[0] in GAMES:return {'id':key,'kind':kind,'label':key.split(':')[0],'reading':'','meaning':'','level':None}
    return None

def pending_wrong_counts(db,user_id,kind):
    m=MinigameLearningEvent
    wrong=func.max(case((m.action=='wrong',m.id)));reviewed=func.max(case((m.action=='reviewed',m.id)))
    rows=db.query(m.source_id,func.sum(case((m.action=='wrong',1),else_=0))).filter(m.user_id==user_id,m.source_type==kind).group_by(m.source_id).having((reviewed.is_(None))|(wrong>reviewed)).all()
    return {key:int(count) for key,count in rows}

def review_items(db,user_id,limit=100,offset=0,due_only=True):
    model=MinigameLearningEvent
    last_wrong=func.max(case((model.action=='wrong',model.created_at)))
    last_review=func.max(case((model.action=='reviewed',model.created_at)))
    query=db.query(model.source_type,model.source_id,func.sum(case((model.action=='wrong',1),else_=0)),last_wrong,last_review).filter(model.user_id==user_id).group_by(model.source_type,model.source_id)
    if due_only:
        wrong_id=func.max(case((model.action=='wrong',model.id)));review_id=func.max(case((model.action=='reviewed',model.id)))
        query=query.having((review_id.is_(None)) | (wrong_id>review_id))
    total=query.count();rows=query.order_by(last_wrong.desc(),model.source_type,model.source_id).offset(offset).limit(limit).all()
    items=[]
    for kind,key,count,wrong,reviewed in rows:
        entry=canonical(kind,key)
        if entry:items.append({**entry,'wrong_count':count,'last_wrong_at':wrong,'last_reviewed_at':reviewed})
    return {'items':items,'total':total,'offset':offset,'limit':limit,'has_more':offset+limit<total}
