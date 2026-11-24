import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
const require=createRequire(import.meta.url),engine=require('../../tmp/minigames-tests/index.js'),ts=createRequire(new URL('../../frontend/package.json',import.meta.url))('typescript')
const source=readFileSync(new URL('../../frontend/src/features/minigames/learningStorage.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
function setup(){const entries=new Map(),state={quota:false};const exports={};vm.runInNewContext(compiled,{exports,require:()=>engine,localStorage:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>{if(state.quota)throw Error('quota');entries.set(k,v)},removeItem:k=>entries.delete(k)}});return{api:exports,entries,state}}
const event=id=>({event_id:id,game:'falling',level:'N5',source_type:'kanji',source_id:'日',action:'wrong',answer:'wrong'})
test('outbox survives reopening, deduplicates seen events, preserves newly queued events on ack and isolates accounts',()=>{
 const {api}=setup();assert.equal(api.queueLearning(1,[event('a')]),true);assert.equal(api.queueLearning(1,[event('a')]),true)
 assert.equal(api.loadArcade(1).store.outbox.length,1);assert.equal(api.loadArcade(2).store.outbox.length,0)
 api.queueLearning(1,[event('b')]);api.acknowledgeLearning(1,['a']);assert.equal(api.loadArcade(1).store.outbox[0].event_id,'b')
 api.queueLearning(1,[event('a')]);assert.equal(api.loadArcade(1).store.outbox.length,1)
 assert.equal(api.loadArcade(1).store.reviews['kanji:日'].count,2)
})
test('quota and future/corrupted progress never overwrite saved records',()=>{
 const {api,entries,state}=setup();api.queueLearning(1,[event('a')]);const old=entries.get(api.arcadeKey(1));state.quota=true
 assert.equal(api.queueLearning(1,[event('b')]),false);assert.equal(entries.get(api.arcadeKey(1)),old)
 state.quota=false;entries.set(api.arcadeKey(1),'{"version":99}')
 assert.equal(api.queueLearning(1,[event('b')]),false);assert.equal(entries.get(api.arcadeKey(1)),'{"version":99}')
})
