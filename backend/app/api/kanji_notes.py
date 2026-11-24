import json
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User,UserKanjiNote
from ..services.kanji_dictionary_service import kanji_dictionary_service

router=APIRouter(prefix='/kanji-notes',tags=['kanji notes'])
def validate_kanji(key):
    if len(key)!=1 or not (0x3400<=ord(key)<=0x9fff or 0xf900<=ord(key)<=0xfaff or 0x20000<=ord(key)<=0x3347f or ord(key)==0x3007):
        raise HTTPException(422,'kanji_note_invalid_character')

@lru_cache(maxsize=1)
def readings():
    path=Path(__file__).resolve().parents[1]/'data/kanji_vietnamese_readings.json'
    return json.loads(path.read_text(encoding='utf-8')).get('entries',{}) if path.is_file() else {}

def result(db,user,key):
    entry=kanji_dictionary_service.get_entry(key)
    note=db.query(UserKanjiNote).filter_by(user_id=user.id,kanji=key).first()
    return {'kanji':key,'dictionary':entry,'defaults':{'sino_vietnamese':readings().get(key,''),'meaning_vi':(entry or {}).get('meaning_vi','')},
        'note':{'sino_vietnamese':note.sino_vietnamese,'meaning_vi':note.meaning_vi,'mnemonic':note.mnemonic,'updated_at':note.updated_at} if note else None,
        'reading_source':({'title':'SenpaiAI','url':'/kanji'} if key=='際' else {'title':'Unicode Unihan kVietnamese','url':'https://www.unicode.org/reports/tr38/','license':'Unicode-3.0'})}

class NoteRequest(BaseModel):
    sino_vietnamese:str=Field(default='',max_length=80)
    meaning_vi:str=Field(default='',max_length=2000)
    mnemonic:str=Field(default='',max_length=2000)

@router.get('/{kanji}')
def get_note(kanji:str,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    validate_kanji(kanji);return result(db,user,kanji)

@router.put('/{kanji}')
def save_note(kanji:str,body:NoteRequest,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    validate_kanji(kanji)
    db.query(User.id).filter_by(id=user.id).with_for_update().one()
    row=db.query(UserKanjiNote).filter_by(user_id=user.id,kanji=kanji).first()
    if row is None:row=UserKanjiNote(user_id=user.id,kanji=kanji);db.add(row)
    for name,value in body.model_dump().items():setattr(row,name,value.strip())
    db.commit();return result(db,user,kanji)
