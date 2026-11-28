import asyncio
import importlib.util
import json
from pathlib import Path
from uuid import uuid4
import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base,get_db
from app.core.auth import get_current_active_user
from app.models.database import User,ChatConversation,ChatHistory,ChatAnswerFeedback,GrammarRule,Document
from app.models.schemas import ChatMessage
from app.api import chat_feedback,chat
from app.services.chat_evaluation import grade,folded
from app.services.chat_quality import violations,public_source,question_kind
from app.services.chat_knowledge import local_translation
from app.services.chat_language import answer_needs_revision


@pytest.fixture
def context():
    engine=sa.create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @sa.event.listens_for(engine,'connect')
    def setup(conn,record):conn.create_function('char_length',1,len);conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    db=sessionmaker(bind=engine,expire_on_commit=False)()
    users=[User(email=f'quality{i}@example.test',username=f'quality{i}',hashed_password='test',ui_language='vi',current_jlpt_level='N5') for i in range(2)]
    db.add_all(users);db.flush()
    conversation=ChatConversation(user_id=users[0].id,title='Example',mode='text')
    db.add(conversation);db.flush()
    answer=ChatHistory(user_id=users[0].id,conversation_id=conversation.id,question='Question',answer='Original answer',sources=[],grammar_points=[])
    db.add(answer);db.commit();current=[users[0]]
    app=FastAPI();app.include_router(chat_feedback.router,prefix='/api')
    from app.api.auth import router as auth_router
    app.include_router(auth_router,prefix='/api')
    app.dependency_overrides[get_current_active_user]=lambda:current[0]
    app.dependency_overrides[get_db]=lambda:db
    with TestClient(app) as client:yield client,db,users,current,answer
    db.close();engine.dispose()


def test_dataset_has_72_cases_all_groups_references_and_followup_setups():
    data=json.loads((Path(__file__).parent/'data/chat_quality_cases.json').read_text(encoding='utf-8'))
    assert len(data['cases'])==72 and len({c['id'] for c in data['cases']})==72
    assert len({c['group'] for c in data['cases']})==12
    assert all(c['reference'] and c['required'] for c in data['cases'])
    assert all(c.get('history') for c in data['cases'] if c['group']=='follow_up')


def test_rubric_checks_are_independent_and_do_not_ban_japanese_kanji():
    case={'group':'vocabulary','required':[['学校'],['trường']],'examples':True,'source_terms':['学校']}
    answer='学校（がっこう）: trường học. Ví dụ: 学校へ行きます。（がっこうへいきます。） → Tôi đến trường.'
    good=grade(case,answer,[{'title':'Từ điển: 学校','type':'vocabulary'}])
    assert all(good.values())
    assert not grade(case,'Intent: VOCAB\n'+answer,[{'title':'Trợ từ khác','type':'internal'}])['no_internal_labels']
    assert not grade(case,answer+' 因为这个是语法',[])['no_chinese_prose']
    assert folded('が')!=folded('か')
    assert not grade({'group':'vi_ja','required':[['学生']], 'reading':True},'Đây là một câu trả lời bằng tiếng Việt.',[])['reading_and_meaning']
    assert not all(grade(case,'Không có câu trả lời.',[]).values())


def test_runtime_contract_rejects_wrong_translation_direction_and_prompt_echo():
    question='Dịch sang tiếng Nhật: Tôi là sinh viên.'
    assert 'missing_japanese_translation' in violations(question,'Tôi là sinh viên.','vi')
    assert not answer_needs_revision('私は学生です。','vi',question)
    assert 'requested_negation' in violations('Đổi câu trên sang phủ định.','私は学生です。','vi')
    assert 'prompt_echo' in violations('Giải thích giúp tôi','Response language: Vietnamese','vi')
    assert 'unverified_example' in violations('Cho ví dụ phủ định của mẫu vừa rồi.',
        '日本へ行ったことがないことがあります。 → Tôi chưa từng đến Nhật.', 'vi',
        '**Cấu trúc:** たことがある\n日本へ行ったことがあります。')
    assert question_kind('Giải thích ～ながら để nói hai hành động cùng lúc.')=='grammar'
    assert not public_source({'type':'system_rule','title':'Hidden','url':'/library'})
    assert not public_source({'type':'grammar','url':'javascript:alert(1)'})


def test_feedback_ownership_update_validation_export_and_reset(context):
    client,db,users,current,answer=context
    url=f'/api/chat/answers/{answer.id}/feedback'
    assert client.get(url).json() is None
    saved=client.put(url,json={'rating':'incorrect','comment':' Sai nghĩa. ','user_id':users[1].id})
    assert saved.status_code==200 and saved.json()['comment']=='Sai nghĩa.'
    row=db.query(ChatAnswerFeedback).one()
    assert row.user_id==users[0].id and row.conversation_id==answer.conversation_id
    assert row.chat_history_id==answer.id
    assert client.put(url,json={'rating':'helpful','comment':'Đã hiểu.'}).status_code==200
    assert db.query(ChatAnswerFeedback).count()==1 and client.get(url).json()['rating']=='helpful'
    assert client.put(url,json={'rating':'bad'}).status_code==422
    assert client.put(url,json={'rating':'incorrect','comment':'x'*1001}).status_code==422
    current[0]=users[1]
    assert client.get(url).status_code==404
    assert client.put(url,json={'rating':'helpful'}).status_code==404
    current[0]=users[0]
    exported=client.get('/api/auth/me/export')
    assert exported.status_code==200 and len(exported.json()['chat_answer_feedback'])==1
    assert client.post('/api/auth/me/reset-progress').status_code==200
    assert db.query(ChatAnswerFeedback).count()==0


def test_feedback_cascades_on_answer_delete_and_review_export_omits_identifiers(context):
    client,db,users,current,answer=context
    client.put(f'/api/chat/answers/{answer.id}/feedback',json={'rating':'incorrect','comment':'Needs review'})
    spec=importlib.util.spec_from_file_location('review_feedback',Path(__file__).parents[1]/'scripts/review_chat_feedback.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    export=module.export_feedback(db)
    assert export['items'][0]['answer']=='Original answer'
    assert 'user_id' not in export['items'][0] and export['manual_review_required']
    db.delete(answer);db.commit()
    assert db.query(ChatAnswerFeedback).count()==0


def test_catalog_translation_is_exact_and_does_not_drop_negation(context):
    client,db,users,current,answer=context
    db.add(GrammarRule(rule_name='です',japanese_pattern='です',meaning='là',jlpt_level='N5',examples=[{'ja':'私は学生です。','vi':'Tôi là sinh viên.'}]))
    db.commit()
    response,sources,fallback=local_translation(db,'Dịch sang tiếng Nhật: Tôi là sinh viên.','vi')
    assert '私は学生です。' in response and sources and fallback
    assert local_translation(db,'Dịch sang tiếng Nhật: Tôi không phải sinh viên.','vi')==('',[],None)


def test_missing_grammar_evidence_abstains_without_calling_model(context,monkeypatch):
    _,db,users,_,_=context
    monkeypatch.setattr(chat.chroma_service,'search_documents',lambda *args,**kwargs:[])
    async def unexpected(**kwargs):pytest.fail('Unsupported grammar must not be invented by a model')
    monkeypatch.setattr(chat.japanese_service,'chat_response',unexpected)
    result=asyncio.run(chat.send_message(__import__('app.models.schemas',fromlist=['ChatMessage']).ChatMessage(message='Giải thích mẫu ぬぽらです.'),users[0],db))
    assert 'chưa' in result.answer and not result.sources


def test_conversation_uses_library_when_model_cannot_answer(context, monkeypatch):
    _, db, users, _, _ = context
    doc = Document(title='Chào hỏi tại công ty', document_type='conversation',
                   content='Chào hỏi đồng nghiệp tại công ty.\nはじめまして。→ Rất hân hạnh được gặp bạn.')
    private = Document(user_id=users[1].id, title='Chào hỏi tại công ty', document_type='conversation',
                       content='Private draft about chào hỏi tại công ty.')
    db.add_all([private, doc])
    db.commit()

    async def unavailable(**kwargs):
        assert 'はじめまして' in kwargs['context']
        assert 'Private draft' not in kwargs['context']
        return {'answer': chat.uncertainty('vi')}

    monkeypatch.setattr(chat.japanese_service, 'chat_response', unavailable)
    result = asyncio.run(chat.send_message(ChatMessage(message='Mẫu hội thoại chào hỏi tại công ty'), users[0], db))
    assert 'はじめまして' in result.answer
    assert [source['id'] for source in result.sources] == [doc.id]


def test_candidate_cv_is_excluded_before_vector_ranking(monkeypatch):
    from app.services.chat_grounding import CHAT_DOCUMENT_TYPES
    from app.services.vector_db import ChromaDBService

    store = ChromaDBService.__new__(ChromaDBService)
    store.records = {
        'cv': {'metadata': {'document_type': 'candidate_cv_raw', 'document_id': '1'}, 'vector': [1, 0]},
        'private': {'metadata': {'document_type': 'lesson', 'document_id': '2'}, 'vector': [1, 0]},
        'lesson': {'metadata': {'document_type': 'lesson', 'document_id': '3'}, 'vector': [.8, .6]},
    }
    monkeypatch.setattr(store, 'get_embedding', lambda _: [1, 0])
    results = store.search_documents('question', n_results=1, document_types=CHAT_DOCUMENT_TYPES,
                                     document_ids={'1', '3'})
    assert [row['source']['id'] for row in results] == ['3']
    assert not public_source({'type': 'candidate_cv_raw', 'title': 'CV'})


def test_feedback_migration_repeat_and_preserve_rows():
    spec=importlib.util.spec_from_file_location('feedback_migration',Path(__file__).parents[1]/'alembic/versions/0020_chat_answer_feedback.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    assert migration.down_revision=='0019'
    engine=sa.create_engine('sqlite://')
    with engine.begin() as conn:
        for name in ('users','chat_history'):conn.execute(sa.text(f'CREATE TABLE {name} (id INTEGER PRIMARY KEY)'))
        conn.execute(sa.text('CREATE TABLE chat_conversations (id CHAR(32) PRIMARY KEY)'))
        migration.op=Operations(MigrationContext.configure(conn))
        migration.upgrade();migration.upgrade();migration.downgrade();migration.downgrade();migration.upgrade()
        conn.execute(sa.text("INSERT INTO chat_answer_feedback (user_id,chat_history_id,rating) VALUES (1,1,'helpful')"))
        with pytest.raises(RuntimeError,match='No data was removed'):migration.downgrade()
    engine.dispose()
