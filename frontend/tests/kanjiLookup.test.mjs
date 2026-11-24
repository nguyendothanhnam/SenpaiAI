import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {createInstance} from 'i18next'
import ts from 'typescript'
const source=readFileSync(new URL('../src/components/kanji/KanjiLookupDialog.tsx',import.meta.url),'utf8')
function render(language='vi',missing=false){
 const i18n=createInstance();i18n.init({lng:language,defaultNS:'common',resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}},initImmediate:false,interpolation:{escapeValue:false}})
 const exports={},modules={'react':React,'react/jsx-runtime':jsxRuntime,'react-dom':{createPortal:node=>node},'react-query':{useQuery:()=>({data:{dictionary:missing?null:{jlpt:'N3',stroke_count:14,onyomi:['サイ'],kunyomi:['きわ','-ぎわ']},defaults:{sino_vietnamese:missing?'':'TẾ',meaning_vi:missing?'':'dịp, ranh giới'},note:missing?null:{sino_vietnamese:'TẾ',meaning_vi:'Nghĩa riêng',mnemonic:'<script>alert(1)</script> 際'},reading_source:{title:'SenpaiAI',url:'/kanji'}}}),useMutation:()=>({}),useQueryClient:()=>({})},'react-i18next':{useTranslation:()=>({t:(key,options)=>{assert.ok(i18n.exists(key),key);return i18n.t(key,options)}})},'lucide-react':new Proxy({},{get:()=>()=>null}),'../../hooks/useDialogFocus':{useDialogFocus(){}},'../../services/auth':{useAuth:()=>({user:{id:7}})},'../../services/kanjiNotes':{kanjiNotesAPI:{}}}
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:'KanjiLookupDialog.tsx'}).outputText,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]},document:{body:{}}})
 return renderToStaticMarkup(React.createElement(exports.default,{kanji:'際',onClose(){}}))
}
test('lookup dialog matches requested information and escapes private mnemonics in vi/en',()=>{
 for(const language of ['vi','en']){const html=render(language);assert.match(html,/role="dialog"/);assert.match(html,/aria-modal="true"/);assert.match(html,/N3/);assert.match(html,/TẾ/);assert.match(html,/サイ/);assert.match(html,/きわ/);assert.match(html,/Nghĩa riêng/);assert.doesNotMatch(html,/<script>/);assert.match(html,/maxLength="2000"/);assert.match(html,language==='vi'?/Lưu Hán tự/:/Save Kanji/)}
})
test('unknown dictionary character is explicit and does not invent a level or stroke count',()=>{
 const html=render('vi',true);assert.match(html,/chưa có trong kho/);assert.doesNotMatch(html,/N3|14 nét|TẾ/)
})
test('lookup API uses account-owned note endpoints and keeps old dictionary API intact',async()=>{
 const exports={},calls=[],api={get:async path=>{calls.push(path);return{data:{}}},put:async(path,body)=>{calls.push({path,body});return{data:{}}}}
 const text=readFileSync(new URL('../src/services/kanjiNotes.ts',import.meta.url),'utf8')
 vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({api})})
 await exports.kanjiNotesAPI.get('際');await exports.kanjiNotesAPI.save('際',{sino_vietnamese:'TẾ',meaning_vi:'dịp',mnemonic:'Mẹo'})
 assert.equal(calls[0],'/kanji-notes/%E9%9A%9B');assert.equal(calls[1].path,calls[0]);assert.equal(calls[1].body.mnemonic,'Mẹo')
})
