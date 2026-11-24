import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {createInstance} from 'i18next'
import ts from 'typescript'

function load(path,modules){
 const exports={};const source=readFileSync(new URL(path,import.meta.url),'utf8')
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true},fileName:path}).outputText
 vm.runInNewContext(output,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]},setTimeout(){}})
 return exports
}
function translations(language){
 const i18n=createInstance();i18n.init({lng:language,defaultNS:'common',resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}},initImmediate:false,interpolation:{escapeValue:false}})
 return{t:(key,options)=>{assert.ok(i18n.exists(key),key);return i18n.t(key,options)},i18n}
}
test('actual answer bubble uses translated source labels, hides internal/unsafe sources and offers feedback',()=>{
 for(const language of ['vi','en']){
 const translation=translations(language);const enabled=[]
 const modules={'react':React,'react/jsx-runtime':jsxRuntime,'react-router-dom':{Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)},'lucide-react':new Proxy({},{get:()=>()=>null}),'react-hot-toast':{default:{error(){}},__esModule:true},'react-i18next':{useTranslation:()=>translation},'../../utils/helpers':{formatRelativeTime:()=>''},'../../services/auth':{useAuth:()=>({user:{id:7}})},'../../services/chatFeedback':{chatFeedbackAPI:{}},'react-query':{useQuery:(key,fn,options)=>{enabled.push(options.enabled);return{}},useQueryClient:()=>({setQueryData(){}}),useMutation:()=>({reset(){}})}}
 modules['./ChatAnswer']=load('../src/components/chat/ChatAnswer.tsx',modules)
 modules['./ChatAnswerFeedback']=load('../src/components/chat/ChatAnswerFeedback.tsx',modules)
 const Bubble=load('../src/components/chat/ChatMessageBubble.tsx',modules).default
 const html=renderToStaticMarkup(React.createElement(Bubble,{message:{id:4,question:'Question',answer:'**Explanation:** valid answer',created_at:'2026-11-22T00:00:00Z',sources:[{title:'Public grammar note',type:'grammar_rule',url:'/grammar'},{title:'Hidden rules',type:'internal_rules',url:'/library'},{title:'Unsafe URL',type:'grammar',url:'javascript:alert(1)'}]},onDelete(){}}))
 assert.match(html,/Public grammar note/);assert.doesNotMatch(html,/Hidden rules|Unsafe URL|javascript:|grammar_rule/)
 assert.match(html,language==='vi'?/Hữu ích/:/Helpful/);assert.match(html,language==='vi'?/Có lỗi/:/Has an error/)
 assert.equal(enabled.length,1);assert.equal(enabled[0],false)
 }
})
function formHarness(fail=false){
 let cursor=0;const slots=[],calls=[],keys=[],promises=[];let saved=null,error=false,success=false
 const translation=translations('vi')
 const api={get:async()=>saved,save:async(id,body)=>{calls.push({id,body});if(fail)throw Error('network');return{...body,updated_at:'2026-11-22T00:00:00Z'}}}
 const modules={'react/jsx-runtime':jsxRuntime,'react':{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=value}]}},'react-i18next':{useTranslation:()=>translation},'../../services/auth':{useAuth:()=>({user:{id:7}})},'../../services/chatFeedback':{chatFeedbackAPI:api},'react-query':{
 useQuery:(key,fn,options)=>({data:saved,isLoading:false}),useQueryClient:()=>({setQueryData:(key,data)=>{keys.push(key);saved=data}}),
 useMutation:(fn,options)=>({isLoading:false,isError:error,isSuccess:success,reset(){error=false;success=false},mutate(body){promises.push(fn(body).then(data=>{success=true;options.onSuccess(data)}).catch(()=>{error=true}))}}),
 }}
 const Component=load('../src/components/chat/ChatAnswerFeedback.tsx',modules).default;let tree
 const render=()=>{cursor=0;tree=Component({messageId:42});return renderToStaticMarkup(tree)}
 function find(predicate){const out=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}if(predicate(n))out.push(n);walk(n.props?.children)}walk(tree);return out}
 return{render,find,calls,keys,promises}
}
test('feedback form sends the selected answer/rating/note and scopes cached data by user',async()=>{
 const h=formHarness();h.render();h.find(n=>n.type==='button')[1].props.onClick();h.render()
 const field=h.find(n=>n.type==='textarea')[0];assert.equal(field.props.maxLength,1000)
 field.props.onChange({target:{value:'Câu ví dụ sai.'}});h.render()
 h.find(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});await Promise.all(h.promises)
 assert.equal(h.calls[0].id,42);assert.equal(h.calls[0].body.rating,'incorrect');assert.equal(h.calls[0].body.comment,'Câu ví dụ sai.')
 assert.equal(h.keys[0].join(':'),'chatAnswerFeedback:7:42')
 assert.match(h.render(),/Đã lưu góp ý/)
})
test('failed feedback keeps the note and offers retry without claiming success',async()=>{
 const h=formHarness(true);h.render();h.find(n=>n.type==='button')[0].props.onClick();h.render();h.find(n=>n.type==='textarea')[0].props.onChange({target:{value:'Giữ góp ý này'}});h.render()
 h.find(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});await Promise.all(h.promises)
 const html=h.render();assert.match(html,/Giữ góp ý này/);assert.match(html,/Chưa lưu được/);assert.doesNotMatch(html,/Đã lưu góp ý/)
})
test('feedback transport adds owned endpoints without changing chat message API',async()=>{
 const calls=[];const api={get:async url=>{calls.push(url);return{data:null}},put:async(url,body)=>{calls.push({url,body});return{data:body}}}
 const service=load('../src/services/chatFeedback.ts',{'./api':{api}}).chatFeedbackAPI
 await service.get(8);await service.save(8,{rating:'helpful',comment:''})
 assert.equal(calls[0],'/chat/answers/8/feedback');assert.equal(calls[1].url,calls[0]);assert.equal(calls[1].body.rating,'helpful')
})
