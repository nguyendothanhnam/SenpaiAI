import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { answerLearn, acceptsStudy, createLearn, gradeStudy, kanaRomaji, matchPair, type StudyQuestion } from '../../shared-games/flashcard-study'
import { flashcardDraftKey, flashcardRequestKey, legacyCloudDeck, selectFlipCards, validateCloudDeck } from '../src/features/flashcards/helpers'
import { newSet } from '../src/features/study/types'

test('mobile uses the same typed grading and Learn queue as web',()=>{
  const q:StudyQuestion={id:'a',type:'typed',prompt:'cat',accepted:['猫','ねこ'],expected:'猫'}
  for(const value of ['ねこ','ネコ','neko','ＮＥＫＯ'])assert.equal(gradeStudy(q,value),true)
  assert.equal(acceptsStudy('gakko',['がっこう']),false)
  assert.equal(kanaRomaji('キップ'),'kippu')
  let state=createLearn([q,{...q,id:'b'}]);state=answerLearn(state,q,'wrong');assert.deepEqual(state.queue,['b','a'])
  assert.deepEqual(matchPair({a:'1',b:'2'},'b','1'),{b:'1'})
})
test('local-to-account transfer preserves original set and never invents progress',()=>{
  const set={...newSet('flashcard'),name:'N5',cards:[{front:'猫',back:'mèo'}]}
  const before=JSON.stringify(set),copy=legacyCloudDeck(set)
  assert.equal(copy.local_id,set.id);assert.equal(copy.cards[0].reading,'');assert.equal(JSON.stringify(set),before)
  assert.equal('stats' in copy,false)
})
test('cloud editor validates duplicates and isolates drafts by account and set',()=>{
  const card={front:'猫',back:'mèo',reading:'ねこ',note:''},deck={title:'N5',description:'',jlpt_level:'N5',topic:'',cards:[card]}
  assert.equal(validateCloudDeck(deck),null)
  assert.equal(validateCloudDeck({...deck,cards:[card,{...card}]}),'duplicateCard')
  assert.equal(validateCloudDeck({...deck,cards:[{...card,front:' '}]}),'invalid')
  assert.notEqual(flashcardDraftKey(1,2),flashcardDraftKey(2,2));assert.notEqual(flashcardDraftKey(1,2),flashcardDraftKey(1,3))
  assert.match(flashcardRequestKey(),/^[A-Za-z0-9_-]{8,64}$/)
})
test('star-only shuffle does not mutate a source deck',()=>{
  const cards=[{id:1,front:'a',back:'b',reading:'',note:''},{id:2,front:'c',back:'d',reading:'',note:'',progress:{state:'new' as const,stage:0,due_at:null,correct:0,wrong:0,last_reviewed_at:null,starred:true}}]
  assert.deepEqual(selectFlipCards(cards,true,true).map(c=>c.id),[2]);assert.equal(cards[0].id,1)
})
test('new Flashcard routes remain inside authenticated Stack and quiz paths stay local',()=>{
  const layout=readFileSync(new URL('../app/_layout.tsx',import.meta.url),'utf8')
  for(const route of ['study/flashcard-detail','study/flashcard-editor','study/flashcard-learn','study/flashcard-test','study/flashcard-stats'])assert.ok(layout.includes(route))
  assert.match(readFileSync(new URL('../app/study/quiz.tsx',import.meta.url),'utf8'),/StudyLibraryScreen/)
  assert.match(readFileSync(new URL('../app/study/editor.tsx',import.meta.url),'utf8'),/kind==='flashcard'/)
})
