import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const exports={}
const source=readFileSync(new URL('../../shared-games/flashcard-study.ts',import.meta.url),'utf8')
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,require:()=>JSON.parse(readFileSync(new URL('../../shared-games/flashcard-kana.json',import.meta.url),'utf8'))})
test('shared typed grading handles kana, romaji, width and case without accepting a shorter reading',()=>{
 for(const answer of ['ねこ','ネコ','neko','ＮＥＫＯ',' neko '])assert.equal(exports.acceptsStudy(answer,['猫','ねこ']),true,answer)
 for(const answer of ['gakkou','gakkō','gakkoo'])assert.equal(exports.acceptsStudy(answer,['がっこう']),true,answer)
 assert.equal(exports.acceptsStudy('gakko',['がっこう']),false)
 assert.equal(exports.acceptsStudy('cho',['chó']),false)
 assert.equal(exports.acceptsStudy('sya',['しゃ']),true)
 assert.equal(exports.acceptsStudy('kippu',['きっぷ']),true)
})
test('Learn requeues errors behind remaining cards and collects the transcript',()=>{
 const a={id:'a',type:'typed',prompt:'cat',expected:'猫',accepted:['猫','ねこ']},b={id:'b',type:'choice',prompt:'dog',expected:'correct'}
 let state=exports.createLearn([a,b]);state=exports.answerLearn(state,a,'wrong')
 assert.equal(JSON.stringify(state.queue),'["b","a"]')
 assert.equal(exports.answerLearn(state,a,'neko'),state)
 state=exports.answerLearn(state,b,'correct');state=exports.answerLearn(state,a,'neko')
 assert.equal(state.queue.length,0);assert.equal(state.responses.length,3);assert.equal(state.visits.a,2)
})
test('matching choices are exclusive and partial answers fail',()=>{
 const q={id:'q',type:'match',prompt:'',targets:[{id:'a',label:'cat'},{id:'b',label:'dog'}],expected:{a:'cat',b:'dog'}}
 assert.equal(exports.gradeStudy(q,{a:'cat'}),false)
 assert.equal(exports.gradeStudy(q,{a:'cat',b:'dog'}),true)
 assert.equal(JSON.stringify(exports.matchPair({a:'cat',b:'dog'},'b','cat')),'{"b":"cat"}')
})
test('true false grading requires a boolean and does not coerce text',()=>{
 assert.equal(exports.gradeStudy({id:'q',type:'true_false',prompt:'',expected:false},false),true)
 assert.equal(exports.gradeStudy({id:'q',type:'true_false',prompt:'',expected:false},'false'),false)
})
test('blank or duplicate matching selections cannot be submitted',()=>{
 const q={id:'q',type:'match',targets:[{id:'a',label:'cat'},{id:'b',label:'dog'}],options:[{id:'1',label:'猫'},{id:'2',label:'犬'}]}
 assert.equal(exports.isStudyAnswerComplete(q,{a:'1',b:''}),false)
 assert.equal(exports.isStudyAnswerComplete(q,{a:'1',b:'1'}),false)
 assert.equal(exports.isStudyAnswerComplete(q,{a:'1',b:'2'}),true)
})
test('study labels display option text instead of implementation ids',()=>{
 const q={type:'choice',options:[{id:'uuid',label:'猫'}]}
 assert.equal(exports.studyAnswerLabel(q,'uuid','Đúng','Sai'),'猫')
})
test('all literal web/mobile study translation keys exist in both shared locales',()=>{
 const vi=JSON.parse(readFileSync(new URL('../src/i18n/locales/vi/common.json',import.meta.url),'utf8')).flashcardsStudy
 const en=JSON.parse(readFileSync(new URL('../src/i18n/locales/en/common.json',import.meta.url),'utf8')).flashcardsStudy
 assert.deepEqual(Object.keys(vi).sort(),Object.keys(en).sort())
 for(const path of ['../src/features/flashcards/Assessment.tsx','../../mobile/src/screens/study/CloudAssessment.tsx','../../mobile/src/screens/study/CloudLibrary.tsx','../../mobile/src/screens/study/CloudEditor.tsx']){
  const text=readFileSync(new URL(path,import.meta.url),'utf8')
  for(const [,key]of text.matchAll(/\b(?:s|f)\('([^']+)'/g)){
   if(vi[key]||JSON.parse(readFileSync(new URL('../src/i18n/locales/vi/common.json',import.meta.url),'utf8')).flashcardsManager[key])continue
   assert.fail(`Missing UI key ${key}`)
  }
 }
})
