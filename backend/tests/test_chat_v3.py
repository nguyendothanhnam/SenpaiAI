import asyncio
import json
from pathlib import Path
import pytest
from app.services.chat_language import detect_chat_language
from app.services.chat_quality import question_kind,localized_sources,violations
from app.services.chat_budget import bounded_prompt,IncompleteChatResponse,measured_generation
from app.services.ollama_service import OllamaJapaneseLearningService
from app.api import chat
from app.models.database import GrammarRule,GrammarQuestion,ChatHistory
from app.models.schemas import ChatMessage
from test_chat_quality import context

CASES=json.loads((Path(__file__).parent/'data/chat_language_v3_cases.json').read_text(encoding='utf8'))['cases']


@pytest.mark.parametrize('case',CASES,ids=lambda case:str(case['id']))
def test_language_defaults_to_ui_unless_request_or_complete_english(case):
    assert detect_chat_language(case['question'],case['fallback'])==case['expected']


@pytest.mark.parametrize('question,kind',[
    ('Tra kanji 森','kanji'),('Tra từ 図書館','vocabulary'),('Cách dùng ～ている','grammar'),
    ('So sánh てもいい và てはいけない','comparison'),('Dịch sang tiếng Nhật: Tôi đang học.','translation'),
    ('Phân tích câu 本を読んでいます。','analysis'),('Cho bài tập mẫu ている','exercise'),
    ('Xin chào','greeting'),('Giá cổ phiếu hôm nay?','off_topic'),('Giải thích giúp tôi','unclear'),
])
def test_intent_contracts(question,kind):
    assert question_kind(question)==kind


def test_budget_preserves_system_and_question_and_prioritizes_evidence():
    system='Mandatory system instructions, never truncate.'
    prompt,metrics=bounded_prompt(system,'Current Japanese question','資料'*1000,'old history '*500,2048,350)
    assert prompt.endswith('Current question:\nCurrent Japanese question')
    assert metrics['history_bytes']==0 and metrics['reference_bytes']>0 and metrics['context_trimmed']
    assert metrics['estimated_input_byte_bound']<=2048-350-192
    with pytest.raises(ValueError,match='exceeds_budget'):
        bounded_prompt(system,'字'*2000)


def test_measured_tokens_are_returned_by_service_and_truncation_is_not_served(monkeypatch):
    from types import SimpleNamespace
    from app.services import chat_budget
    calls=[]
    class Response:
        def raise_for_status(self):pass
        def json(self):return {'done':True,'done_reason':'length','prompt_eval_count':123,'eval_count':350,'message':{'content':'partial'}}
    class Client:
        def __init__(self,**kwargs):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def post(self,url,json):calls.append(json);return Response()
        def get(self,*args,**kwargs):return SimpleNamespace(json=lambda:{'models':[]})
    monkeypatch.setattr(chat_budget.httpx,'Client',Client)
    records=[];service=SimpleNamespace(base_url='http://localhost:11434',model='test',_metrics_hook=records.append)
    with pytest.raises(IncompleteChatResponse):measured_generation(service,'question','full system',350,0)
    assert records[0]['prompt_eval_count']==123 and records[0]['eval_count']==350
    assert calls[0]['messages'][0]['content']=='full system'


def test_invalid_output_retries_once_then_safe_language_specific_reply(monkeypatch):
    service=OllamaJapaneseLearningService();calls=[]
    def invalid(*args,**kwargs):calls.append(args);return 'Intent: TEST\n這個是學習。'
    monkeypatch.setattr(service,'_call_ollama',invalid)
    result=asyncio.run(service.chat_response('Explain a Japanese form',response_language='en'))
    assert len(calls)==2 and 'enough' in result['answer']
    assert 'Intent:' not in result['answer'] and '學習' not in result['answer']
    assert 'chinese_prose' in violations('Giải thích giúp tôi','我們學習這個語法','vi')
    assert 'chinese_prose' not in violations('Explain the old character 學','The character 學 is quoted.','en')


def test_fixed_examples_exist_only_in_test_fixture():
    data=json.loads((Path(__file__).parent/'data/chat_legacy_regressions.json').read_text(encoding='utf8'))
    assert len(data['cases'])==4 and all(row['legacy_answer']for row in data['cases'])
    assert not hasattr(chat,'deterministic_chat_answer')
    source=Path(chat.__file__).read_text(encoding='utf8')
    assert '私は毎日学校へ行きます' not in source and 'どちらが好きですか' not in source
    assert 'chat_quality_v3_cases' not in source


def test_safe_scoping_never_calls_model(context,monkeypatch):
    _,db,users,_,_=context
    async def unexpected(**kwargs):pytest.fail('Scope/clarification must not call a model')
    monkeypatch.setattr(chat.japanese_service,'chat_response',unexpected)
    for message in ('Viết mã điều khiển máy giặt bằng C++','Giải thích giúp tôi'):
        result=asyncio.run(chat.send_message(ChatMessage(message=message),users[0],db))
        assert len(result.answer.split())<60 and not result.sources
    assert db.query(ChatHistory).count()==3 # existing feedback fixture + these two replies


def test_generic_rule_lookup_and_sources_follow_ui_language(context):
    _,db,users,_,_=context
    db.add(GrammarRule(rule_name='Tiếp diễn',japanese_pattern='ている',meaning='diễn tả hành động đang diễn ra',jlpt_level='N5',examples=[{'ja':'本を読んでいます。','vi':'Tôi đang đọc sách.','en':'I am reading a book.'}]))
    db.commit();users[0].ui_language='en'
    result=asyncio.run(chat.send_message(ChatMessage(message='Cách dùng ～ている?'),users[0],db))
    assert 'Meaning' in result.answer and 'ngữ pháp' not in result.sources[0]['title']
    assert result.sources[0]['title'].startswith('Grammar')
    assert localized_sources([{'title':'Nội bộ','type':'internal','url':'/x'}],'en')==[]


def test_evaluation_has_96_fresh_cases_and_manual_review_fields():
    rows=json.loads((Path(__file__).parent/'data/chat_quality_v3_cases.json').read_text(encoding='utf8'))['cases']
    assert len(rows)==96 and len({r['question']for r in rows})==96
    assert any('furigana' in r['question'] and 'この' in r['question']for r in rows)
    assert all(r['reference'] and r['required'] and r['max_words']for r in rows)


def test_polite_progressive_selects_the_specific_rule_not_generic_masu(context):
    from app.services.chat_knowledge import local_knowledge
    _,db,_,_,_=context
    db.add_all([GrammarRule(rule_name='Lịch sự',japanese_pattern='ます',meaning='dạng lịch sự',jlpt_level='N5'),
        GrammarRule(rule_name='Tiếp diễn',japanese_pattern='ている',meaning='đang làm một hành động',jlpt_level='N5')])
    db.commit()
    _,sources,answer=local_knowledge(db,'Giải thích ～ています trong câu 本を読んでいます。','vi')
    assert 'đang làm' in answer and 'ている' in answer and sources


def test_rubric_keeps_safe_reply_language_separate_from_missing_japanese_translation():
    from app.services.chat_evaluation import grade
    checks=grade({'group':'vi_ja','required':[['学生']],'max_words':100},
        'Mình chưa có đủ căn cứ. Bạn hãy cung cấp thêm ngữ cảnh.',[])
    assert checks['language'] and not checks['structure'] and not checks['content_keywords']


def test_translation_to_japanese_does_not_allow_english_explanation():
    assert 'language' in violations('Dịch sang tiếng Nhật: Tôi ở nhà.',
        '私は家にいます。\n\nThis sentence expresses a temporary situation. It uses the present tense of the verb.', 'vi')


def test_vocabulary_requires_reading_and_rejects_unrequested_chinese_variants():
    assert 'chinese_prose' in violations('Tra từ 図書館','图书馆 (としょかん): thư viện.','vi')
    assert 'vocabulary_reading' in violations('Từ 電車 đọc thế nào?','電車 (deneshu): tàu điện.','vi')
    assert not violations('Tra từ 図書館','図書館 (としょかん): thư viện.','vi')


@pytest.mark.parametrize('question',['Xin chào SenpaiAI!','Xin chào. Hãy trả lời bằng tiếng Việt.'])
def test_greeting_with_name_or_language_instruction(question):
    from app.services.chat_language import chitchat_direct_answer
    assert 'Chào bạn' in chitchat_direct_answer(question,'vi')
