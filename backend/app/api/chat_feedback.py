from typing import Literal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User,ChatHistory,ChatAnswerFeedback

router=APIRouter(prefix='/chat/answers',tags=['chat answer feedback'])


class FeedbackRequest(BaseModel):
    rating: Literal['helpful','incorrect']
    comment: str = Field(default='',max_length=1000)


def owned_answer(db,user,message_id):
    row=db.query(ChatHistory).filter_by(id=message_id,user_id=user.id).first()
    if row is None:raise HTTPException(404,'chat_answer_not_found')
    return row


def response(row):
    return {'rating':row.rating,'comment':row.comment,'updated_at':row.updated_at} if row else None


@router.get('/{message_id}/feedback')
def get_feedback(message_id:int,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    owned_answer(db,user,message_id)
    return response(db.query(ChatAnswerFeedback).filter_by(user_id=user.id,chat_history_id=message_id).first())


@router.put('/{message_id}/feedback')
def save_feedback(message_id:int,body:FeedbackRequest,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    answer=owned_answer(db,user,message_id)
    db.query(User.id).filter_by(id=user.id).with_for_update().one()
    row=db.query(ChatAnswerFeedback).filter_by(user_id=user.id,chat_history_id=answer.id).first()
    if row is None:
        row=ChatAnswerFeedback(user_id=user.id,conversation_id=answer.conversation_id,chat_history_id=answer.id)
        db.add(row)
    row.rating=body.rating;row.comment=body.comment.strip()
    db.commit();db.refresh(row)
    return response(row)
