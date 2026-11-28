"""Version-independent private flashcard API; legacy /game remains unchanged."""
import csv
import io
from datetime import timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field, ConfigDict, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User, FlashcardDeck as Deck, FlashcardCard as Card, FlashcardProgress as Progress, FlashcardSession as Study, FlashcardTransfer as Transfer, Vocabulary
from ..services import flashcards as service

router = APIRouter(prefix='/flashcards', tags=['Flashcards'])
Owner = Depends(get_current_active_user)
Database = Depends(get_db)
Level = Literal['N5', 'N4', 'N3', 'N2', 'N1']


class CardInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: int | None = Field(None, gt=0)
    front: str = Field(min_length=1, max_length=1000)
    back: str = Field(min_length=1, max_length=2000)
    reading: str = Field('', max_length=500)
    note: str = Field('', max_length=2000)


class DeckInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field('', max_length=2000)
    jlpt_level: Level | None = None
    topic: str = Field('', max_length=100)
    cards: list[CardInput] = Field(default_factory=list, max_length=500)


class CardsInput(BaseModel):
    cards: list[CardInput] = Field(max_length=500)


class StarInput(BaseModel):
    starred: bool


class OrderInput(BaseModel):
    card_ids: list[int] = Field(max_length=500)


class ReviewItem(BaseModel):
    card_id: int = Field(gt=0)
    correct: bool


class ReviewInput(BaseModel):
    request_id: str = Field(min_length=8, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    mode: Literal['flip'] = 'flip'
    duration_seconds: int = Field(ge=0, le=14400)
    results: list[ReviewItem] = Field(min_length=1, max_length=500)


class TextInput(BaseModel):
    text: str = Field(max_length=500000)
    field_separator: str = Field('\t', min_length=1, max_length=10)
    card_separator: str = Field('\n', min_length=1, max_length=10)


class LegacyDeck(DeckInput):
    local_id: str = Field(min_length=1, max_length=180)


class TransferInput(BaseModel):
    confirmed: Literal[True]
    source: Literal['web', 'mobile']
    decks: list[LegacyDeck] = Field(min_length=1, max_length=100)

    @field_validator('decks')
    @classmethod
    def bound_total(cls, value):
        if sum(len(d.cards) for d in value) > 10000:
            raise ValueError('too many cards per transfer')
        return value


class QuickInput(BaseModel):
    source: Literal['kanji', 'vocabulary']
    level: Level
    group: int = Field(0, ge=0, le=10000)
    title: str = Field(min_length=1, max_length=160)


class AssessmentInput(BaseModel):
    request_id: str = Field(min_length=8, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    deck_id: int = Field(gt=0)
    mode: Literal['learn', 'test']
    count: int = Field(20, ge=1, le=100)
    types: list[Literal['choice', 'typed', 'true_false', 'match']] = Field(default_factory=lambda:['choice','typed'], min_length=1, max_length=4)
    round_index: int = Field(0, ge=0, le=10000)


class AssessmentAnswer(BaseModel):
    question_id: str = Field(min_length=1, max_length=36)
    answer: str | bool | dict[str,str]

    @field_validator('answer')
    @classmethod
    def bounded_answer(cls,value):
        if isinstance(value,str) and len(value)>2000 or isinstance(value,dict) and (len(value)>4 or any(len(k)>36 or len(v)>36 for k,v in value.items())):
            raise ValueError('answer too large')
        return value


class AssessmentSubmit(BaseModel):
    duration_seconds: int = Field(ge=0, le=14400)
    answers: list[AssessmentAnswer] = Field(min_length=1, max_length=500)


@router.post('/assessments')
def start_assessment(body:AssessmentInput,user:User=Owner,db:Session=Database):
    from ..services import flashcard_assessments as assessments
    return assessments.view(assessments.create(db,user.id,body))


@router.get('/assessments/{key}')
def get_assessment(key:str,user:User=Owner,db:Session=Database):
    from ..services import flashcard_assessments as assessments
    return assessments.view(assessments.owned(db,user.id,key))


@router.post('/assessments/{key}/submit')
def finish_assessment(key:str,body:AssessmentSubmit,user:User=Owner,db:Session=Database):
    from ..services import flashcard_assessments as assessments
    return assessments.submit(db,user.id,key,body)


@router.delete('/assessments/{key}',status_code=204)
def abandon_assessment(key:str,user:User=Owner,db:Session=Database):
    from ..services import flashcard_assessments as assessments
    service.lock_owner(db,user.id)
    row=assessments.owned(db,user.id,key)
    if row.status=='active': row.status='abandoned'; db.commit()


@router.get('/sessions')
def session_history(deck_id:int|None=None,offset:int=Query(0,ge=0),limit:int=Query(20,ge=1,le=100),user:User=Owner,db:Session=Database):
    from ..models.database import FlashcardAssessment
    if deck_id is not None: service.owned(db,user.id,deck_id)
    query=db.query(FlashcardAssessment).filter_by(user_id=user.id,status='completed')
    if deck_id is not None: query=query.filter_by(deck_id=deck_id)
    total=query.count()
    return {'total':total,'items':[{'id':r.id,'deck_id':r.deck_id,'mode':r.mode,'created_at':r.created_at,'total':r.result['total'],'correct':r.result['correct'],'wrong':r.result['wrong'],'accuracy':r.result['accuracy']} for r in query.order_by(FlashcardAssessment.created_at.desc(),FlashcardAssessment.id).offset(offset).limit(limit)]}


@router.get('')
def list_decks(search: str = Query('', max_length=160), level: Level | None = None, topic: str = Query('', max_length=100), sort: Literal['recent', 'name', 'progress'] = 'recent', offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), user: User = Owner, db: Session = Database):
    # At most 100 deck summaries; aggregate all cards once, avoiding per-deck queries.
    decks = db.query(Deck).filter_by(user_id=user.id).all()
    rows = db.query(Card.deck_id, Card.id, Progress.state, Progress.last_reviewed_at).join(Deck, Deck.id == Card.deck_id).outerjoin(Progress, (Progress.card_id == Card.id) & (Progress.user_id == user.id)).filter(Deck.user_id == user.id).all()
    stats = {}
    for deck_id, _, state, last in rows:
        value = stats.setdefault(deck_id, {'total': 0, 'mastered': 0, 'last_studied_at': None})
        value['total'] += 1; value['mastered'] += int(state == 'mastered')
        if last and (value['last_studied_at'] is None or last > value['last_studied_at']): value['last_studied_at'] = last
    items = []
    for row in decks:
        if search and service.normalized(search) not in service.normalized(row.title + ' ' + row.description): continue
        if level and row.jlpt_level != level or topic and row.topic != topic: continue
        value = stats.get(row.id, {'total': 0, 'mastered': 0, 'last_studied_at': None})
        value['mastered_percent'] = round(value['mastered'] * 100 / value['total']) if value['total'] else 0
        items.append({**{k: getattr(row, k) for k in ('id', 'title', 'description', 'jlpt_level', 'topic', 'updated_at')}, 'stats': value})
    from datetime import timezone
    items.sort(key=(lambda d: (d['title'].casefold(), d['id'])) if sort == 'name' else (lambda d: (d['stats']['mastered_percent'], d['id'])) if sort == 'progress' else (lambda d: ((d['stats']['last_studied_at'] or d['updated_at']).replace(tzinfo=timezone.utc).timestamp(), d['id'])), reverse=sort != 'name')
    return {'items': items[offset:offset+limit], 'total': len(items)}


@router.post('')
def create(body: DeckInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id)
    row = service.create_deck(db, user.id, body.model_dump())
    db.commit()
    return service.deck_data(db, row)


@router.post('/import/preview')
def preview(body: TextInput, user: User = Owner):
    return service.parse_text(body.text, body.field_separator, body.card_separator)


@router.post('/transfer')
def transfer(body: TransferInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id)
    result = []
    for deck in body.decks:
        key = service.digest([body.source, deck.local_id])
        old = db.query(Transfer).filter_by(user_id=user.id, source_key=key).first()
        if old:
            result.append({'deck_id': old.deck_id, 'status': 'already_transferred'}); continue
        row = service.create_deck(db, user.id, deck.model_dump())
        db.add(Transfer(user_id=user.id, source_key=key, deck_id=row.id)); db.flush()
        result.append({'deck_id': row.id, 'status': 'created'})
    db.commit()
    return {'items': result}


@router.post('/quick-create')
def quick_create(body: QuickInput, user: User = Owner, db: Session = Database):
    if body.source == 'kanji':
        from ..services.kanji_dictionary_service import kanji_dictionary_service
        entries, _ = kanji_dictionary_service.list_entries(jlpt=body.level, limit=10000)
        entries = [e for e in entries if e.get('meaning_vi')]
        entries.sort(key=lambda e: e['kanji'])
        cards = [{'front': e['kanji'], 'back': e['meaning_vi'], 'reading': '、'.join(e.get('onyomi', []) + e.get('kunyomi', []))} for e in entries[body.group*20:(body.group+1)*20]]
    else:
        entries = db.query(Vocabulary).filter_by(jlpt_level=body.level).order_by(Vocabulary.id).offset(body.group*20).limit(20).all()
        cards = [{'front': e.japanese_word, 'back': e.meaning, 'reading': e.reading or ''} for e in entries if e.meaning]
    if not cards: raise HTTPException(422, 'flashcards.noSource')
    service.lock_owner(db, user.id)
    row = service.create_deck(db, user.id, {'title': body.title, 'jlpt_level': body.level, 'topic': body.source, 'cards': cards})
    db.commit(); return service.deck_data(db, row)


@router.get('/queue')
def queue(deck_id: int | None = None, starred: bool = False, limit: int = Query(100, ge=1, le=500), user: User = Owner, db: Session = Database):
    if deck_id is not None: service.owned(db, user.id, deck_id)
    query = db.query(Card, Progress).join(Deck, Deck.id == Card.deck_id).outerjoin(Progress, (Progress.card_id == Card.id) & (Progress.user_id == user.id)).filter(Deck.user_id == user.id)
    if deck_id is not None: query = query.filter(Card.deck_id == deck_id)
    if starred: query = query.filter(Progress.starred.is_(True))
    from sqlalchemy import case, or_
    clock = service.now()
    query = query.filter(or_(Progress.card_id.is_(None), Progress.state == 'new', Progress.state == 'learning', Progress.due_at <= clock))
    query = query.order_by(case((Progress.due_at <= clock, 0), (Progress.state == 'learning', 1), else_=2), Progress.due_at, Card.deck_id, Card.position, Card.id)
    total = query.count()
    return {'items': [service.card_data(c, p) for c, p in query.limit(limit)], 'total': total, 'limit': limit}


@router.get('/stats')
def statistics(deck_id: int | None = None, user: User = Owner, db: Session = Database):
    if deck_id is not None: service.owned(db, user.id, deck_id)
    value = service.summary(db, user.id, deck_id)
    q = db.query(Study).filter_by(user_id=user.id)
    if deck_id is not None:
        # Results retain the deck id even if a card is later removed.
        sessions = q.order_by(Study.created_at.desc()).limit(10000).all()
        dates = {s.created_at.date() for s in sessions if any(r['deck_id'] == deck_id for r in s.results)}
    else:
        dates = {r[0].date() if hasattr(r[0], 'date') else __import__('datetime').date.fromisoformat(r[0]) for r in db.query(func.date(Study.created_at)).filter(Study.user_id == user.id).distinct()}
    today = service.now().date()
    day = today if today in dates else today - timedelta(days=1)
    streak = 0
    while day in dates:
        streak += 1; day -= timedelta(days=1)
    return {**value, 'review_streak': streak}


@router.post('/reviews')
def review(body: ReviewInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id)
    payload_hash = service.digest(body.model_dump())
    old = db.query(Study).filter_by(user_id=user.id, request_key=body.request_id).first()
    if old:
        if old.payload_hash != payload_hash: raise HTTPException(409, 'flashcards.requestConflict')
        return {'session_id': old.id, 'replayed': True}
    ids = [r.card_id for r in body.results]
    if len(set(ids)) != len(ids): raise HTTPException(422, 'flashcards.invalidCards')
    cards = db.query(Card).join(Deck).filter(Deck.user_id == user.id, Card.id.in_(ids)).all()
    if len(cards) != len(ids): raise HTTPException(404, 'flashcards.notFound')
    results = {r.card_id: r.correct for r in body.results}
    clock = service.now()
    stored = []
    for card in cards:
        p = db.get(Progress, (user.id, card.id))
        if p is None: p = Progress(user_id=user.id, card_id=card.id, starred=False); db.add(p)
        service.schedule(p, results[card.id], clock)
        stored.append({'card_id': card.id, 'deck_id': card.deck_id, 'correct': results[card.id]})
    correct = sum(results.values())
    row = Study(user_id=user.id, request_key=body.request_id, payload_hash=payload_hash, mode=body.mode, card_count=len(ids), correct=correct, wrong=len(ids)-correct, duration_seconds=body.duration_seconds, results=stored)
    db.add(row); db.commit()
    return {'session_id': row.id, 'replayed': False}


@router.get('/{deck_id}')
def detail(deck_id: int, user: User = Owner, db: Session = Database):
    return service.deck_data(db, service.owned(db, user.id, deck_id))


@router.put('/{deck_id}')
def update(deck_id: int, body: DeckInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    for k in ('title', 'description', 'jlpt_level', 'topic'): setattr(row, k, getattr(body, k))
    service.replace_cards(db, row, [c.model_dump() for c in body.cards]); db.commit()
    return service.deck_data(db, row)


@router.delete('/{deck_id}', status_code=204)
def delete(deck_id: int, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); service.delete_deck(db, service.owned(db, user.id, deck_id)); db.commit()


@router.post('/{deck_id}/duplicate')
def duplicate(deck_id: int, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    data = {k: getattr(row, k) for k in ('title', 'description', 'jlpt_level', 'topic')}
    data['cards'] = [{k: getattr(c, k) for k in ('front', 'back', 'reading', 'note')} for c in service.card_rows(db, row.id)]
    copy = service.create_deck(db, user.id, data); db.commit(); return service.deck_data(db, copy)


@router.put('/{deck_id}/cards')
def bulk_cards(deck_id: int, body: CardsInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    service.replace_cards(db, row, [c.model_dump() for c in body.cards]); db.commit(); return service.deck_data(db, row)


def editable_cards(db, deck_id):
    return [{k: getattr(c, k) for k in ('id', 'front', 'back', 'reading', 'note')} for c in service.card_rows(db, deck_id)]


@router.post('/{deck_id}/cards')
def add_card(deck_id: int, body: CardInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    service.replace_cards(db, row, [*editable_cards(db, deck_id), {**body.model_dump(), 'id': None}]); db.commit()
    return service.deck_data(db, row)


@router.put('/{deck_id}/cards/reorder')
def reorder(deck_id: int, body: OrderInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    cards = {c['id']: c for c in editable_cards(db, deck_id)}
    if len(body.card_ids) != len(cards) or set(body.card_ids) != set(cards): raise HTTPException(422, 'flashcards.invalidCards')
    service.replace_cards(db, row, [cards[i] for i in body.card_ids]); db.commit(); return service.deck_data(db, row)


@router.put('/{deck_id}/cards/{card_id}')
def edit_card(deck_id: int, card_id: int, body: CardInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    cards = editable_cards(db, deck_id)
    if not any(c['id'] == card_id for c in cards): raise HTTPException(404, 'flashcards.notFound')
    service.replace_cards(db, row, [{**body.model_dump(), 'id': card_id} if c['id'] == card_id else c for c in cards]); db.commit(); return service.deck_data(db, row)


@router.delete('/{deck_id}/cards/{card_id}', status_code=204)
def remove_card(deck_id: int, card_id: int, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); row = service.owned(db, user.id, deck_id)
    cards = editable_cards(db, deck_id)
    if not any(c['id'] == card_id for c in cards): raise HTTPException(404, 'flashcards.notFound')
    service.replace_cards(db, row, [c for c in cards if c['id'] != card_id]); db.commit()


@router.put('/{deck_id}/cards/{card_id}/star')
def star(deck_id: int, card_id: int, body: StarInput, user: User = Owner, db: Session = Database):
    service.lock_owner(db, user.id); service.owned(db, user.id, deck_id)
    if not db.query(Card).filter_by(deck_id=deck_id, id=card_id).first(): raise HTTPException(404, 'flashcards.notFound')
    p = db.get(Progress, (user.id, card_id))
    if p is None: p = Progress(user_id=user.id, card_id=card_id); db.add(p)
    p.starred = body.starred; db.commit(); return service.progress_data(p)


@router.get('/{deck_id}/export')
def export(deck_id: int, format: Literal['text', 'csv'] = 'csv', user: User = Owner, db: Session = Database):
    service.owned(db, user.id, deck_id)
    output = io.StringIO(newline='')
    writer = csv.writer(output, delimiter=',' if format == 'csv' else '\t')
    writer.writerow(['front', 'back', 'reading', 'note'])
    for row in service.card_rows(db, deck_id):
        # Neutralize formula injection on spreadsheet export without modifying stored text.
        writer.writerow(["'" + v if v.lstrip().startswith(('=', '+', '-', '@')) else v for v in [row.front, row.back, row.reading, row.note]])
    return Response('\ufeff' + output.getvalue(), media_type='text/csv' if format == 'csv' else 'text/plain', headers={'Content-Disposition': f'attachment; filename="flashcards-{deck_id}.{"csv" if format == "csv" else "txt"}"'})
