"""Post-answer explanations based on persisted exercise and dictionary data."""
from ..models.database import GrammarQuestion, Vocabulary
from .kanji_dictionary_service import kanji_dictionary_service


def explain_daily(db, item, answer, correct):
    key = item.answer_key or {}
    result = {'correct_answer': None if item.item_type == 'flashcard' else key.get('correct_answer'),
              'reason': key.get('explanation') or None, 'wrong_choice': None,
              'examples': key.get('examples') or [], 'link': None, 'source': 'stored' if key.get('explanation') else 'unavailable'}
    if item.item_type == 'grammar' and str(item.source_id).isdigit():
        question = db.get(GrammarQuestion, int(item.source_id))
        if question and question.grammar_rule:
            rule = question.grammar_rule
            result['grammar_rule'] = {'name': rule.rule_name, 'pattern': rule.japanese_pattern, 'usage': rule.usage_notes}
            result['link'] = '/grammar'
    if item.item_type == 'kanji':
        entry = kanji_dictionary_service.get_entry(str(item.source_id))
        if entry:
            result['kanji'] = {'character': entry.get('kanji'), 'meaning': entry.get('meaning_vi') or entry.get('meaning'),
                               'onyomi': entry.get('onyomi') or [], 'kunyomi': entry.get('kunyomi') or []}
            result['examples'] = entry.get('examples') or []
            result['link'] = '/kanji?mode=study'
        if not correct and isinstance(answer, str):
            entries, _ = kanji_dictionary_service.list_entries(jlpt=(item.payload or {}).get('level'), limit=10000)
            matches = [e for e in entries if e.get('kanji') != str(item.source_id) and
                       (answer in (e.get('onyomi') or []) or answer in (e.get('kunyomi') or []) or answer == e.get('meaning') or answer == e.get('meaning_vi'))]
            result['wrong_choice'] = [{'character': e.get('kanji'), 'meaning': e.get('meaning_vi') or e.get('meaning'),
                                       'onyomi': e.get('onyomi') or [], 'kunyomi': e.get('kunyomi') or []} for e in matches[:3]] or None
    if item.item_type in ('vocab', 'flashcard') and str(item.source_id).isdigit():
        word = db.get(Vocabulary, int(item.source_id))
        if word:
            result['vocabulary'] = {'word': word.japanese_word, 'reading': word.reading, 'meaning': word.meaning}
            result['examples'] = word.example_sentences or []
        if not correct and isinstance(answer, str):
            wrong = db.query(Vocabulary).filter(Vocabulary.meaning == answer, Vocabulary.id != int(item.source_id)).limit(3).all()
            result['wrong_choice'] = [{'word': row.japanese_word, 'reading': row.reading, 'meaning': row.meaning} for row in wrong] or None
    return result


def explain_grammar(question, answer, correct):
    rule = question.grammar_rule
    return {'correct_answer': question.correct_answer, 'reason': question.explanation_vi or None,
            'wrong_choice': None, 'examples': question.examples or [], 'source': 'stored' if question.explanation_vi else 'unavailable',
            'grammar_rule': {'name': rule.rule_name, 'pattern': rule.japanese_pattern, 'usage': rule.usage_notes} if rule else None,
            'link': '/grammar'}
