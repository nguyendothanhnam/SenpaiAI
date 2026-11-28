import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {createInstance} from 'i18next'
import ts from 'typescript'

function load(path,modules={}) {
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
 const exports={}
 vm.runInNewContext(code,{exports,Intl,require:name=>{if(name==='react/jsx-runtime')return jsxRuntime;if(name==='react')return React;assert.ok(name in modules,name);return modules[name]}})
 return exports
}
const helpers=load('../src/utils/profileCalendar.ts')
const {activityCalendarCells,appCalendarDate}=helpers

test('30-day calendar is Monday-first, aligns actual weekdays and pads whole weeks',()=>{
 for(const end of ['2026-11-17','2026-11-22','2026-11-23','2026-01-01']) {
  const cells=activityCalendarCells(end)
  assert.equal(cells.length%7,0)
  const dates=Array.from(cells).filter(Boolean)
  assert.equal(dates.length,30)
  assert.equal(new Set(dates).size,30)
  assert.equal(dates.at(-1),end)
  cells.forEach((value,index)=>{if(value)assert.equal((new Date(`${value}T12:00:00Z`).getUTCDay()+6)%7,index%7)})
 }
 assert.equal(activityCalendarCells('2026-11-23').length,42)
 assert.equal(activityCalendarCells('2026-11-17')[0],'2026-10-19')
})
test('calendar handles leap days, year boundaries and invalid dates without fabricated cells',()=>{
 assert.ok(activityCalendarCells('2024-03-01').includes('2024-02-29'))
 assert.ok(!activityCalendarCells('2025-03-01').includes('2025-02-29'))
 assert.ok(activityCalendarCells('2026-01-01').includes('2025-12-31'))
 for(const value of [undefined,'','bad','2026-02-30'])assert.equal(activityCalendarCells(value).length,0)
})
test('application calendar date respects UTC+7 midnight rather than last completed activity',()=>{
 assert.equal(appCalendarDate(new Date('2026-11-21T16:59:59Z')),'2026-11-21')
 assert.equal(appCalendarDate(new Date('2026-11-21T17:00:00Z')),'2026-11-22')
 assert.equal(appCalendarDate(new Date('bad')),undefined)
})
function renderCalendar(language,history=[]) {
 const instance=createInstance()
 instance.init({lng:language,defaultNS:'profile',initImmediate:false,interpolation:{escapeValue:false},resources:{[language]:{profile:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/profile.json`,import.meta.url),'utf8'))}}})
 const Component=load('../src/components/profile/ActivityCalendar.tsx',{
  '../../utils/profileCalendar':helpers,
  'react-i18next':{useTranslation:()=>({t:(key,params)=>{assert.ok(instance.exists(key),key);return instance.t(key,params)},i18n:{resolvedLanguage:language}})},
  'lucide-react':{Flame:props=>React.createElement('svg',props)},
 }).default
 return renderToStaticMarkup(React.createElement(Component,{endDate:'2026-11-17',history}))
}
test('rendered table has seven weekday headings, 30 real dates and localized reward information',()=>{
 for(const language of ['vi','en']) {
  const html=renderCalendar(language,[{date:'2026-11-16',points_awarded:0},{date:'2026-11-17',points_awarded:48}])
  assert.equal((html.match(/scope="col"/g)||[]).length,7)
  assert.equal((html.match(/<time /g)||[]).length,30)
  assert.match(html,/datetime="2026-11-17" aria-current="date"/i)
  assert.match(html,language==='vi'?/48 điểm thưởng/:/48 reward points/)
  assert.match(html,language==='vi'?/0 điểm thưởng/:/0 reward points/)
  assert.match(html,language==='vi'?/>T2</:/>Mon</)
  assert.doesNotMatch(html,/NaN|undefined|điểm bài tập|exercise points/)
 }
})
test('empty history retains a correctly aligned calendar with an honest empty-state message',()=>{
 const html=renderCalendar('en')
 assert.match(html,/No daily tasks were completed/)
 assert.equal((html.match(/<time /g)||[]).length,30)
 assert.equal((html.match(/<svg/g)||[]).length,0)
})
