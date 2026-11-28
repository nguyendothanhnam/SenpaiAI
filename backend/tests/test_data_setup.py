import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import logging

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
import httpx
from app.core.database import Base
from app.models.database import Kanji,Document
from app.services import data_setup as setup, data_health as health


@pytest.fixture
def db():
    engine=sa.create_engine('sqlite://')
    @sa.event.listens_for(engine,'connect')
    def configure(connection,record):connection.create_function('char_length',1,len)
    Base.metadata.create_all(engine)
    with Session(engine) as session:yield session
    engine.dispose()


def test_dependency_order_and_unknown_group():
    assert setup.plan(['index'])==['schema','library','index']
    assert setup.plan(['placement'])==['schema','kanji','vocabulary','library','grammar','placement']
    with pytest.raises(ValueError):setup.plan(['drop-all'])


def test_real_source_seeds_are_additive_and_repeat_safe(db):
    first=setup.seed_kanji(db);second=setup.seed_kanji(db)
    assert first['created']==612 and second['created']==0
    item=db.query(Kanji).first();item.meaning_vi='edited locally';db.commit()
    setup.seed_kanji(db);assert item.meaning_vi=='edited locally'
    assert setup.seed_documents(db)['created']==113
    assert setup.seed_documents(db)['created']==0
    doc=db.query(Document).first();doc.content='custom content';db.commit()
    assert setup.seed_documents(db)['content_conflicts']==1
    assert doc.content=='custom content'


def test_health_does_not_create_files_or_modify_schema(db,tmp_path):
    before=set(sa.inspect(db.bind).get_table_names())
    state=health.diagnostic(db.bind,tmp_path/'vectors',tmp_path/'audio')
    assert not (tmp_path/'vectors').exists()
    assert set(sa.inspect(db.bind).get_table_names())==before
    assert state['migration']['current']==[]
    assert state['sections']['placement']['status']=='not_in_branch'
    assert state['sections']['strokes']['by_level']['N4']==0
    assert state['sections']['minigames']['missing_word_levels']==['N5','N4']
    assert state['sections']['index']['verified_real_embeddings']==0


def test_missing_files_reported_instead_of_claiming_ready(db,tmp_path,monkeypatch):
    monkeypatch.setattr(health,'PROJECT',tmp_path)
    monkeypatch.setattr(health,'BACKEND',tmp_path/'backend')
    monkeypatch.setattr(health,'revisions',lambda:(None,['test']))
    result=health.diagnostic(db.bind,tmp_path/'vectors',tmp_path/'audio')
    assert result['sections']['dictionary']['status']=='missing_files'
    assert result['file_issues'] and not result['ready']


def test_index_skips_unavailable_provider_without_fake_vectors(db,tmp_path,monkeypatch):
    def offline(*args,**kwargs):raise httpx.ConnectError('offline')
    monkeypatch.setattr(setup.httpx,'get',offline)
    settings=SimpleNamespace(chroma_persist_directory=str(tmp_path),ollama_base_url='http://127.0.0.1:1')
    with pytest.raises(setup.Skipped):setup.index_library(db,settings)
    assert not (tmp_path/'knowledge_vectors.json').exists()


def test_strict_index_protocol_atomic_idempotent_and_preserves_unrelated(db,tmp_path,monkeypatch):
    setup.seed_documents(db)
    path=tmp_path/'knowledge_vectors.json';path.write_text(json.dumps({'personal':{'content':'keep'}}),encoding='utf8')
    monkeypatch.setattr(setup,'require_embedding',lambda _:None)
    calls=[]
    def embedding(settings,text):calls.append(text);return [1.0]*768
    monkeypatch.setattr(setup,'real_embedding',embedding)
    settings=SimpleNamespace(chroma_persist_directory=str(tmp_path))
    assert setup.index_library(db,settings)['indexed']==113
    assert setup.index_library(db,settings)['indexed']==0
    assert len(calls)==113
    data=health.read_json(path);assert data['personal']=={'content':'keep'}
    assert path.with_suffix('.json.before-bootstrap').is_file()
    assert len(data)==114


def test_index_failure_does_not_replace_existing_file(db,tmp_path,monkeypatch):
    setup.seed_documents(db);path=tmp_path/'knowledge_vectors.json';path.write_text('{}',encoding='utf8')
    monkeypatch.setattr(setup,'require_embedding',lambda _:None)
    def invalid(*args):raise ValueError('invalid actual provider response')
    monkeypatch.setattr(setup,'real_embedding',invalid)
    with pytest.raises(ValueError):setup.index_library(db,SimpleNamespace(chroma_persist_directory=str(tmp_path)))
    assert path.read_text(encoding='utf8')=='{}'


def test_inventory_covers_every_script_and_migration():
    report=health.inventory()
    assert len(report['migrations'])==14
    assert any(row['path']=='backend/populate_data.py' and row['repeatability']=='unsafe_to_repeat' for row in report['scripts'])
    assert len(report['scripts'])==len(list((health.BACKEND/'scripts').glob('*.py')))+len(list((health.PROJECT/'scripts').glob('*.py')))+1


def test_startup_warning_is_advisory_and_never_creates_tables(caplog):
    engine=sa.create_engine('sqlite://')
    with caplog.at_level(logging.WARNING):health.warn_data_state(engine,logging.getLogger('test.data'))
    assert 'setup_data.py' in caplog.text and not sa.inspect(engine).get_table_names()


def test_cli_stops_at_failure_and_does_not_run_dependents(monkeypatch,capsys):
    path=health.BACKEND/'scripts/setup_data.py'
    spec=importlib.util.spec_from_file_location('setup_cli',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    calls=[]
    def run(name,*args):
        calls.append(name)
        if name=='library':raise ValueError('source invalid')
        return {}
    monkeypatch.setattr(module,'run_step',run)
    assert module.main(['--groups','grammar'])==1
    assert calls==['schema','library']
    assert '[library] FAILED' in capsys.readouterr().err


def test_valid_vector_rejects_corruption():
    assert health.valid_vector([1.0]*768)
    assert not health.valid_vector([0.0]*768)
    assert not health.valid_vector([float('nan')]*768)
    assert not health.valid_vector([1.0]*10)


def test_check_only_never_calls_setup_even_with_network_flags(monkeypatch):
    spec=importlib.util.spec_from_file_location('setup_readonly',health.BACKEND/'scripts/setup_data.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    calls=[]
    monkeypatch.setattr(module,'script',lambda _:SimpleNamespace(check=lambda *a,**kw:calls.append('check') or 2))
    def forbidden(*args):raise AssertionError('setup must not run')
    monkeypatch.setattr(module,'run_step',forbidden)
    assert module.main(['--check-only','--download','--external'])==2
    assert calls==['check']


def test_demo_only_placement_is_never_ready(db,tmp_path):
    with db.bind.begin() as connection:
        connection.execute(sa.text('CREATE TABLE placement_questions(id INTEGER PRIMARY KEY, jlpt_level TEXT, is_demo BOOLEAN)'))
        connection.execute(sa.text("INSERT INTO placement_questions VALUES (1,'N5',1)"))
    state=health.diagnostic(db.bind,tmp_path/'vectors',tmp_path/'audio')
    assert state['sections']['placement']['status']=='demo_only'
    assert not state['sections']['placement']['ready']
