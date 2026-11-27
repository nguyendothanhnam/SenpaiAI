from types import SimpleNamespace
from app.services.answer_explanations import explain_daily, explain_grammar


def test_grammar_uses_stored_rule_and_never_invents_wrong_choice():
    rule = SimpleNamespace(rule_name='は', japanese_pattern='A は B', usage_notes='Topic')
    question = SimpleNamespace(grammar_rule=rule, correct_answer='は', explanation_vi='Trợ từ chủ đề', examples=[{'ja':'私は学生です。','vi':'Tôi là học sinh.'}])
    result = explain_grammar(question, 'が', False)
    assert result['correct_answer'] == 'は'
    assert result['grammar_rule']['pattern'] == 'A は B'
    assert result['examples'][0]['ja'] == '私は学生です。'
    assert result['wrong_choice'] is None


def test_kanji_readings_and_real_wrong_choice(monkeypatch):
    from app.services import answer_explanations as service
    entries = [{'kanji':'日','meaning_vi':'ngày','onyomi':['ニチ'],'kunyomi':['ひ'],'examples':[{'word':'日本','reading':'にほん','meaning':'Nhật Bản'}]},
               {'kanji':'月','meaning_vi':'tháng','onyomi':['ゲツ'],'kunyomi':['つき'],'examples':[]}]
    monkeypatch.setattr(service.kanji_dictionary_service, 'get_entry', lambda key: entries[0])
    monkeypatch.setattr(service.kanji_dictionary_service, 'list_entries', lambda **kwargs: (entries, 2))
    item = SimpleNamespace(item_type='kanji', source_id='日', payload={'level':'N5'}, answer_key={'correct_answer':'ニチ','explanation':'Ngày'})
    result = explain_daily(None, item, 'ゲツ', False)
    assert result['kanji']['onyomi'] == ['ニチ'] and result['kanji']['kunyomi'] == ['ひ']
    assert result['wrong_choice'][0]['character'] == '月'
    assert result['examples'][0]['word'] == '日本'
    assert explain_daily(None, item, 'ニチ', True)['wrong_choice'] is None


def test_daily_read_does_not_reveal_explanation_before_answer(monkeypatch):
    from datetime import date
    from app.api import daily
    calls = []
    monkeypatch.setattr(daily, 'explain_daily', lambda *args: calls.append(args) or {'reason': 'secret'})
    item = SimpleNamespace(id=1, position=0, item_type='kanji', question_type='kanji_reading',
                           payload={'prompt': '日', 'options': ['ひ', 'つき']}, answered_at=None,
                           answer_key={'correct_answer': 'ひ', 'explanation': 'secret'})
    query = SimpleNamespace(filter=lambda *args: query, order_by=lambda *args: query, all=lambda: [item])
    db = SimpleNamespace(query=lambda *args: query)
    task = SimpleNamespace(id=1, task_date=date(2026, 1, 1), status='in_progress', total_items=1, correct_count=0)
    first = daily._read_task(db, task)['items'][0]
    assert 'explanation_details' not in first and 'correct_answer' not in first
    assert calls == []
    item.answered_at = date(2026, 1, 1); item.user_answer = 'ひ'; item.is_correct = True
    assert daily._read_task(db, task)['items'][0]['explanation_details']['reason'] == 'secret'
    assert len(calls) == 1
