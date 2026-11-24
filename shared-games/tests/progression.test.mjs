import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),g=require('../../tmp/minigames-tests/index.js')
const day='2026-11-23'
test('free web rounds have a finite goal and finish exactly at it without campaign rewards',()=>{
 let run=g.createLearningRun('falling','N5','easy',8,'reading','hiragana','finite',day)
 assert.equal(run.goal,10);assert.equal(run.mission,undefined)
 for(let i=0;i<10;i++){
   if(!run.round.falling.questions.length)run=g.advanceLearningRun(run,{type:'tick',ms:250})
   while(!run.round.falling.questions.length)run=g.advanceLearningRun(run,{type:'tick',ms:250})
   const q=run.round.falling.questions[0]
   run=g.advanceLearningRun(run,{type:'answer',id:q.id,value:q.answer})
   if(i<9)assert.equal(run.round.session.status,'playing')
 }
 assert.equal(run.round.session.correct,10);assert.equal(run.round.session.reason,'completed')
 assert.deepEqual(g.recordProgress(g.emptyProgress(),run.round.session,day).stars,{})
})
function completed(id,overrides={}){return{...g.createRound('falling','N5','easy',1).session,id,status:'finished',reason:'completed',correct:5,mistakes:0,elapsedMs:6000,longestChain:5,...overrides}}
test('campaign stars require target/accuracy, unlock next stage, boss is last and no unsupported level appears',()=>{
 const stages=g.campaign('falling','N5');assert.equal(stages.length,3);assert.equal(stages[2].boss,true)
 let p=g.emptyProgress();assert.equal(g.unlocked(p,stages[0]),true);assert.equal(g.unlocked(p,stages[1]),false)
 assert.equal(g.missionStars(completed('a'),stages[0]),3)
 assert.equal(g.missionStars(completed('a',{correct:3,mistakes:1}),stages[0]),1)
 assert.equal(g.missionStars(completed('a',{correct:2}),stages[0]),0)
 assert.equal(g.missionStars(completed('a',{reason:'lives'}),stages[0]),0)
 assert.equal(g.recordProgress(p,completed('fast',{elapsedMs:500}),day,stages[0]).stars[stages[0].id],3)
 p=g.recordProgress(p,completed('a'),day,stages[0]);assert.equal(g.unlocked(p,stages[1]),true)
 assert.deepEqual(g.campaign('battle','N5'),[])
 assert.equal(g.campaign('wordsearch','N3').at(-1).target,6)
})
test('XP, streaks, chapter badges and daily bonus are idempotent and never granted for quit',()=>{
 let p=g.emptyProgress();const stages=g.campaign('falling','N5')
 for(let i=0;i<3;i++)p=g.recordProgress(p,completed('stage'+i,{correct:7,longestChain:10}),`2026-11-${21+i}`,stages[i])
 assert.ok(p.badges.includes('perfect'));assert.ok(p.badges.includes('chapter'));assert.ok(p.badges.includes('combo10'));assert.ok(p.badges.includes('streak3'))
 assert.equal(g.playStreak(p.days,day),3);assert.equal(g.playStreak(p.days,'2026-11-25'),0)
 assert.equal(g.recordProgress(p,completed('stage2'),day),p)
 const quit=g.recordProgress(p,completed('quit',{reason:'quit'}),day);assert.equal(quit.xp,p.xp)
 const daily=g.dailyChallenge(day,'N5');assert.deepEqual(g.dailyChallenge(day,'N5'),daily);assert.equal(daily.limitMs,45000)
 const a=g.recordProgress(p,completed('daily1'),day,daily),b=g.recordProgress(a,completed('daily2'),day,daily)
 assert.equal(a.xp-p.xp-(b.xp-a.xp),30)
 assert.equal(g.appGameDay(Date.parse('2026-11-22T17:00:00Z')),day)
 assert.throws(()=>g.dailyChallenge('2026-02-30','N5'))
})
test('adaptive difficulty moves within bounds and wrappers capture actual wrong targets without changing legacy reducer',()=>{
 let state={difficulty:'normal',good:0,bad:0};for(let i=0;i<3;i++)state=g.adapt(state,true);assert.equal(state.difficulty,'hard')
 for(let i=0;i<2;i++)state=g.adapt(state,false);assert.equal(state.difficulty,'normal')
 const run=g.createLearningRun('falling','N5','normal',7,'reading','hiragana','round1',day),q=run.round.falling.questions[0]
 const wrong=q.options.find(x=>x!==q.answer),next=g.advanceLearningRun(run,{type:'answer',id:q.id,value:wrong})
 assert.equal(next.events.length,1);assert.equal(next.events[0].source_id,q.item.id);assert.equal(next.round.session.difficulty,'normal')
 assert.equal(run.events.length,0);assert.equal(run.round.session.mistakes,0)
 const paused=g.advanceLearningRun(next,{type:'pause'});assert.equal(g.advanceLearningRun(paused,{type:'tick',ms:100}).round.session.elapsedMs,paused.round.session.elapsedMs)
})
test('battle chapter boss must actually be defeated and challenge clock freezes while paused',()=>{
 const mission=g.campaign('battle','N3').at(-1)
 let run=g.createLearningRun('battle','N3','hard',3,'reading','hiragana','boss',day,mission)
 let sawBoss=false
 for(let i=0;i<50&&run.round.session.status==='playing';i++){
   const board=run.round.battle
   if(board.stage===3){sawBoss=true;assert.equal(run.round.session.status,'playing')}
   const pair=board.pairs.find(p=>!board.matched.includes(p.id))
   run=g.advanceLearningRun(run,{type:'match',wordId:pair.id,meaningId:pair.id,boardId:board.boardId})
 }
 assert.ok(sawBoss);assert.equal(run.round.session.reason,'completed');assert.ok(run.round.battle.stage>3)
 const daily=g.dailyChallenge(day,'N3'),memory={...daily,game:'memory',level:'N3'}
 let paused=g.createLearningRun('memory','N3','normal',1,'reading','hiragana','timer',day,memory)
 paused=g.advanceLearningRun(paused,{type:'pause'});assert.equal(g.advanceLearningRun(paused,{type:'tick',ms:250}).round.session.elapsedMs,0)
 paused=g.advanceLearningRun(paused,{type:'resume'});for(let i=0;i<180;i++)paused=g.advanceLearningRun(paused,{type:'tick',ms:250})
 assert.equal(paused.round.session.status,'finished');assert.equal(g.missionStars(paused.round.session,memory),0)
})
