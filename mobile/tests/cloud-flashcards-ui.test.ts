import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as helpers from '../src/features/flashcards/helpers'
const require=createRequire(import.meta.url)
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
function load(path:string,mocks:Record<string,unknown>){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const module={exports:{} as Record<string,unknown>};new Function('require','module','exports',code)((name:string)=>name in mocks?mocks[name]:require(name),module,module.exports);return module.exports}
const common=JSON.parse(readFileSync(new URL('../../frontend/src/i18n/locales/en/common.json',import.meta.url),'utf8'))
const words=()=>({f:(key:string,values?:Record<string,unknown>)=>text(common.flashcardsManager[key]||key,values),s:(key:string,values?:Record<string,unknown>)=>text(common.flashcardsStudy[key]||key,values)})
function text(value:string,values?:Record<string,unknown>){for(const[k,v]of Object.entries(values||{}))value=value.replaceAll(`{{${k}}}`,String(v));return value}

for(const tracking of [true,false])test(`native flip uses swipes and ${tracking?'idempotent review retry':'no progress writes'}`,async()=>{
  const calls:unknown[]=[],handlers:{release?:(_:unknown,g:{dx:number;dy:number})=>void}={}
  let fail=true
  const source={cards:[{id:1,front:'猫',back:'mèo',reading:'ねこ',note:''},{id:2,front:'犬',back:'chó',reading:'いぬ',note:''}],title:'N5',total:2}
  const ui=load('../src/features/flashcards/ui.tsx',{'react-native':{},'expo-router':{},'react-i18next':{},'../../components/ui':{},'../../components/ChoiceSheet':{},'../../theme/ThemeProvider':{}})
  class Value{setValue(){}interpolate(){return'0deg'}}
  const native={AccessibilityInfo:{isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}})},AppState:{currentState:'active'},Animated:{Value,View:'AnimatedView',timing:()=>({start(){},stop(){}})},PanResponder:{create:(value:{onPanResponderRelease:typeof handlers.release})=>{handlers.release=value.onPanResponderRelease;return{panHandlers:{}}}},Pressable:'Pressable',View:'View'}
  const module=load('../src/screens/study/CloudFlip.tsx',{'react-native':native,'react-query':{useQuery:()=>({data:source}),useQueryClient:()=>({invalidateQueries:async()=>{}})},'../../components/ui':{...Object.fromEntries(['AppText','Button','Card','Loading','Muted','Progress','Screen','Title'].map(n=>[n,n])),styles:{row:{}}},'../../api/flashcards':{flashcardsAPI:{review:async(body:unknown)=>{calls.push(JSON.parse(JSON.stringify(body)));if(fail){fail=false;throw Error('offline')}}}},'../../features/flashcards/helpers':helpers,'../../features/flashcards/useSpeech':{useFlashcardSpeech:()=>({enabled:false,available:false,toggle(){},speak:async()=>{}})},'../../features/flashcards/ui':{useCloudWords:words,useCloudWork:ui.useCloudWork,CloudBack:'CloudBack',CloudError:'CloudError',CloudSelect:'CloudSelect',CloudSpeech:'CloudSpeech',CloudToggle:'CloudToggle'},'./shared':{Field:'Field',useLeaveGuard(){}}})
  const Component=module.CloudFlip as React.ComponentType<{account:number;id:number}>
  let renderer:ReactTestRenderer|undefined
  const tap=async(label:string)=>act(async()=>{renderer!.root.find(n=>String(n.type)==='Button'&&n.props.title===label).props.onPress()})
  try{
    await act(async()=>{renderer=create(React.createElement(Component,{account:1,id:1}))})
    if(!tracking)await act(async()=>{renderer!.root.find(n=>String(n.type)==='CloudToggle'&&n.props.label==='Track progress').props.onChange(false)})
    await tap('Start')
    await act(async()=>{handlers.release!(null,{dx:100,dy:0})})
    await act(async()=>{handlers.release!(null,{dx:-100,dy:0})})
    if(tracking){assert.equal(calls.length,1);await tap('Retry');assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);const result=calls[0] as {results:{card_id:number;correct:boolean}[]};assert.deepEqual(result.results,[{card_id:1,correct:true},{card_id:2,correct:false}])}
    else assert.equal(calls.length,0)
  }finally{await act(async()=>renderer?.unmount())}
})

test('Expo speech selects a real Japanese voice, honors toggle and stops on unmount',async()=>{
  const spoken:{text:string;voice:string}[]=[],stops:string[]=[]
  const speech={getAvailableVoicesAsync:async()=>[{language:'en-US',identifier:'en'},{language:'ja-JP',identifier:'ja-device'}],stop:async()=>{stops.push('stop')},speak:(text:string,options:{voice:string})=>spoken.push({text,voice:options.voice}),maxSpeechInputLength:4000}
  const module=load('../src/features/flashcards/useSpeech.ts',{'react-native':{AppState:{addEventListener:()=>({remove(){}})}},'expo-speech':speech})
  let value:{enabled:boolean;available:boolean;toggle:(v:boolean)=>void;speak:(card:{front:string;back:string;reading:string;note:string})=>Promise<void>}
  const useHook=module.useFlashcardSpeech as ()=>typeof value
  function Probe(){value=useHook();return null}
  let renderer:ReactTestRenderer|undefined
  await act(async()=>{renderer=create(React.createElement(Probe))})
  assert.equal(value!.available,true)
  const card={front:'猫',back:'mèo',reading:'ねこ',note:''}
  await value!.speak(card);assert.equal(spoken.length,0)
  await act(async()=>value!.toggle(true));await value!.speak(card)
  assert.deepEqual(spoken,[{text:'ねこ',voice:'ja-device'}])
  await act(async()=>renderer?.unmount());assert.ok(stops.length>=2)
})
