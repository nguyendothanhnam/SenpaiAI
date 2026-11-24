import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {createInstance} from 'i18next'
import ts from 'typescript'

const skillNames=['vocab','grammar','kanji','listening','conversation','interview']
function model() {
 const skills=Object.fromEntries(skillNames.map(key=>[key,{score:null,samples:0,sample_days:0,evidence:'insufficient',accuracy:null,proxy_only:false}]))
 const coverage={partial:false,contains_undated_aggregates:false,window_start:'2025-11-18T00:00:00Z'}
 const roadmap={levels:['N5','N4','N3','N2','N1'].map(level=>({level,completion_percent:0,current_milestone:'kanji',next_milestone:'grammar',ready_for_level_review:false,
   milestones:[...skillNames,'assessment'].map(id=>({id,current:id==='kanji'||id==='grammar'||id==='assessment'?0:null,target:10,percent:null,available:false,complete:false}))}))}
 return {overview:{has_activity:false,current_level:'N5',skills,coverage,roadmap,legacy_wrong_items:[],weekly_goal:{week_start:'2026-11-16',study_days:4,lessons:10,completed_days:0,completed_lessons:0,days_percent:0,lessons_percent:0},trend:Array.from({length:8},(_,i)=>({start:`2026-10-${String(i+1).padStart(2,'0')}`,lessons:0,accuracy:null})),actions:[{id:'daily',href:'/daily',reason:'daily_pending',params:{}},{id:'assessment',href:'/placement',reason:'collect_evidence',params:{}},{id:'vocab',href:'/library',reason:'build_skill',skill:'vocab',params:{}}]},
 report:{period:'week',start:'2026-11-16',is_partial_period:true,coverage,study_days:0,lessons:0,recorded_minutes:0,accuracy:null,skills,
 comparison:{accuracy_delta:null,same_elapsed_days:true,skill_deltas:Object.fromEntries(skillNames.map(key=>[key,null]))},strengths:[],weaknesses:[],frequent_wrong_items:[],common_errors:[],narrative:{key:'learning.summaries.insufficient',params:{}},recommendations:[{key:'learning.reportAdvice.continue',params:{}}]}}
}
function load(path, modules) {
 const source=readFileSync(new URL(path,import.meta.url),'utf8')
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:path}).outputText
 const exports={}
 vm.runInNewContext(compiled,{exports,require:name=>{if(name==='react/jsx-runtime')return jsxRuntime;if(name==='react')return React;assert.ok(name in modules,name);return modules[name]}})
 return exports
}
function render(language='vi',data=model(),failed=false) {
 const i18n=createInstance()
 i18n.init({lng:language,defaultNS:'common',resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}},initImmediate:false,interpolation:{escapeValue:false}})
 const translate=(key,options)=>{assert.ok(i18n.exists(key),`missing key ${key}`);return i18n.t(key,options)}
 const modules={
  'react-i18next':{useTranslation:()=>({t:translate,i18n:{...i18n,resolvedLanguage:language,exists:key=>i18n.exists(key)}})},
  'react-router-dom':{Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)},
  'lucide-react':new Proxy({},{get:()=>()=>null}),
  'react-query':{useQuery:(key)=>({data:failed?undefined:key[2]==='overview'?data.overview:key[2]==='reports'?{items:[data.report],has_more:false}:undefined,isLoading:false,isError:failed,refetch(){}}),useQueryClient:()=>({invalidateQueries(){}}),useMutation:()=>({mutate(){},reset(){}})},
  '../services/auth':{useAuth:()=>({user:{id:7,current_jlpt_level:'N5'}})},
  '../services/learning':{learningAPI:{}},
  '../components/LoadingSpinner':{default:()=>null,__esModule:true},
 }
 modules['../components/learning/LearningCharts']=load('../src/components/learning/LearningCharts.tsx',modules)
 const Component=load('../src/pages/Analytics.jsx',modules).default
 return renderToStaticMarkup(React.createElement(Component))
}

test('empty progress renders the actual page with honest evidence and six skills in Vietnamese',()=>{
 const html=render()
 assert.match(html,/Lộ trình và tiến độ/)
 assert.match(html,/Chưa đủ dữ liệu/)
 assert.match(html,/Bắt đầu hành trình học/)
 assert.equal((html.match(/role="progressbar"/g)||[]).length,2)
 assert.match(html,/href="\/placement"/)
 assert.doesNotMatch(html,/NaN|undefined|Infinity/)
})
test('English report translates narrative and distinguishes proxy scores without fabricated accuracy',()=>{
 const data=model();data.overview.has_activity=true
 data.report.skills.conversation={...data.report.skills.conversation,score:75,proxy_only:true}
 data.report.common_errors=[{code:'conversation.politeness',count:2}]
 const html=render('en',data)
 assert.match(html,/Learning roadmap and progress/)
 assert.match(html,/75 \/ 100 \(proxy\)/)
 assert.match(html,/Politeness/)
 assert.match(html,/Not enough|not enough|Insufficient/)
 assert.doesNotMatch(html,/NaN|undefined/)
})
test('load failure exposes retry and never shows another account’s data',()=>{
 const html=render('en',model(),true)
 assert.match(html,/role="alert"/)
 assert.match(html,/Retry/)
 assert.doesNotMatch(html,/days of evidence/)
})
test('rings clamp invalid/over-target values and trends retain gaps for missing accuracy',()=>{
 const translation={'react-i18next':{useTranslation:()=>({t:key=>key,i18n:{resolvedLanguage:'en'}})}}
 const {GoalRing,LearningTrend}=load('../src/components/learning/LearningCharts.tsx',translation)
 assert.match(renderToStaticMarkup(React.createElement(GoalRing,{value:125,label:'goal',detail:'detail'})),/aria-valuenow="100"/)
 const html=renderToStaticMarkup(React.createElement(LearningTrend,{points:[{start:'2026-11-01',lessons:1,accuracy:80},{start:'2026-11-08',lessons:0,accuracy:null},{start:'2026-11-15',lessons:2,accuracy:90}]}))
 assert.match(html,/<svg/)
 assert.match(html,/d="M30,58  M570,44"/)
 assert.doesNotMatch(html,/NaN|Infinity/)
})
test('reusable API keeps all endpoints owned and goal saving separate from JLPT changes',async()=>{
 const calls=[]
 const api={get:async(path,options)=>{calls.push(['get',path,options]);return {data:{}}},put:async(path,data)=>{calls.push(['put',path,data]);return {data:{}}}}
 const {learningAPI}=load('../src/services/learning.ts',{'./api':{api}})
 await learningAPI.overview();await learningAPI.roadmap();await learningAPI.mastery('grammar',10);await learningAPI.reports('month',2);await learningAPI.saveGoals({study_days:4,lessons:10})
 assert.equal(calls.length,5)
 assert.equal(calls[2][2].params.offset,10)
 assert.equal(calls[3][2].params.period,'month')
 assert.equal(calls[4][1],'/learning/goals')
 assert.ok(calls.every(([,path])=>!path.includes('user_id')&&!path.includes('/auth/')))
})
