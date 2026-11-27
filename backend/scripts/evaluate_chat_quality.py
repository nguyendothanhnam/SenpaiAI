"""Run the REAL text-chat route with an isolated account/history, local catalog and Ollama.

No application account is created/modified. Offline disables generation, not grading.
Catalog snapshot is reused for before/after; production never reads evaluation gold.
"""
import argparse
import asyncio
import hashlib
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine,event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.core.database import Base,SessionLocal
from app.models.database import User,Document,GrammarRule,Vocabulary,ChatHistory
from app.models.schemas import ChatMessage
from app.api import chat as pipeline
from app.services.chat_evaluation import grade,summarize,RUBRIC_VERSION


def memory_snapshot():
    try:
        with urllib.request.urlopen(settings.ollama_base_url.rstrip('/')+'/api/ps',timeout=3) as response:
            data=json.load(response)
        return [{'model':r.get('name') or r.get('model'),'size_bytes':r.get('size'),
                 'vram_bytes':r.get('size_vram'),'context_length':r.get('context_length')}
                for r in data.get('models',[])]
    except Exception as exc:
        return {'unavailable':type(exc).__name__}


def catalog_snapshot(path):
    if path.is_file():return json.loads(path.read_text(encoding='utf-8'))
    result={}
    with SessionLocal() as source:
        # Documents is the current shared system library; this schema has no owner field.
        for model,limit in ((Document,500),(GrammarRule,2000),(Vocabulary,10000)):
            columns=[c.name for c in model.__table__.columns if c.name not in ('created_at','updated_at')]
            result[model.__tablename__]=[{name:getattr(row,name) for name in columns} for row in source.query(model).order_by(model.id).limit(limit).all()]
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return result


def database(snapshot):
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    @event.listens_for(engine,'connect')
    def setup(conn,record):conn.create_function('char_length',1,len)
    Base.metadata.create_all(engine)
    db=sessionmaker(bind=engine,expire_on_commit=False)()
    user=User(email='chat-evaluation@example.test',username='chat-evaluation',hashed_password='not-a-login',current_jlpt_level='N5',ui_language='vi')
    db.add(user)
    for model in (Document,GrammarRule,Vocabulary):
        db.add_all(model(**row) for row in snapshot[model.__tablename__])
    db.commit()
    return engine,db,user


def available_models():
    try:
        with urllib.request.urlopen(settings.ollama_base_url.rstrip('/')+'/api/tags',timeout=5) as response:
            rows=json.load(response).get('models',[])
        return [row for row in rows if not row.get('capabilities') or 'completion' in row['capabilities']]
    except Exception as exc:
        return [{'name':settings.ollama_model,'availability_error':type(exc).__name__}]


async def run(args):
    raw=args.dataset.read_bytes();dataset=json.loads(raw.decode('utf-8'))
    snapshot=catalog_snapshot(args.snapshot)
    models=available_models()
    selected=([row['name'] for row in models] or [settings.ollama_model]) if args.models=='available' else args.models.split(',')
    if args.models!='available' and any(model not in [r['name'] for r in models] for model in selected):
        raise SystemExit('Requested model is not locally available; no model will be downloaded.')
    modes=args.modes.split(',')
    if any(m not in ('ai','offline') for m in modes):raise SystemExit('Modes must be ai,offline')
    service=pipeline.japanese_service.service
    original_model=service.model;original_call=service._call_ollama
    import ollama
    original_chat,original_generate=ollama.chat,ollama.generate
    metrics=[];candidates=[]
    def capture(payload,options=None):
        get=lambda key:payload.get(key) if hasattr(payload,'get') else getattr(payload,key,None)
        metrics.append({key:get(key) for key in ('prompt_eval_count','eval_count','done_reason','total_duration','load_duration','prompt_eval_duration','eval_duration')}|
                       {'options':options or {},'memory':memory_snapshot()})
    def measured_chat(*pos,**kwargs):
        result=original_chat(*pos,**kwargs);capture(result,kwargs.get('options'));return result
    def measured_generate(*pos,**kwargs):
        result=original_generate(*pos,**kwargs);capture(result,kwargs.get('options'));return result
    ollama.chat,ollama.generate=measured_chat,measured_generate
    original_hook=getattr(service,'_metrics_hook',None)
    service._metrics_hook=lambda record:metrics.append(record)
    report={'phase':args.phase,'rubric_version':RUBRIC_VERSION,'dataset_sha256':hashlib.sha256(raw).hexdigest(),
        'catalog_sha256':hashlib.sha256(json.dumps(snapshot,sort_keys=True,ensure_ascii=True).encode()).hexdigest(),
        'configured_default':settings.ollama_model,'provider':settings.llm_provider,'available_models':models,
        'started_at':datetime.now(timezone.utc).isoformat(),'runs':[],
        'limits':['Single local run, no teacher semantic scoring. Content/Chinese/reading/source checks are heuristic.',
                  'Evaluation account and histories live only in isolated SQLite. Existing system catalog is copied read-only.',
                  'AI and offline use the same text-chat route. Offline raises at the generation boundary.',
                  'No model download or application default change. Only one installed model means no cross-model ranking.']}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    def save():args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8')
    try:
        for mode in modes:
            for model in (selected if mode=='ai' else [original_model]):
                engine,db,user=database(snapshot);service.model=model
                calls=[0]
                def generation(*pos,**kwargs):
                    calls[0]+=1
                    if mode=='offline':raise RuntimeError('evaluation_ai_disabled')
                    answer=original_call(*pos,**kwargs);candidates.append(answer);return answer
                service._call_ollama=generation
                current={'mode':mode,'model':model if mode=='ai' else None,
                    'model_listed':model in [r['name'] for r in models], 'rows':[]};report['runs'].append(current)
                for case in dataset['cases'][:args.limit]:
                    conversation=None;setup_error=None
                    setup_start=time.perf_counter()
                    for prior in case.get('history',[]):
                        try:
                            user.ui_language=case.get('ui_language',case.get('language','vi'))
                            prior_response=await pipeline.send_message(ChatMessage(message=prior,response_language=case.get('response_language',user.ui_language),conversation_id=conversation),user,db)
                            conversation=prior_response.conversation_id
                        except Exception as exc:
                            db.rollback();setup_error=str(getattr(exc,'detail',type(exc).__name__))
                    setup_seconds=time.perf_counter()-setup_start
                    start=time.perf_counter();count_before=calls[0];metric_start=len(metrics);candidate_start=len(candidates);answer='';sources=[];error=None
                    try:
                        user.ui_language=case.get('ui_language',case.get('language','vi'))
                        result=await pipeline.send_message(ChatMessage(message=case['question'],response_language=case.get('response_language',user.ui_language),conversation_id=conversation),user,db)
                        answer=result.answer;sources=result.sources or []
                    except Exception as exc:
                        db.rollback();error=str(getattr(exc,'detail',type(exc).__name__))
                    row={'id':case['id'],'group':case['group'],'question':case['question'],'answer':answer,'sources':sources,
                        'error':error,'setup_error':setup_error,'seconds':round(time.perf_counter()-start,3),'setup_seconds':round(setup_seconds,3),
                        'generation_calls':calls[0]-count_before,'generation_metrics':metrics[metric_start:],
                        'candidate_answers':candidates[candidate_start:],
                        'checks':grade(case,answer,sources,error),'reference':case['reference'],'manual_review':{'correctness':'pending','notes':''}}
                    current['rows'].append(row);current['summary']=summarize(current['rows']);save()
                    print(f"{args.phase} {mode} {model} {case['id']} score={sum(row['checks'].values())}/{len(row['checks'])} t={row['seconds']}s",flush=True)
                current['total_generation_calls']=calls[0]
                db.close();engine.dispose();save()
    finally:
        ollama.chat,ollama.generate=original_chat,original_generate
        service._metrics_hook=original_hook
        service.model=original_model;service._call_ollama=original_call
        report['finished_at']=datetime.now(timezone.utc).isoformat();save()


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    parser=argparse.ArgumentParser()
    parser.add_argument('--dataset',type=Path,default=root/'tests/data/chat_quality_cases.json')
    parser.add_argument('--snapshot',type=Path,default=root.parent/'tmp/chat-quality-catalog.json')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--phase',default='baseline')
    parser.add_argument('--models',default='available')
    parser.add_argument('--modes',default='offline,ai')
    parser.add_argument('--limit',type=int,default=1000)
    asyncio.run(run(parser.parse_args()))
