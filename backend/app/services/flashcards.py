"""Account-owned flashcards; deterministic Leitner scheduling, no reward writes."""
import hashlib
import json
import unicodedata
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from ..models.database import FlashcardDeck as Deck, FlashcardCard as Card, FlashcardProgress as Progress, FlashcardSession as Study, FlashcardTransfer as Transfer, FlashcardAssessment as Assessment, User

MAX_DECKS, MAX_CARDS = 100, 500
INTERVAL_DAYS = (0, 1, 3, 7, 14, 30, 60)


def now():
    return datetime.now(timezone.utc)


def normalized(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def fingerprint(card):
    return digest([normalized(card['front']), normalized(card['back'])])


def lock_owner(db, user_id):
    db.query(User.id).filter_by(id=user_id).with_for_update().one()


def owned(db, user_id, deck_id):
    row = db.query(Deck).filter_by(user_id=user_id, id=deck_id).first()
    if not row:
        raise HTTPException(404, 'flashcards.notFound')
    return row


def card_rows(db, deck_id):
    return db.query(Card).filter_by(deck_id=deck_id).order_by(Card.position, Card.id).all()


def progress_data(row):
    return {key: getattr(row, key) for key in ('state', 'stage', 'due_at', 'correct', 'wrong', 'last_reviewed_at', 'starred')} if row else {
        'state': 'new', 'stage': 0, 'due_at': None, 'correct': 0, 'wrong': 0, 'last_reviewed_at': None, 'starred': False}


def card_data(row, progress=None):
    return {**{key: getattr(row, key) for key in ('id', 'deck_id', 'position', 'front', 'back', 'reading', 'note')}, 'progress': progress_data(progress)}


def summary(db, user_id, deck_id=None):
    query = db.query(Card.id, Progress.state, Progress.correct, Progress.wrong, Progress.last_reviewed_at, Progress.due_at).join(Deck, Deck.id == Card.deck_id).outerjoin(Progress, (Progress.card_id == Card.id) & (Progress.user_id == user_id)).filter(Deck.user_id == user_id)
    if deck_id is not None:
        query = query.filter(Deck.id == deck_id)
    rows = query.all()  # Bounded by 100 decks * 500 cards, one query, no N+1.
    counts = {'new': 0, 'learning': 0, 'mastered': 0}
    correct = wrong = due = 0
    last = None
    clock = now().replace(tzinfo=None)
    for row in rows:
        counts[row.state or 'new'] += 1
        correct += row.correct or 0
        wrong += row.wrong or 0
        if row.due_at and row.due_at.replace(tzinfo=None) <= clock:
            due += 1
        if row.last_reviewed_at and (last is None or row.last_reviewed_at > last):
            last = row.last_reviewed_at
    return {**counts, 'total': len(rows), 'correct': correct, 'wrong': wrong, 'accuracy': round(correct * 100 / (correct + wrong)) if correct + wrong else 0,
            'mastered_percent': round(counts['mastered'] * 100 / len(rows)) if rows else 0, 'due_today': due, 'last_studied_at': last}


def deck_data(db, row, detail=True):
    value = {key: getattr(row, key) for key in ('id', 'title', 'description', 'jlpt_level', 'topic', 'is_private', 'created_at', 'updated_at')}
    value['stats'] = summary(db, row.user_id, row.id)
    if detail:
        progress = {p.card_id: p for p in db.query(Progress).join(Card, Card.id == Progress.card_id).filter(Card.deck_id == row.id, Progress.user_id == row.user_id)}
        value['cards'] = [card_data(c, progress.get(c.id)) for c in card_rows(db, row.id)]
    return value


def validate_cards(cards):
    if len(cards) > MAX_CARDS:
        raise HTTPException(422, 'flashcards.tooManyCards')
    seen = set()
    for card in cards:
        key = fingerprint(card)
        if key in seen:
            raise HTTPException(422, 'flashcards.duplicateCard')
        seen.add(key)


def remove_cards(db, ids):
    if ids:
        db.query(Progress).filter(Progress.card_id.in_(ids)).delete(synchronize_session=False)
        db.query(Card).filter(Card.id.in_(ids)).delete(synchronize_session=False)


def replace_cards(db, deck, cards):
    validate_cards(cards)
    existing = {c.id: c for c in card_rows(db, deck.id)}
    ids = [c['id'] for c in cards if c.get('id') is not None]
    if len(ids) != len(set(ids)) or any(i not in existing for i in ids):
        raise HTTPException(422, 'flashcards.invalidCards')
    remove_cards(db, [i for i in existing if i not in ids])
    # Temporary fingerprints allow atomic swaps of two cards' text.
    for row in existing.values():
        if row.id in ids:
            row.fingerprint = f'pending-{row.id}'
    db.flush()
    for position, value in enumerate(cards):
        row = existing.get(value.get('id'))
        if row is None:
            row = Card(deck_id=deck.id)
            db.add(row)
        elif row.front != value['front'] or row.back != value['back']:
            db.query(Progress).filter_by(card_id=row.id).delete(synchronize_session=False)
        for key in ('front', 'back', 'reading', 'note'):
            setattr(row, key, value.get(key, ''))
        row.position = position
        row.fingerprint = fingerprint(value)
    deck.updated_at = now()
    db.flush()


def create_deck(db, user_id, data):
    if db.query(Deck).filter_by(user_id=user_id).count() >= MAX_DECKS:
        raise HTTPException(422, 'flashcards.tooManyDecks')
    validate_cards(data.get('cards', []))
    row = Deck(user_id=user_id, **{k: data.get(k, '' if k != 'jlpt_level' else None) for k in ('title', 'description', 'jlpt_level', 'topic')}, is_private=True, updated_at=now())
    db.add(row)
    db.flush()
    replace_cards(db, row, [{**c, 'id': None} for c in data.get('cards', [])])
    return row


def schedule(progress, correct, clock):
    progress.last_reviewed_at = clock
    progress.correct = (progress.correct or 0) + int(correct)
    progress.wrong = (progress.wrong or 0) + int(not correct)
    progress.stage = min(6, (progress.stage or 0) + 1) if correct else 0
    progress.state = 'mastered' if progress.stage >= 3 else 'learning'
    progress.due_at = clock + (timedelta(days=INTERVAL_DAYS[progress.stage]) if correct else timedelta(minutes=10))


def parse_text(text, field_separator, card_separator):
    if not field_separator or not card_separator or field_separator == card_separator or field_separator in card_separator or card_separator in field_separator:
        raise HTTPException(422, 'flashcards.separatorError')
    rows, errors, seen = [], [], set()
    for line, raw in enumerate(text.split(card_separator), 1):
        if not raw.strip():
            continue
        parts = raw.split(field_separator)
        if len(parts) not in (2, 3, 4) or not parts[0].strip() or not parts[1].strip():
            errors.append({'line': line, 'code': 'invalidRow'})
            continue
        card = dict(zip(('front', 'back', 'reading', 'note'), [p.strip() for p in parts]))
        if any(len(card.get(k, '')) > n for k, n in [('front', 1000), ('back', 2000), ('reading', 500), ('note', 2000)]):
            errors.append({'line': line, 'code': 'invalidRow'})
        elif fingerprint(card) in seen:
            errors.append({'line': line, 'code': 'duplicate'})
        else:
            seen.add(fingerprint(card)); rows.append(card)
    if len(rows) > MAX_CARDS:
        raise HTTPException(422, 'flashcards.tooManyCards')
    return {'cards': rows, 'errors': errors}


def delete_deck(db, deck):
    db.query(Assessment).filter_by(deck_id=deck.id).delete(synchronize_session=False)
    remove_cards(db, [c.id for c in card_rows(db, deck.id)])
    db.query(Transfer).filter_by(deck_id=deck.id).update({'deck_id': None}, synchronize_session=False)
    db.delete(deck)


def export_data(db, user_id):
    return {'decks': [deck_data(db, row) for row in db.query(Deck).filter_by(user_id=user_id).order_by(Deck.id)],
            'assessments': [{k:getattr(row,k) for k in ('id','deck_id','mode','status','questions','result','created_at')} for row in db.query(Assessment).filter_by(user_id=user_id).order_by(Assessment.created_at)],
            'sessions': [{k: getattr(row, k) for k in ('id', 'request_key', 'mode', 'card_count', 'correct', 'wrong', 'duration_seconds', 'results', 'created_at')} for row in db.query(Study).filter_by(user_id=user_id).order_by(Study.id)],
            'transfers': [{k: getattr(row, k) for k in ('source_key', 'deck_id', 'created_at')} for row in db.query(Transfer).filter_by(user_id=user_id)]}


def clear_data(db, user_id, decks=False):
    db.query(Assessment).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(Progress).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(Study).filter_by(user_id=user_id).delete(synchronize_session=False)
    if decks:
        db.query(Transfer).filter_by(user_id=user_id).delete(synchronize_session=False)
        for deck in db.query(Deck).filter_by(user_id=user_id).all():
            delete_deck(db, deck)
