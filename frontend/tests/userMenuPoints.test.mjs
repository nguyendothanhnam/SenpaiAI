import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

function render(language, level='N3', points=4026, layout=false) {
  const locale=JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/nav.json`,import.meta.url),'utf8'))
  const source=readFileSync(new URL('../src/components/layout/UserMenu.tsx',import.meta.url),'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
  const exports={}
  vm.runInNewContext(compiled,{exports,require:name=>{
    if(name==='react')return React
    if(name==='react/jsx-runtime')return jsxRuntime
    if(name==='lucide-react')return new Proxy({},{get:()=>()=>null})
    if(name==='react-i18next')return {useTranslation:()=>({t:key=>locale[key]})}
    if(name==='react-router-dom')return {useLocation:()=>({pathname:'/chat'}),Link:()=>null}
    if(name==='../../utils/helpers')return {cn:(...values)=>values.filter(Boolean).join(' ')}
    throw Error(name)
  }})
  if (!layout) return renderToStaticMarkup(React.createElement(exports.default,{username:'Hine',level,points,onLogout(){}}))
  const layoutCode=ts.transpileModule(readFileSync(new URL('../src/components/Layout.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
  const layoutExports={}
  vm.runInNewContext(layoutCode,{exports:layoutExports,require:name=>{
    if(name==='react')return React
    if(name==='react/jsx-runtime')return jsxRuntime
    if(name==='lucide-react')return new Proxy({},{get:()=>()=>null})
    if(name==='react-i18next')return {useTranslation:()=>({t:key=>locale[key] || key})}
    if(name==='react-router-dom')return {Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)}
    if(name==='react-query')return {useQuery:()=>({data:{has_estimated_level:true}})}
    if(name==='../services/auth')return {useAuth:()=>({user:{id:1,username:'Hine',current_jlpt_level:level,exercise_points:600},logout(){}})}
    if(name==='../services/rewards')return {useRewardsMe:()=>({data:{points_balance:points,current_streak:0}})}
    if(name==='../services/placement')return {placementAPI:{}}
    if(name==='../themes/ThemeProvider')return {useTheme:()=>({mode:'light',resolvedMode:'light',themeId:'classic',backgroundId:null,setMode(){}})}
    if(name==='../themes/themes')return {themes:{classic:{palettes:{light:{}}}},themeBackgrounds:[]}
    if(name==='../img/cat-logo.webp')return {default:'cat.webp',__esModule:true}
    if(name==='./layout/UserMenu')return exports
    if(['./LanguageSwitcher','./notifications/NotificationBell','./layout/SidebarNav'].includes(name))return {default:()=>null,__esModule:true}
    throw Error(name)
  }})
  return renderToStaticMarkup(React.createElement(layoutExports.default,null,'page'))
}
for(const language of ['vi','en'])test(`account card shows name, JLPT and reward balance (${language})`,()=>{
  const html=render(language)
  assert.match(html,/Hine/)
  assert.match(html,/N3/)
  assert.match(html,/4026/)
  assert.match(html,language==='vi'?/Điểm thưởng/:/Reward points/)
  assert.doesNotMatch(html,/600|exercise points|điểm bài tập/)
  assert.match(html,/aria-haspopup="menu"/)
})
test('unassessed account label remains visible without the old counter',()=>{
  assert.match(render('vi','Chưa đánh giá'),/Chưa đánh giá/)
})

test('zero rewards remain visible and missing balance is not replaced by exercise points',()=>{
  assert.match(render('vi','N3',0),/0.*Điểm thưởng/)
  assert.doesNotMatch(render('vi','N3',null),/4026|600/)
})

test('desktop and mobile drawer receive the wallet balance rather than legacy exercise points',()=>{
  const html=render('vi','N3',4026,true)
  assert.equal((html.match(/4026/g)||[]).length,3)
  assert.doesNotMatch(html,/600|điểm bài tập/)
})
