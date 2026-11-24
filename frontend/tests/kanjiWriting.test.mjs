import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import ts from 'typescript'

const source=readFileSync(new URL('../src/components/kanji/KanjiWriting.tsx',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:'KanjiWriting.tsx'}).outputText
function harness(language='vi', queryState={}) {
 const i18n=createInstance(); i18n.init({lng:language,defaultNS:'common',resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}},initImmediate:false,interpolation:{escapeValue:false}})
 let cursor=0;const slots=[],calls=[],invalidations=[],reports=[]
 let reportFails=false
 const template={kanji:'月',level:'N5',confusions:[],stroke_count:2,strokes:[[{x:0,y:0},{x:0,y:1}],[{x:0,y:0},{x:1,y:1}]],rules:[{key:'writing.rules.top_bottom'},{key:'writing.rules.exceptions'}],source:'KanjiVG',source_url:'https://kanjivg.tagaini.net/',license:'CC BY-SA 3.0'}
 const result={kanji:'月',provisional:true,saved:false,passed:true,overall_score:100,scores:{order:100,direction:100,shape:100,completeness:100},summary_key:'writing.summary_pass',strokes:[{index:1,status:'correct',expected_index:1,matched_index:1,message_key:'writing.status.correct'}],confusion:null}
 let resolvePreview
 let delay=false
 const modules={
 'react':{useMemo:fn=>fn(),useId:()=> 'writingtest',useEffect(){},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value})}},
 'react/jsx-runtime':jsxRuntime,
 'react-query':{useQuery:key=>key[0]==='kanjiWritingDictionary'?{data:[]}:key[0]==='kanjiWritingProgress'?{data:{items:[]}}:key[0]==='kanjiWritingSupported'?{data:{items:[{kanji:'月',level:'N5'}]},...queryState}:{data:template,...queryState},useQueryClient:()=>({invalidateQueries:key=>invalidations.push(key)})},
 'react-i18next':{useTranslation:()=>({t:(key,params)=>{assert.ok(i18n.exists(key),`missing ${key}`);return i18n.t(key,params)}})},
 '../../services/auth':{useAuth:()=>({user:{id:7}})},
 '../../services/kanjiWriting':{kanjiWritingAPI:{report:async body=>{reports.push(body);if(reportFails)throw Error('offline');return{saved:true}},evaluate:async body=>{calls.push(body);if(delay&&!body.final)return new Promise(resolve=>{resolvePreview=resolve});return{...result,provisional:!body.final,saved:body.final}},supported(){},template(){}}},
 './kanjiWriting.css':{},
 }
 const helperExports={}
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/kanjiWriting/practice.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:helperExports})
 modules['../../features/kanjiWriting/practice']=helperExports
 for(const name of ['WritingCharacterPicker','WritingCharacterInfo','WritingReference','WritingFeedback']){
   const child={}
   vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/kanji/'+name+'.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:child,require:key=>key==='react'?React:modules[key]})
   modules['./'+name]=child
 }
 const exports={};vm.runInNewContext(compiled,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]},crypto:{randomUUID},Date})
 const Component=exports.default
 let tree
 const render=()=>{cursor=0;tree=Component({initialKanji:'月'});return renderToStaticMarkup(tree)}
 const nodes=(predicate)=>{const found=[];function walk(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return}if(predicate(node))found.push(node);walk(node.props?.children)}walk(tree);return found}
 const label=key=>i18n.t(key)
 const button=key=>nodes(n=>n.type==='button'&&n.props.children===label(key))[0]
 const board=()=>nodes(n=>n.type==='svg')[0]
 const target={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}}
 const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,currentTarget:target,preventDefault(){}})
 const draw=()=>{board().props.onPointerDown(event(20,20));render();board().props.onPointerMove(event(20,70));render();board().props.onPointerUp(event(20,80));render()}
 return {render,nodes,button,board,draw,calls,reports,invalidations,label,result,failReport(value){reportFails=value},delayPreview(){delay=true},resolvePreview(value){resolvePreview(value)}}
}

test('actual writing UI translates vi/en, shows rules and hides hints in test mode',()=>{
 for(const language of ['vi','en']){
 const h=harness(language);const html=h.render()
 assert.match(html,/KanjiVG/);assert.match(html,/CC BY-SA 3.0/);assert.match(html,/touch|chuột/)
 assert.ok(h.button('writing.hint'));assert.equal(h.button('writing.finish').props.disabled,true)
 h.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}})
 h.render();assert.equal(h.button('writing.hint'),undefined)
 assert.doesNotMatch(h.render(),/undefined|NaN/)
 }
})
test('pointer strokes preview without persistence and final submit uses a retry-safe attempt id',async()=>{
 const h=harness();h.render();h.draw();await new Promise(r=>setImmediate(r));h.render()
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].final,false);assert.equal(h.calls[0].strokes[0].length,3)
 assert.equal(h.calls[0].attempt_id,undefined)
 h.button('writing.finish').props.onClick();await new Promise(r=>setImmediate(r));h.render()
 assert.equal(h.calls[1].final,true);assert.match(h.calls[1].attempt_id,/^[0-9a-f-]{36}$/)
 assert.equal(h.button('writing.finish').props.disabled,true)
 assert.equal(h.invalidations.length,2)
 assert.match(h.render(),/Mẫu chữ 月 để đối chiếu/)
 assert.equal((h.render().match(/<svg /g)||[]).length,2)
})
test('test mode does not preview; reset discards a late preview response',async()=>{
 const h=harness();h.render();h.nodes(n=>n.type==='input')[0].props.onChange({target:{checked:true}});h.render();h.draw()
 assert.equal(h.calls.length,0)
 const other=harness();other.delayPreview();other.render();other.draw();other.button('writing.clear').props.onClick();other.render()
 other.resolvePreview({...other.result,overall_score:37});await new Promise(r=>setImmediate(r))
 assert.doesNotMatch(other.render(),/37\/100/)
 assert.equal(other.button('writing.finish').props.disabled,true)
})
test('unavailable templates fail closed and hints animate only without reduced motion',()=>{
 const h=harness('vi',{isError:true,data:undefined});const html=h.render()
 assert.match(html,/role="alert"/);assert.equal(h.board(),undefined)
 const css=readFileSync(new URL('../src/components/kanji/kanjiWriting.css',import.meta.url),'utf8')
 assert.match(css,/@media \(prefers-reduced-motion: no-preference\)/)
 assert.match(css,/touch-action: none/)
})
test('writing transport is additive and keeps the target separate from recognition',async()=>{
 const calls=[];const exports={}
 const text=readFileSync(new URL('../src/services/kanjiWriting.ts',import.meta.url),'utf8')
 const api={get:async path=>{calls.push(path);return{data:{}}},post:async(path,body)=>{calls.push([path,body]);return{data:{}}}}
 vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({api})})
 await exports.kanjiWritingAPI.template('月');await exports.kanjiWritingAPI.evaluate({kanji:'月',strokes:[],final:false,mode:'practice'})
 assert.equal(calls[0],'/kanji-writing/template/%E6%9C%88')
 assert.equal(calls[1][0],'/kanji-writing/evaluate');assert.equal(calls[1][1].kanji,'月')
})

test('strictness is selected explicitly, test mode defaults to strict and has no preview hints',async()=>{
 const h=harness();h.render()
 const select=h.nodes(n=>n.type==='select'&&n.props.value==='standard')[0]
 select.props.onChange({target:{value:'easy'}});h.render();h.draw()
 await new Promise(r=>setImmediate(r));h.render();assert.equal(h.calls[0].strictness,'easy')
 h.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}})
 h.render();assert.equal(h.button('writing.hint'),undefined)
 h.draw();h.button('writing.finish').props.onClick();await new Promise(r=>setImmediate(r));h.render()
 assert.equal(h.calls.at(-1).strictness,'strict');assert.equal(h.calls.at(-1).mode,'test')
})

test('incorrect grading report requires consent, retains notes after failure and retries the same report id',async()=>{
 for(const language of ['vi','en']){
 const h=harness(language);h.render();assert.equal(h.button('writing.reportWrong'),undefined)
 h.draw();await new Promise(r=>setImmediate(r));h.render();h.button('writing.finish').props.onClick()
 await new Promise(r=>setImmediate(r));h.render();h.button('writing.reportWrong').props.onClick();h.render()
 assert.equal(h.reports.length,0);assert.equal(h.button('writing.reportSend').props.disabled,true)
 h.nodes(n=>n.type==='textarea')[0].props.onChange({target:{value:'This stroke is correct'}})
 h.render();h.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[1].props.onChange({target:{checked:true}})
 h.render();h.failReport(true);h.button('writing.reportSend').props.onClick()
 await new Promise(r=>setImmediate(r));const failed=h.render();assert.ok(failed.includes(h.label('writing.reportError')))
 assert.match(failed,/This stroke is correct/)
 h.failReport(false);h.button('writing.reportSend').props.onClick();await new Promise(r=>setImmediate(r));h.render()
 assert.equal(h.reports.length,2);assert.equal(h.reports[0].report_id,h.reports[1].report_id)
 assert.equal(h.reports[1].attempt_id,h.calls.at(-1).attempt_id)
 assert.equal(h.reports[1].confirmed,true);assert.equal(h.reports[1].comment,'This stroke is correct')
 assert.equal(h.reports[1].strokes.length,1);assert.equal(h.button('writing.reportWrong'),undefined)
 }
})

test('writing workspace offers a bounded character picker and keeps test models hidden until submission',()=>{
 const h=harness();const html=h.render()
 assert.match(html,/writing-character-grid/);assert.match(html,/role="tablist"/);assert.match(html,/writing-reference-board/)
 assert.doesNotMatch(html,/<option[^>]*value="月"/)
 h.nodes(n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}})
 const testView=h.render()
 assert.doesNotMatch(testView,/writing-reference-board|writing-hint/)
 assert.match(testView,/Sau khi nộp/)
})

test('wrong stroke feedback opens its details and automatically overlays the correct direction',async()=>{
 const h=harness();h.result.strokes=[{index:1,status:'wrong_direction',expected_index:1,matched_index:1,message_key:'writing.status.wrong_direction'}]
 h.render();h.draw();await new Promise(r=>setImmediate(r));const html=h.render()
 assert.match(html,/<details open=""/);assert.match(html,/Ngược hướng/)
 assert.match(html,/writing-arrow-writingtest/);assert.match(html,/stroke-dasharray="2 1"/)
 assert.match(html,/Đã căn theo khung bao cả chữ/)
})
