"""Additive, ordered setup using real versioned sources. No schema or API changes."""
import importlib.util
import json
import math
import os
from pathlib import Path
import tempfile

import httpx
from sqlalchemy import select
from .data_health import BACKEND, PROJECT, read_json, migration_config, valid_vector

ORDER=('schema','kanji','vocabulary','library','grammar','placement','listening','minigames','index','audio')
DEPENDENCIES={'kanji':['schema'],'vocabulary':['kanji'],'library':['schema'],'grammar':['library'],
 'placement':['grammar','vocabulary'],'listening':['schema'],'index':['library'],'audio':['listening'],'minigames':[],'schema':[]}


class Skipped(Exception):
    pass


def plan(groups):
    selected=set()
    def add(name):
        if name not in DEPENDENCIES: raise ValueError('Unknown group: '+name)
        if name in selected:return
        selected.add(name)
        for parent in DEPENDENCIES[name]:add(parent)
    for name in groups:add(name)
    return [name for name in ORDER if name in selected]


def script(name):
    path=BACKEND/'scripts'/f'{name}.py'
    spec=importlib.util.spec_from_file_location('setup_'+name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def source_documents():
    loader=script('seed_library_documents')
    docs=loader.load_documents(BACKEND/'scripts/data/library_documents.json')
    errors=loader.validate_documents(docs)
    if errors:raise ValueError('; '.join(errors))
    loader=script('import_knowledge_library')
    for row in loader.parse_json_file(BACKEND/'app/data/japanese_knowledge_seed.json'):
        title,content=loader.format_item_content(row)
        if not title or not content:raise ValueError('Knowledge source has an empty document')
        docs.append({'title':title,'content':content,'document_type':row.get('type','lesson'),'jlpt_level':row.get('level'),'tags':row.get('tags',[]),'source_url':row.get('source_url')})
    by_title={}
    for doc in docs:
        if doc['title'] in by_title and by_title[doc['title']]['content']!=doc['content']: raise ValueError('Conflicting source titles: '+doc['title'])
        by_title[doc['title']]=doc
    return list(by_title.values())


def seed_kanji(db):
    from ..models.database import Kanji,KanjiReading,KanjiExample
    counts={'created':0,'existing_preserved':0,'missing_meaning':0}
    entries=read_json(BACKEND/'app/data/kanji_dictionary.json')
    for entry in entries:
        key=entry.get('kanji');level=entry.get('jlpt');meaning=entry.get('meaning_vi')
        if not key or level not in ('N5','N4','N3','N2','N1'):raise ValueError('Invalid kanji source')
        if not meaning:counts['missing_meaning']+=1;continue
        if db.query(Kanji.id).filter_by(character=key).first():counts['existing_preserved']+=1;continue
        row=Kanji(character=key,jlpt_level=level,meaning_vi=meaning,stroke_count=entry.get('stroke_count',entry.get('strokes')))
        db.add(row);db.flush()
        for field in ('onyomi','kunyomi'):
            for reading in dict.fromkeys(entry.get(field,[])):
                if reading:db.add(KanjiReading(kanji_id=row.id,reading_type=field,reading=reading))
        seen=set()
        for example in entry.get('examples',[]):
            word=example.get('word',example.get('sentence',''))
            if not word or word in seen:continue
            seen.add(word);db.add(KanjiExample(kanji_id=row.id,sentence=word,reading=example.get('reading',''),meaning_vi=example.get('meaning_vi',example.get('meaning',''))))
        counts['created']+=1
    db.commit();return counts


def seed_documents(db):
    from ..models.database import Document
    counts={'created':0,'existing_preserved':0,'content_conflicts':0}
    for doc in source_documents():
        titles=[doc['title'],*doc.get('legacy_titles',[])]
        query=db.query(Document).filter(Document.title.in_(titles))
        if hasattr(Document,'owner_id'):query=query.filter(Document.owner_id.is_(None))
        old=query.first()
        if old:
            counts['existing_preserved']+=1;counts['content_conflicts']+=int(old.content!=doc['content']);continue
        db.add(Document(**{k:doc.get(k) for k in ('title','content','document_type','jlpt_level','tags','source_url')}));counts['created']+=1
    db.commit();return counts


def vocabulary(db,download):
    from ..services.openjlpt_import import import_entries
    loader=script('import_openjlpt');directory=loader.DEFAULT_DIRECTORY
    if not (directory/'manifest.json').is_file():
        if not download:raise Skipped('OpenJLPT cache missing. Run python scripts/setup_data.py --groups vocabulary --download (real pinned upstream dataset).')
        loader.download(directory)
    rows,metadata,manifest=loader.load_dataset(directory)
    result=import_entries(db,rows,f"{metadata['version']}@{manifest['commit']}",dry_run=False,upstream=metadata.get('sources',{}))
    # Importer reports malformed rows instead of raising. Setup must not certify a partial corrupt source.
    if result.get('errors') or result.get('invalid',0):raise ValueError('OpenJLPT importer reported invalid source rows')
    db.commit();return result


def real_embedding(settings,text):
    response=httpx.post(settings.ollama_base_url.rstrip('/')+'/api/embeddings',json={'model':'nomic-embed-text','prompt':text},timeout=30)
    response.raise_for_status();vector=response.json().get('embedding')
    if not isinstance(vector,list) or len(vector)!=768 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in vector):raise ValueError('Invalid real embedding response (expected 768 finite values)')
    norm=math.sqrt(sum(v*v for v in vector))
    if not norm:raise ValueError('Empty real embedding vector')
    return [v/norm for v in vector]


def require_embedding(settings):
    try:
        response=httpx.get(settings.ollama_base_url.rstrip('/')+'/api/tags',timeout=3);response.raise_for_status()
        names=[m.get('name','').split(':')[0] for m in response.json().get('models',[])]
    except (httpx.HTTPError,ValueError):raise Skipped('Ollama unavailable; start it, then --groups index --external. No vectors were synthesized.')
    if 'nomic-embed-text' not in names:raise Skipped('nomic-embed-text is not installed. No model auto-download; install it separately, then --groups index --external.')


def index_library(db,settings):
    """Atomic merge into the existing file protocol; never invoke hash fallback or clear user records."""
    from ..models.database import Document
    require_embedding(settings)
    path=Path(settings.chroma_persist_directory)/'knowledge_vectors.json'
    original=read_json(path) if path.is_file() else {}
    records=dict(original);known={d['title'] for d in source_documents()}
    query=db.query(Document).filter(Document.title.in_(known))
    if hasattr(Document,'owner_id'):query=query.filter(Document.owner_id.is_(None))
    created=unchanged=0
    for doc in query.order_by(Document.id):
        key=f'{doc.id}_0';old=records.get(key,{})
        if old.get('content')==doc.content and old.get('metadata',{}).get('title')==doc.title and old.get('metadata',{}).get('bootstrap_embedding_model')=='nomic-embed-text' and valid_vector(old.get('vector')):unchanged+=1;continue
        vector=real_embedding(settings,f'{doc.title}\n{doc.content}')
        records[key]={'id':key,'document_id':str(doc.id),'content':doc.content,'vector':vector,'metadata':{
            'document_id':str(doc.id),'title':doc.title,'document_type':doc.document_type,'type':doc.document_type,'jlpt_level':doc.jlpt_level or '',
            'tags':','.join(doc.tags or []),'source_url':doc.source_url or '','chunk_index':0,'total_chunks':1,'bootstrap_embedding_model':'nomic-embed-text'}}
        created+=1
    if created:
        path.parent.mkdir(parents=True,exist_ok=True)
        if path.is_file():
            backup=path.with_suffix('.json.before-bootstrap')
            if not backup.exists():backup.write_bytes(path.read_bytes())
        descriptor,temp=tempfile.mkstemp(dir=path.parent,prefix='setup-vectors-',suffix='.tmp')
        try:
            with os.fdopen(descriptor,'w',encoding='utf8') as handle:json.dump(records,handle,ensure_ascii=False)
            # Detect another process writing; never silently overwrite an active backend's new index data.
            if path.is_file() and read_json(path)!=original:raise RuntimeError('Index changed concurrently; stop backend and retry')
            os.replace(temp,path)
        finally:
            if Path(temp).exists():Path(temp).unlink()
    for doc in query:
        doc.embedding_id=f'{doc.id}_0';doc.chunk_index=0
    db.commit();return {'indexed':created,'unchanged':unchanged}


def run_step(name,engine,settings,args):
    if name=='schema':
        from alembic import command
        command.upgrade(migration_config(),'head');return {'migration':'head'}
    if name=='minigames':
        path=PROJECT/'shared-games/catalog.json'
        if not path.is_file():raise Skipped('shared-games/catalog.json not mounted in backend container; validate it on the host checkout.')
        data=read_json(path)
        if not data.get('kanji') or not data.get('words'):raise ValueError('Static minigame catalog is empty')
        return {'kanji':len(data['kanji']),'words':len(data['words']),'action':'validated committed catalog; no rewrite'}
    if name=='placement':raise Skipped('Import and review the placement question bank separately; data setup does not seed it or certify grammar examples as placement questions.')
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        if name=='kanji':return seed_kanji(db)
        if name=='vocabulary':return vocabulary(db,args.download)
        if name=='library':return seed_documents(db)
        if name=='grammar':return script('seed_grammar_practice').seed(db)
        if name=='listening':return script('seed_listening').seed(db=db,generate_audio=False)
        if name=='index':
            if not args.external:raise Skipped('External indexing disabled. Run --groups index --external when real nomic-embed-text is available; no fallback vectors are created.')
            return index_library(db,settings)
        if name=='audio':
            if not args.external:raise Skipped('Audio disabled. Transcripts are seeded; run --groups audio --external with VOICEVOX for real WAV audio.')
            try:
                response=httpx.get(settings.voicevox_url.rstrip('/')+'/speakers',timeout=3);response.raise_for_status()
            except httpx.HTTPError:raise Skipped('VOICEVOX unavailable; start it then run --groups audio --external.')
            return script('seed_listening').seed(db=db,generate_audio=True)
    raise ValueError('Unknown step: '+name)
