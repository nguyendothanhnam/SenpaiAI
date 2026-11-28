import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const compile=text=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
const logic={};vm.runInNewContext(compile(source('../src/features/flashcards/logic.ts')),{exports:logic})
const card=(id,starred=false)=>({id,deck_id:1,front:`字${id}`,back:`meaning${id}`,reading:'じ',note:'',progress:{state:'new',starred}})

test('deck validation normalizes duplicate text, enforces bounds and accepts empty decks',()=>{
 const deck={title:'N5',description:'',jlpt_level:'N5',topic:'',cards:[card(1)]}
 assert.equal(logic.validateDeck(deck),null)
 assert.equal(logic.validateDeck({...deck,cards:[]}),null)
 assert.equal(logic.validateDeck({...deck,title:' '}),'invalid')
 assert.equal(logic.validateDeck({...deck,cards:[{...card(1),front:'Ａ  b'},{...card(1),front:'a b'}]}),'duplicateCard')
 assert.equal(logic.validateDeck({...deck,cards:Array(501).fill(card(1))}),'invalid')
 assert.equal(logic.validateDeck({...deck,cards:[{...card(1),reading:'a'.repeat(501)}]}),'invalid')
})
test('starred filtering and shuffle do not mutate cards or duplicate them',()=>{
 const cards=[card(1,true),card(2),card(3,true)]
 assert.equal(JSON.stringify(logic.studyCards(cards,true,false).map(c=>c.id)),'[1,3]')
 const result=logic.studyCards(cards,false,true,()=>0)
 assert.equal(new Set(result.map(c=>c.id)).size,3)
 assert.equal(cards[0].id,1)
 assert.notEqual(result[0].id,1)
})
test('legacy transfer reads without writing or deleting browser data',()=>{
 const data=new Map([['dacs_flashcard_sets',JSON.stringify([{id:'old',name:'N5',cards:[card(1)]}])]])
 const result=logic.legacyDecks({getItem:k=>data.get(k)??null})
 assert.equal(result[0].local_id,'old');assert.equal(result[0].cards[0].id,undefined)
 assert.equal(data.size,1)
 assert.throws(()=>logic.legacyDecks({getItem:()=>'{broken'}))
})
test('drafts are isolated by account and deck; summary counts each card once',()=>{
 assert.notEqual(logic.draftKey(1,2),logic.draftKey(2,2));assert.notEqual(logic.draftKey(1,2),logic.draftKey(1,3))
 assert.equal(JSON.stringify(logic.reviewSummary({1:true,2:false,3:true})),JSON.stringify({total:3,correct:2,wrong:1,accuracy:67}))
})

function harness({view='Player',tracking=true,reviewFailure=false}={}){
 const states=[],effects=[],queued=[],listeners=new Map(),calls=[];let cursor=0,tree,sequence=0
 const hooks={
  useState(initial){const slot=cursor++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return[states[slot],value=>states[slot]=typeof value==='function'?value(states[slot]):value]},
  useRef(value){const[ref]=hooks.useState(()=>({current:value}));return ref},
  useMemo:fn=>fn(),useCallback:fn=>fn,
  useEffect(fn,deps){const slot=cursor++;if(!effects[slot]||deps?.some((v,i)=>v!==effects[slot].deps?.[i])){effects[slot]?.cleanup?.();effects[slot]={deps};queued.push(()=>{effects[slot].cleanup=fn()})}},
 }
 const deck={id:1,title:'N5',description:'Test',topic:'',jlpt_level:'N5',cards:[card(1,true),card(2)],stats:{mastered_percent:0,new:2,total:2}}
 const api={detail:async()=>deck,review:async payload=>{calls.push(JSON.parse(JSON.stringify(payload)));if(reviewFailure){reviewFailure=false;throw Error('offline')}return{}},star:async()=>{}}
 const words=JSON.parse(source('../src/i18n/locales/en/common.json')).flashcardsManager
 const exports={}
 vm.runInNewContext(compile(source('../src/features/flashcards/Flashcards.tsx'))+'\nexports.testComponents={Player,Detail};',{
  exports,crypto:{randomUUID:()=>`request-${++sequence}`},setTimeout:()=>1,clearTimeout:()=>{},document:{hidden:false},HTMLElement:class {},
  window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:()=>{},setInterval:()=>1,clearInterval:()=>{}},
  require:name=>({'react/jsx-runtime':jsx,react:hooks,'react-query':{useQuery:()=>({data:deck}),useQueryClient:()=>({invalidateQueries:async()=>{}})},'react-router-dom':{Link:props=>jsx.jsx('a',{...props,href:props.to})},'react-i18next':{useTranslation:()=>({i18n:{language:'en'},t:(key,values)=>{let text=words[key.split('.').at(-1)]??key;for(const[k,v]of Object.entries(values||{}))text=text.replaceAll(`{{${k}}}`,String(v));return text}})},'../../services/auth':{},'../../services/flashcards':{flashcardsAPI:api},'../../components/kanji/KanjiText':{KanjiText:({text})=>text},'../dialogs/queue':{},'./logic':logic,'./flashcards.css':{},'./FlashcardShell':{default:({children})=>jsx.jsx('div',{children})},'lucide-react':{Search:()=>null,Volume2:()=>null}})[name],
 })
 const render=()=>{cursor=0;tree=exports.testComponents[view]({account:1,id:1});return renderToStaticMarkup(tree)}
 const nodes=()=>{const result=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}result.push(n);walk(n.props?.children)};walk(tree);return result}
 const click=text=>{const node=nodes().find(n=>n.type==='button'&&n.props.children===text);assert.ok(node,`button ${text}`);node.props.onClick()}
 const flush=async()=>{while(queued.length)await queued.shift()();await new Promise(r=>setImmediate(r))}
 render()
 if(!tracking){const checkbox=nodes().find(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true);checkbox.props.onChange({target:{checked:false}});render()}
 return{render,click,flush,calls,nodes,listeners}
}
test('flip session collects results, retries identical payload once and keeps summary',async()=>{
 const h=harness({reviewFailure:true});await h.flush();h.click('Start');h.render();await h.flush()
 h.click('Still learning (1)');h.render();await h.flush();h.click('Remembered (2)')
 assert.match(h.render(),/Rated 2 cards: 1 remembered, 1 still learning/);await h.flush()
 assert.equal(h.calls.length,1);h.render();h.click('Retry');await h.flush();h.render()
 assert.equal(h.calls.length,2);assert.deepEqual(h.calls[0],h.calls[1]);assert.match(h.render(),/Progress saved/)
 h.click('Review cards still learning');assert.match(h.render(),/Card 1\/1/)
})
test('tracking disabled sends no review, even when session completes',async()=>{
 const h=harness({tracking:false});await h.flush();h.click('Start');h.render();await h.flush()
 h.click('Remembered (2)');h.render();await h.flush();h.click('Still learning (1)');h.render();await h.flush()
 assert.equal(h.calls.length,0);assert.match(h.render(),/does not update progress/)
})
test('navigation does not count a result and skipped cards are revisited',async()=>{
 const h=harness();await h.flush();h.click('Start');h.render();await h.flush();h.click('Next');h.render();await h.flush();h.click('Remembered (2)')
 assert.match(h.render(),/Card 1\/2/);assert.equal(h.calls.length,0)
})
test('detail renders card states, stars, source text and no-voice information',()=>{
 const h=harness({view:'Detail'}),html=h.render()
 assert.match(html,/Japanese voice/);assert.match(html,/aria-pressed="true"/);assert.match(html,/meaning1/);assert.match(html,/Study flashcards/)
 assert.doesNotMatch(html,/flashcardsManager\./)
})
test('all literal UI translation keys exist in both shared locales',()=>{
 const text=source('../src/features/flashcards/Flashcards.tsx'),vi=JSON.parse(source('../src/i18n/locales/vi/common.json')).flashcardsManager,en=JSON.parse(source('../src/i18n/locales/en/common.json')).flashcardsManager
 assert.deepEqual(Object.keys(vi).sort(),Object.keys(en).sort())
 for(const[,key]of text.matchAll(/\bf\('([^']+)'/g)){assert.ok(vi[key],key);assert.ok(en[key],key)}
})
test('study projection has its own query cache key, preserving full deck detail when returning',()=>{
 const text=source('../src/features/flashcards/Flashcards.tsx')
 assert.match(text,/\['flashcards',account,'playSource',id\]/)
 assert.match(text,/\['flashcards',account,'detail',id\]/)
})
