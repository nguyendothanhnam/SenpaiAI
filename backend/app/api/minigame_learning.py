from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User,MinigameLearningEvent
from ..services.minigame_learning import canonical,review_items,GAMES
router=APIRouter(prefix='/minigames',tags=['minigame learning'])

class EventRequest(BaseModel):
    event_id:str=Field(min_length=1,max_length=180)
    game:Literal['falling','shiritori','cipher','memory','battle','workshop','wordsearch','ninja','missing','review']
    level:Literal['N5','N4','N3','N2','N1']
    source_type:Literal['kanji','word','kana','mechanic']
    source_id:str=Field(min_length=1,max_length=80)
    action:Literal['wrong','reviewed']
    answer:str=Field(default='',max_length=120)
class SyncRequest(BaseModel):
    events:list[EventRequest]=Field(min_length=1,max_length=100)

@router.post('/learning-events')
def sync(body:SyncRequest,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    db.query(User.id).filter_by(id=user.id).with_for_update().one()
    keys=[e.event_id for e in body.events]
    existing={e.event_key:e for e in db.query(MinigameLearningEvent).filter(MinigameLearningEvent.user_id==user.id,MinigameLearningEvent.event_key.in_(keys)).all()}
    try:
        for event in body.events:
            item=canonical(event.source_type,event.source_id)
            if not item or item['level'] and item['level']!=event.level:raise HTTPException(422,'minigame_unknown_source')
            if event.action=='reviewed' and event.source_type!='mechanic' and event.answer!=item['reading']:raise HTTPException(422,'minigame_review_answer_mismatch')
            data={'game':event.game,'source_type':event.source_type,'source_id':event.source_id,'action':event.action,'answer':event.answer,'jlpt_level':item['level']}
            if event.event_id in existing:
                row=existing[event.event_id]
                if any(getattr(row,k)!=v for k,v in data.items()):raise HTTPException(409,'minigame_event_conflict')
                continue
            row=MinigameLearningEvent(user_id=user.id,event_key=event.event_id,**data);db.add(row);existing[event.event_id]=row
        db.commit()
    except Exception:db.rollback();raise
    return {'acknowledged':list(dict.fromkeys(keys))}

@router.get('/review')
def review(limit:int=Query(30,ge=1,le=100),offset:int=Query(0,ge=0,le=100000),user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return review_items(db,user.id,limit,offset)
