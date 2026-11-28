import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {createInstance} from 'i18next'
import * as icons from 'lucide-react'
import ts from 'typescript'

function load(path,mocks={}){
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 const exports={}
 vm.runInNewContext(code,{exports,URL,Intl,require:name=>{assert.ok(name in mocks,`Unexpected import: ${name}`);return mocks[name]}})
 return exports
}
const helpers=load('../src/utils/listeningPresentation.ts')
function translations(language){const i18n=createInstance();i18n.init({lng:language,defaultNS:'common',initImmediate:false,resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}}});return{useTranslation:()=>({i18n,t:(key,options)=>{assert.ok(i18n.exists(key,options),key);return i18n.t(key,options)}})}}
function mocks(language,extra={}){return{react:React,'react/jsx-runtime':jsx,'react-i18next':translations(language),'lucide-react':icons,'./listening.css':{},'../../utils/listeningPresentation':helpers,...extra}}

test('thumbnail preview accepts only the backend-supported YouTube URL shapes',()=>{
 const id='M7lc1UVf-VE'
 for(const url of [`https://youtube.com/watch?v=${id}`,`https://www.youtube.com/watch?v=${id}&t=12`,`https://m.youtube.com/watch?v=${id}`,`https://youtu.be/${id}`,`https://www.youtube.com/embed/${id}`,`https://www.youtube-nocookie.com/embed/${id}`,`https://youtube.com:443/watch?v=${id}`])assert.equal(helpers.youtubePreviewId(url),id,url)
 for(const url of ['',` http://youtu.be/${id}`,`https://youtu.be/${id} `,`http://youtu.be/${id}`,`https://youtube.com.evil.test/watch?v=${id}`,`https://user@youtube.com/watch?v=${id}`,`https://youtube.com:444/watch?v=${id}`,`https://youtube.com/watch?v=${id}&v=${id}`,`https://youtube.com/shorts/${id}`,'javascript:alert(1)',`https://youtu.be/${id}/extra`,'https://youtube.com/watch?v=bad'])assert.equal(helpers.youtubePreviewId(url),null,url)
})
test('timestamps are padded and non-finite/negative times remain readable',()=>{
 for(const[input,expected]of [[0,'00:00'],[12.9,'00:12'],[62,'01:02'],[3600,'60:00'],[-1,'00:00'],[Infinity,'00:00'],[NaN,'00:00']])assert.equal(helpers.listeningTimestamp(input),expected)
})
test('document word estimates and source badges do not invent backend metadata',()=>{
 assert.equal(helpers.documentWordCount(''),0)
 assert.equal(helpers.documentWordCount('hello world'),2)
 assert.ok(helpers.documentWordCount('今日は公園へ行きます。')>1)
 assert.equal(helpers.listeningSourceKey('video'),'listening.ui.sources.video')
 assert.equal(helpers.listeningSourceKey('library'),'listening.ui.sources.library')
 assert.equal(helpers.listeningSourceKey('seed'),'listening.ui.sources.conversation')
})
test('creator has a keyboard-accessible dropzone, hidden native input and translated source preview',()=>{
 for(const language of ['vi','en']){
  const module=load('../src/components/listening/VideoLessonCreator.tsx',mocks(language,{'react-query':{useMutation:()=>({isLoading:false,mutate(){}}),useQueryClient:()=>({invalidateQueries(){}})},'../../services/api':{api:{}}}))
  const html=renderToStaticMarkup(React.createElement(module.default,{embedded:true}))
  assert.match(html,/type="file" hidden="" accept=".srt,.vtt"/)
  assert.match(html,/<button[^>]*class="listening-dropzone/)
  assert.match(html,/class="listening-action[^>]*disabled=""/)
  assert.match(html,language==='vi'?/Kéo thả tệp/:/Drop a file/)
  assert.match(html,language==='vi'?/Phân tích và xem trước/:/Parse and preview/)
  assert.doesNotMatch(html,/listening\.ui\./)
 }
})
test('lesson cards show source, Japanese preview, sentence count and the original player route',()=>{
 for(const language of ['vi','en'])for(const source of ['video','library','seed']){
  const lesson={id:7,title:'Lesson',jlpt_level:'N3',topic:'hoc_tap',description:'Description',duration_ms:65000,source}
  const module=load('../src/components/listening/ListeningLessonCard.tsx',mocks(language,{'react-query':{useQuery:()=>({data:{segments:[{ja:'日本語を勉強します。'}]}})},'react-router-dom':{Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)},'../../services/api':{},'../../utils/listeningLocale':{localizeListeningLesson:value=>value}}))
  const html=renderToStaticMarkup(React.createElement(module.default,{lesson,userId:1}))
  assert.match(html,/href="\/listening\/7"/)
  assert.match(html,/01:05/)
  assert.match(html,/日本語を勉強します。/)
  assert.match(html,language==='vi'?/1 câu/:/1 sentence/)
  assert.match(html,language==='vi'?/Bắt đầu nghe/:/Start listening/)
  assert.doesNotMatch(html,/listening\.ui\./)
 }
})
test('shared transcript row retains active-line semantics, timestamp and accessible replay controls',()=>{
 for(const language of ['vi','en']){
  const module=load('../src/components/listening/ListeningUI.tsx',mocks(language))
  const html=renderToStaticMarkup(React.createElement(module.ListeningTranscriptRow,{number:2,startMs:12000,active:true,onReplay(){}},React.createElement('p',null,'こんにちは。')))
  assert.match(html,/aria-current="true"/)
  assert.match(html,/00:12/)
  assert.match(html,language==='vi'?/Nghe lại câu 2/:/Replay sentence 2/)
  assert.match(html,language==='vi'?/Nghe câu này/:/Replay this sentence/)
  const toggle=renderToStaticMarkup(React.createElement(module.ListeningToggle,{checked:false,onChange(){}},'Furigana'))
  assert.match(toggle,/aria-pressed="false"/)
 }
})
