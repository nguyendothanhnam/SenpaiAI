import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const exports={},stored=new Map()
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/kanjiWriting/practice.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)}})
const items=[{kanji:'月',level:'N5',stroke_count:4,meaning_vi:'mặt trăng, tháng',onyomi:['ゲツ'],kunyomi:['つき']},{kanji:'日',level:'N5',stroke_count:4,meaning_vi:'ngày, mặt trời'},{kanji:'屋',level:'N4',stroke_count:9,meaning_vi:'mái nhà'}]
const history=[{kanji:'月',attempts:3,passed_count:2,last_passed:true,last_score:90,last_practiced:'2026-11-23T12:00:00Z'},{kanji:'日',attempts:2,passed_count:1,last_passed:false,last_score:40,last_practiced:'2026-11-24T12:00:00Z'}]
test('picker filters only supported entries by level, unaccented Vietnamese and kana variants',()=>{
 assert.equal(exports.filterCharacters(items,'N5','mat trang')[0].kanji,'月')
 assert.equal(exports.filterCharacters(items,'N5','げつ')[0].kanji,'月')
 assert.equal(exports.filterCharacters(items,'N5','月')[0].kanji,'月')
 assert.equal(exports.filterCharacters(items,'N3','')[0],undefined)
 assert.equal(exports.filterCharacters(items,'N5','mai nha').length,0)
})
test('mastery requires two passes AND a latest pass; suggestions prioritize recent errors then unseen',()=>{
 assert.equal(exports.writingStatus(),'unseen')
 assert.equal(exports.writingStatus(history[0]),'mastered')
 assert.equal(exports.writingStatus({...history[0],last_passed:false}),'learning')
 assert.equal(exports.writingStatus({...history[0],passed_count:1}),'learning')
 const result=exports.suggestCharacters(items,history)
 assert.equal(result.length,2);assert.equal(result[0].kanji,'日');assert.equal(result[1].kanji,'屋')
 assert.equal(exports.recentCharacters(items,history)[0].kanji,'日')
})
test('selection preferences are isolated by account and malformed values are ignored',()=>{
 exports.savePreference(7,'月','N5');exports.savePreference(8,'屋','N4')
 assert.equal(exports.readPreference(7).kanji,'月');assert.equal(exports.readPreference(8).kanji,'屋')
 stored.set('senpaiai.writing.selection.9','{broken');assert.equal(exports.readPreference(9),null)
 stored.set('senpaiai.writing.selection.9','{"kanji":"月","level":"bad"}');assert.equal(exports.readPreference(9),null)
})
test('overlay uses one whole-character transform, preserves direction and handles missing/extra strokes',()=>{
 const strokes=[[{x:10,y:20},{x:90,y:20}],[{x:30,y:100},{x:50,y:100}]]
 const normalized=exports.normalizeWriting(strokes)
 assert.ok(Math.abs(normalized[1][0].x-.25)<1e-8)
 const shifted=strokes.map(s=>s.map(p=>({x:p.x*2+50,y:p.y*2-20})))
 assert.equal(JSON.stringify(exports.normalizeWriting(shifted)),JSON.stringify(normalized))
 const overlay=exports.buildOverlay(strokes,normalized,{index:1,expected_index:1},false)
 assert.equal(overlay.user[0].x,10);assert.equal(overlay.template.at(-1).x,90)
 const missing=exports.buildOverlay(strokes.slice(0,1),normalized,{index:2,expected_index:2},false)
 assert.equal(missing.user.length,0);assert.equal(missing.template.length,32)
 const extra=exports.buildOverlay(strokes,normalized.slice(0,1),{index:2,expected_index:null},false)
 assert.equal(extra.template.length,0)
 const backwards=exports.buildOverlay([strokes[0].toReversed(),strokes[1]],normalized,{index:1,expected_index:1},false)
 assert.ok(backwards.user[0].x>backwards.user.at(-1).x)
})
test('feedback describes only observed geometry and keeps server status authoritative',()=>{
 const row={status:'wrong_shape',message_key:'writing.status.wrong_shape'}
 const template=[{x:0,y:0},{x:80,y:0}]
 assert.equal(exports.strokeDetail(row,{template,user:[{x:0,y:0},{x:20,y:0}]}),'writingUI.tooShort')
 assert.equal(exports.strokeDetail(row,{template,user:[{x:0,y:0},{x:160,y:0}]}),'writingUI.tooLong')
 assert.equal(exports.strokeDetail(row,{template,user:[{x:10,y:0},{x:90,y:0}]}),'writingUI.tooRight')
 assert.equal(exports.strokeDetail({status:'wrong_direction'},{template,user:template}),'writing.status.wrong_direction')
})
