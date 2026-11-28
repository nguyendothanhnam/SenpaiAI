import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const compile=name=>ts.transpileModule(readFileSync(new URL(name,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:name}).outputText

test('manual playback shows all strokes after an error review; a new review restores single-stroke playback',()=>{
 const helpers={};vm.runInNewContext(compile('../src/features/kanjiWriting/practice.ts'),{exports:helpers})
 let state,tree
 const hooks={useId:()=> 'reference-test',useState:initial=>{state??=initial;return[state,value=>{state=typeof value==='function'?value(state):value}]}}
 const exports={}
 vm.runInNewContext(compile('../src/components/kanji/WritingReference.tsx'),{exports,require:name=>({
  react:hooks,'react/jsx-runtime':jsxRuntime,'react-i18next':{useTranslation:()=>({t:key=>key})},
  '../../features/kanjiWriting/practice':helpers})[name]})
 const props={kanji:'月',strokes:[[{x:0,y:0},{x:0,y:1}],[{x:0,y:0},{x:1,y:1}]],highlight:2,playKey:1}
 const render=()=>{tree=exports.default(props);return renderToStaticMarkup(tree)}
 const animations=html=>(html.match(/class="writing-reference-stroke"/g)||[]).length
 assert.equal(animations(render()),1)
 tree.props.children[0].props.children[1].props.onClick()
 assert.equal(animations(render()),2)
 props.highlight=1;props.playKey++
 assert.equal(animations(render()),1)
 props.highlight=0;props.playKey++
 assert.equal(animations(render()),0)
 tree.props.children[0].props.children[1].props.onClick()
 assert.equal(animations(render()),2)
})
