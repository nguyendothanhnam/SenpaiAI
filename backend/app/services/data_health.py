"""Read-only data diagnostics. No vector service import, network, or schema creation."""
import ast
from collections import Counter
import json
import math
import re
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
import sqlalchemy as sa

BACKEND = Path(__file__).resolve().parents[2]
PROJECT = BACKEND.parent
LEVELS = ('N5','N4','N3','N2','N1')


def valid_vector(value):
    return isinstance(value,list) and len(value)==768 and all(type(v) in (int,float) and math.isfinite(v) for v in value) and sum(v*v for v in value)>0


def read_json(path):
    path=Path(path)
    if path.stat().st_size>128*1024*1024: raise ValueError('JSON exceeds diagnostic size limit')
    return json.loads(path.read_text(encoding='utf-8'))


def migration_config():
    config=Config(str(BACKEND/'alembic.ini'))
    config.set_main_option('script_location',str(BACKEND/'alembic'))
    return config


def revisions():
    scripts=ScriptDirectory.from_config(migration_config())
    return scripts,sorted(scripts.get_heads())


def grouped(connection,table_name,level='jlpt_level'):
    table=sa.Table(table_name,sa.MetaData(),autoload_with=connection)
    total=connection.scalar(sa.select(sa.func.count()).select_from(table))
    counts=dict(connection.execute(sa.select(table.c[level],sa.func.count()).group_by(table.c[level])).all()) if level in table.c else {}
    return {'total':total,'by_level':{key:counts.get(key,0) for key in LEVELS},'unclassified':counts.get(None,0)}


def diagnostic(engine,vector_dir,media_dir,quick=False):
    _,heads=revisions()
    result={'database':engine.url.database,'migration':{'current':[],'latest':heads},'sections':{}}
    sections=result['sections']
    result['file_issues']=[]
    def asset(path,default):
        try:return read_json(path)
        except (OSError,ValueError) as exc:
            result['file_issues'].append({'path':str(path),'error':type(exc).__name__});return default
    with engine.connect() as connection:
        current=sorted(MigrationContext.configure(connection).get_current_heads())
        result['migration'].update(current=current,ready=current==heads)
        names=set(sa.inspect(connection).get_table_names())
        for key,table in [('kanji','kanji'),('vocabulary','vocabulary'),('grammar','grammar_questions'),('listening','listening_lessons'),('library','documents')]:
            if table not in names:
                sections[key]={'status':'missing','ready':False,'total':0,'command':f'python scripts/setup_data.py --groups {key}'}
                continue
            stats=grouped(connection,table)
            sections[key]={**stats,'ready':stats['total']>0,'status':'ready' if stats['total'] else 'missing','command':f'python scripts/setup_data.py --groups {key}'}
            required={'vocabulary':{'meaning_en','meaning_vi_status','source_id','search_text'},'grammar_questions':{'payload','correct_answer'},'listening_lessons':{'segments','audio_path'}}.get(table,set())
            missing=required-{c['name'] for c in sa.inspect(connection).get_columns(table)}
            if missing:sections[key].update(ready=False,status='schema_mismatch',missing_columns=sorted(missing),message='Check branch and DATABASE_URL. Revision numbers alone cannot identify a different branch schema; do not stamp or delete data automatically.')
            if key=='vocabulary' and not quick and not missing:
                source=sa.Table(table,sa.MetaData(),autoload_with=connection)
                sections[key]['vietnamese_reviewed']=connection.scalar(sa.select(sa.func.count()).select_from(source).where(source.c.meaning_vi_status=='reviewed'))
                sections[key]['english_meanings']=connection.scalar(sa.select(sa.func.count()).select_from(source).where(source.c.meaning_en.isnot(None)))
        if quick:
            return result
        if 'listening_lessons' in names:
            table=sa.Table('listening_lessons',sa.MetaData(),autoload_with=connection)
            rows=connection.execute(sa.select(table.c.audio_path,table.c.jlpt_level)).all()
            media=Path(media_dir).resolve()
            audio=Counter()
            for row in rows:
                if not row.audio_path: continue
                path=(media/row.audio_path).resolve()
                if path.is_relative_to(media) and path.is_file(): audio[row.jlpt_level]+=1
            sections['listening'].update(audio_total=sum(audio.values()),audio_by_level={k:audio[k] for k in LEVELS},ready=bool(rows) and sum(audio.values())==len(rows),status='ready' if rows and sum(audio.values())==len(rows) else 'transcripts_only',command='python scripts/setup_data.py --groups audio --external')
        documents=[]
        if 'documents' in names:
            table=sa.Table('documents',sa.MetaData(),autoload_with=connection)
            documents=connection.execute(sa.select(table.c.id,table.c.title,table.c.content,table.c.jlpt_level)).mappings().all()
        for table_name in ('placement_questions',):
            if table_name in names:
                sections['placement']=grouped(connection,table_name) if table_name=='placement_questions' else {'total':0}
        if 'placement_questions' not in names:
            sections['placement']={'total':0,'ready':False,'status':'missing','message':'Placement schema is missing; apply Alembic migrations, then import and review the placement bank separately','command':'alembic upgrade head'}
        else:
            table=sa.Table('placement_questions',sa.MetaData(),autoload_with=connection)
            demo=connection.scalar(sa.select(sa.func.count()).select_from(table).where(table.c.is_demo.is_(True))) if 'is_demo' in table.c else None
            sections['placement'].update(demo_total=demo,ready=False,status='requires_bank_review',message='Check demo/reviewed markers before using for placement')
            if demo and demo==sections['placement']['total']:
                sections['placement'].update(status='demo_only',message='Only demo/sample placement questions exist; not ready for a real placement result.')
    dictionary=asset(BACKEND/'app/data/kanji_dictionary.json',[])
    counts=Counter(row.get('jlpt') for row in dictionary)
    sections['dictionary']={'ready':bool(dictionary),'status':'ready' if dictionary else 'missing_files','total':len(dictionary),'by_level':{k:counts[k] for k in LEVELS},'metadata_complete':sum(bool(row.get('meaning_vi') and (row.get('onyomi') or row.get('kunyomi')) and row.get('stroke_count',row.get('strokes'))) for row in dictionary)}
    strokes=asset(BACKEND/'app/data/kanjivg_strokes.json',{})
    covered=Counter(row.get('jlpt') for row in dictionary if row['kanji'] in strokes)
    sections['strokes']={'total':sum(covered.values()),'by_level':{k:covered[k] for k in LEVELS},'ready':sum(covered.values())==len(dictionary),'status':'ready' if sum(covered.values())==len(dictionary) else 'partial','command':'python ../scripts/setup_kanjivg.py --clone','message':'Counts use committed JSON, not untracked local SVG files.'}
    svg_dir=BACKEND/'app/data/kanjivg/kanji'
    local={chr(int(p.stem,16)) for p in svg_dir.glob('*.svg') if re.fullmatch('[0-9a-fA-F]{4,6}',p.stem) and int(p.stem,16)<=0x10ffff}
    sections['strokes']['effective_local_total']=sum(row['kanji'] in strokes or row['kanji'] in local for row in dictionary)
    sections['strokes']['local_svg_extras']=sum(row['kanji'] not in strokes and row['kanji'] in local for row in dictionary)
    path=Path(vector_dir)/'knowledge_vectors.json'
    vectors=asset(path,{}) if path.is_file() else {}
    indexed=Counter();verified=Counter();verified_ids=set();stale=0
    docs={str(d['id']):d for d in documents}
    for record in vectors.values():
        doc=docs.get(str(record.get('document_id',record.get('metadata',{}).get('document_id',''))))
        if not doc: continue
        metadata=record.get('metadata',{})
        if record.get('content')!=doc['content'] or metadata.get('title')!=doc['title']: stale+=1;continue
        indexed[doc['jlpt_level']]+=1
        if metadata.get('bootstrap_embedding_model')=='nomic-embed-text' and valid_vector(record.get('vector')):
            verified[doc['jlpt_level']]+=1;verified_ids.add(str(doc['id']))
    sections['index']={'total':len(vectors),'library_records':sum(indexed.values()),'verified_real_embeddings':len(verified_ids),'by_level':{k:indexed[k] for k in LEVELS},'stale_records':stale,'ready':bool(documents) and len(verified_ids)==len(documents),'status':'ready' if documents and len(verified_ids)==len(documents) else 'missing_or_unverified','command':'python scripts/setup_data.py --groups index --external','message':'Existing hash fallback vectors are not certified as real embeddings.'}
    catalog=PROJECT/'shared-games/catalog.json'
    if catalog.is_file():
        data=asset(catalog,{}); words=data.get('words',[]); kana=data.get('kanji',[])
        levels={k:{'kanji':sum(r.get('level')==k for r in kana),'words':sum(r.get('level')==k for r in words)} for k in LEVELS}
        missing=[k for k,value in levels.items() if value['kanji'] and not value['words']]
        sections['minigames']={'status':'partial' if missing or not kana else 'ready','ready':bool(kana and words) and not missing,'kanji':len(kana),'words':len(words),'by_level':levels,'missing_word_levels':missing,'command':'python ../scripts/build_minigame_catalog.py --audit','message':'Static shared catalog, not database vocabulary. Missing word pools require reviewed dictionary examples; per-game minimums still apply.'}
    else: sections['minigames']={'status':'missing_files','ready':False,'command':'python scripts/build_minigame_catalog.py','message':'Run on host checkout; shared-games is outside the backend Docker build context.'}
    result['ready']=result['migration']['ready'] and all(s.get('ready',False) for s in sections.values())
    return result


def warn_data_state(engine,logger,settings=None):
    try:
        state=diagnostic(engine,'','',quick=True)
        missing=[k for k,v in state['sections'].items() if not v['ready']]
        if settings and not (Path(settings.chroma_persist_directory)/'knowledge_vectors.json').is_file():missing.append('library_index')
        if not state['migration']['ready'] or missing:
            logger.warning('[Data] Migration current=%s latest=%s; missing=%s. Run python scripts/setup_data.py and python scripts/data_status.py.',state['migration']['current'],state['migration']['latest'],missing)
    except Exception as exc:
        logger.warning('[Data] Unable to inspect data (%s). Run python scripts/data_status.py.',type(exc).__name__)


KNOWN={
 'setup_data.py':('idempotent_additive','ordered orchestrator; --download permits OpenJLPT network; --external permits existing services'),
 'data_status.py':('read_only','no network, no directory/schema creation'),
 'report_vocabulary.py':('read_only','database inventory; no translations'),
 'validate_kanji_dictionary.py':('read_only','dictionary validation; no database writes'),
 'validate_kanjivg_coverage.py':('read_only','coverage audit; no source repair'),
 'populate_data.py':('unsafe_to_repeat','legacy sample loader adds rows directly; not run by setup'),
 'seed_grammar_practice.py':('idempotent','grammar rules then questions; no external service'),
 'seed_kanji_from_dictionary.py':('idempotent_overwrites_n3','N3 only; replaces existing readings/examples; setup uses additive all-level adapter'),
 'seed_library_documents.py':('idempotent','library JSON; indexing invokes Ollama, runtime may fall back to hash'),
 'import_knowledge_library.py':('upsert_with_fuzzy_titles','library; indexing/Ollama; do not run blindly on custom titles'),
 'seed_listening.py':('idempotent','transcripts offline; audio needs VOICEVOX; tokens may need optional local analyzer'),
 'import_openjlpt.py':('idempotent','kanji before vocabulary links; --download requires network; pinned manifest/checksums'),
 'import_kanjivg.py':('review_output','requires local official SVG source; review output/merge before overwriting'),
 'setup_kanjivg.py':('rebuild_source','--clone downloads official KanjiVG; no model'),
 'build_minigame_catalog.py':('deterministic_rebuild','dictionary/strokes before static shared catalogs; overwrites generated artifacts'),
 'merge_kanji_n3.py':('idempotent_default','local JSON; --overwrite changes existing entries; backups by default'),
 'repair_kanji_n5_n4.py':('dry_run_default','local supplementary files; --write changes main dictionary'),
 'generate_vapid_keys.py':('manual_only','generates secrets; never part of data setup'),
}


def inventory():
    scripts=[]
    paths=[*sorted((BACKEND/'scripts').glob('*.py')),*sorted((PROJECT/'scripts').glob('*.py')),BACKEND/'populate_data.py']
    for path in paths:
        tree=ast.parse(path.read_text(encoding='utf-8-sig'))
        status,note=KNOWN.get(path.name,('manual_or_check','not auto-run; inspect --help and source'))
        scripts.append({'path':path.relative_to(PROJECT).as_posix(),'repeatability':status,'notes':note,'arguments':[arg.value for node in ast.walk(tree) if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='add_argument' for arg in node.args if isinstance(arg,ast.Constant) and isinstance(arg.value,str)]})
    script,heads=revisions()
    return {'scripts':scripts,'launchers':[
        {'path':'backend/scripts/setup_data.ps1','notes':'PowerShell forwards to the same Python setup and preserves exit codes'},
        {'path':'database/init.sql','notes':'PostgreSQL role/extension/type initialization; table creation belongs to Alembic'},
        {'path':'docker-compose.yml','notes':'Existing backend command auto-pulls models and runs non-idempotent populate_data.py; override command for controlled setup'},
        {'path':'setup-ollama.bat / setup-ollama.sh','notes':'Network/model installation; never invoked by data setup'},
        {'path':'start.bat / start.sh','notes':'Application launchers; not a replacement for the data setup command'}],
        'migrations':[{'revision':r.revision,'parent':r.down_revision,'file':Path(r.path).name} for r in reversed(list(script.walk_revisions()))],'heads':heads,'order':list(('schema','kanji','vocabulary','library','grammar','placement','listening','minigames','index','audio'))}
