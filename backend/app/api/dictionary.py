from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User, Vocabulary
from ..models.schemas import JlptLevel
from ..models.dictionary import DictionaryEntry, DictionaryPage, DictionaryTranslation
from ..services.dictionary_service import search_rows, serialize, translate_one

router = APIRouter(prefix='/dictionary', tags=['dictionary'])


def get_word(db, word_id):
    row = db.get(Vocabulary, word_id)
    if row is None:
        raise HTTPException(404, 'dictionary_word_not_found')
    return row


@router.get('', response_model=DictionaryPage)
def search_dictionary(q: str = Query('', max_length=100), jlpt_level: Optional[JlptLevel] = None,
    pos: Optional[str] = Query(None, min_length=1, max_length=40, pattern='^[a-zA-Z0-9-]+$'),
    limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=10000), db: Session = Depends(get_db)):
    rows, total = search_rows(db, q, jlpt_level, pos, limit, offset)
    return {'items': [serialize(row) for row in rows], 'total': total, 'limit': limit, 'offset': offset}


@router.get('/{word_id}', response_model=DictionaryEntry)
def word_detail(word_id: int, db: Session = Depends(get_db)):
    return serialize(get_word(db, word_id), True)


@router.post('/{word_id}/translation', response_model=DictionaryTranslation)
def request_translation(word_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return translate_one(db, get_word(db, word_id), user.id)
