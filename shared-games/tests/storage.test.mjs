import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const engine = require('../../tmp/minigames-tests/index.js')
const webRequire = createRequire(new URL('../../frontend/package.json',import.meta.url))
const ts = webRequire('typescript')
const source = readFileSync(new URL('../../frontend/src/features/minigames/storage.ts',import.meta.url),'utf8')
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
function setup() {
  const data = new Map(), state = { unavailable:false, quota:false }
  const localStorage = {
    getItem(key) { if(state.unavailable) throw new Error('unavailable'); return data.get(key) ?? null },
    setItem(key,value) { if(state.quota) throw new Error('quota'); data.set(key,value) },
  }
  const module = { exports:{} }
  vm.runInNewContext(compiled,{exports:module.exports,module,require:()=>engine,localStorage})
  return { api:module.exports,data,state }
}
const session = () => engine.finish({...engine.createRound('falling','N3','normal',1).session,score:200},'quit')
test('actual browser adapter separates two accounts and preserves records after reopening', () => {
  const {api}=setup(), s=session(), key=engine.statsKey('falling','N3','normal','reading')
  assert.equal(api.saveSession(1,key,s),true)
  assert.equal(api.loadStats(1).store.entries[key].highScore,200)
  assert.equal(Object.keys(api.loadStats(2).store.entries).length,0)
  assert.equal(api.saveSession(1,key,s),true)
  assert.equal(api.loadStats(1).store.entries[key].played,1)
  assert.equal(api.saveSession(2,key,{...s,id:'other',score:15}),true)
  assert.equal(api.loadStats(1).store.entries[key].highScore,200)
  assert.equal(api.loadStats(2).store.entries[key].highScore,15)
})
test('blocked storage, quota, malformed and future versions fail safely without overwriting records', () => {
  const {api,data,state}=setup(), s=session(), key='test', storageKey=engine.accountStorageKey(1)
  state.unavailable=true
  assert.equal(api.loadStats(1).error,true); assert.equal(api.saveSession(1,key,s),false)
  state.unavailable=false; state.quota=true
  assert.equal(api.saveSession(1,key,s),false); assert.equal(data.size,0)
  state.quota=false
  for(const original of ['{bad','{"version":2,"entries":{}}']) {
    data.set(storageKey,original)
    assert.equal(api.saveSession(1,key,s),false)
    assert.equal(data.get(storageKey),original)
  }
})
test('recipe collections persist immediately, deduplicate and stay separate across accounts and wallet stats',()=>{
  const {api,data,state}=setup(), known=engine.compoundsFor('N3').slice(0,2).map(w=>w.id)
  assert.equal(api.saveRecipes(1,known),true)
  assert.equal(api.loadRecipes(1).recipes.length,2)
  assert.equal(api.loadRecipes(2).recipes.length,0)
  assert.equal(api.saveRecipes(1,[known[0],'fake']),true)
  assert.equal(api.loadRecipes(1).recipes.length,2)
  assert.equal(Object.keys(api.loadStats(1).store.entries).length,0)
  state.quota=true;assert.equal(api.saveRecipes(2,known),false);state.quota=false
  data.set(api.recipeStorageKey(2),'{"version":2,"recipes":[]}')
  assert.equal(api.saveRecipes(2,known),false)
  assert.equal(data.get(api.recipeStorageKey(2)),'{"version":2,"recipes":[]}')
})
