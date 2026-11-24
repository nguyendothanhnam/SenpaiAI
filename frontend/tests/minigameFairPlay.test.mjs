import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'
function load(path,modules,extra={}){
 const exports={}
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]},...extra})
 return exports.default
}
test('shiritori shows words without exposing their readings on prompt or answers',()=>{
 const Component=load('../src/components/minigames/ShiritoriGame.tsx',{'react/jsx-runtime':jsxRuntime,'react-i18next':{useTranslation:()=>({t:key=>key})},'../../../../shared-games':{lastKana:()=> 'る'}})
 const html=renderToStaticMarkup(React.createElement(Component,{round:{shiritori:{current:{word:'捕まえる',reading:'つかまえる'},choices:[{id:'a',word:'留守',reading:'るす'}]},session:{chain:0}},onAction(){}}))
 assert.match(html,/捕まえる/);assert.match(html,/留守/);assert.doesNotMatch(html,/つかまえる|るす|<ruby|<small/)
})
test('lookup scope adds no toolbar and ignores active game or interactive answer clicks',()=>{
 let opened=0
 class Element {closest(selector){assert.match(selector,/data-kanji-lookup-blocked/);return {}}}
 const Scope=load('../src/components/kanji/KanjiLookupScope.tsx',{'react/jsx-runtime':jsxRuntime,'react':{useState:()=>['',()=>opened++],useCallback:fn=>fn},'react-router-dom':{useLocation:()=>({pathname:'/games/shiritori'})},'./KanjiLookupDialog':{default:()=>null}},{Element})
 const lookup=Scope({children:'child'}),tree=lookup.type(lookup.props)
 assert.equal(renderToStaticMarkup(tree),'<div>child</div>')
 tree.props.onClickCapture({target:new Element()})
 assert.equal(opened,0)
})
