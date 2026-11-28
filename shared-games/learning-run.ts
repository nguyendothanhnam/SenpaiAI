import { createRound,reduceRound,type Round,type Action } from './session'
import { finish } from './lifecycle'
import { adapt,type Adaptive,type Mission } from './progression'
import { availability } from './availability'
import { DIFFICULTY,LEVELS,type Game,type Level,type Difficulty,type AnswerMode,type Alphabet } from './types'
export type ReviewKind = 'kanji'|'word'|'kana'|'mechanic'
export interface GameLearningEvent { event_id:string; game:Game|'review'; level:Level; source_type:ReviewKind; source_id:string; action:'wrong'|'reviewed'; answer:string }
export interface LearningRun { round:Round; adaptive:Adaptive; events:GameLearningEvent[]; mission?:Mission; startedDay:string; goal:number }
export function createLearningRun(game:Game,level:Level,difficulty:Difficulty,seed:number,mode:AnswerMode,alphabet:Alphabet,id:string,day:string,mission?:Mission):LearningRun {
  const round=createRound(game,level,difficulty,seed,mode,alphabet,id)
  const goals:Record<Game,number>={falling:10,shiritori:10,cipher:8,memory:6,battle:12,workshop:8,wordsearch:round.wordsearch?.words.length||4,ninja:10,missing:10}
  return {round,adaptive:{difficulty,good:0,bad:0},events:[],mission,startedDay:day,goal:mission?.target||goals[game]}
}
function mistakeSources(before:Round,action:Action,count:number):{kind:ReviewKind;id:string}[] {
  const game=before.session.game
  if(game==='falling'){
    const questions=action.type==='answer'?before.falling.questions.filter(q=>q.id===action.id):action.type==='tick'?before.falling.questions.filter(q=>q.ageMs+Math.min(action.ms,250)>=q.durationMs):[]
    return questions.slice(0,count).map(q=>({kind:'kanji',id:q.item.id}))
  }
  if(game==='cipher'&&before.cipher)return [{kind:'word',id:before.cipher.word.id}]
  if(game==='shiritori'&&action.type==='answer')return [{kind:'word',id:action.value}]
  if(game==='memory'&&before.memory)return [{kind:'kana',id:before.memory.sequence[before.memory.entered]}]
  if(game==='battle'&&action.type==='match')return [{kind:'word',id:action.wordId}]
  if(game==='workshop'&&before.workshop)return [{kind:'word',id:before.workshop.target.id}]
  if(game==='missing'&&before.missing)return [{kind:'kanji',id:before.missing.glyph.id}]
  if(game==='ninja'&&before.ninja)return Array.from({length:count},()=>({kind:'word',id:before.ninja!.request.id}))
  // Invalid paths and enemy attacks have no uniquely identified vocabulary target.
  return Array.from({length:count},()=>({kind:'mechanic',id:`${game}:${before.session.level}`}))
}
export function advanceLearningRun(state:LearningRun,action:Action):LearningRun {
  const before=state.round,original=before.session.difficulty
  let difficulty=state.adaptive.difficulty
  if(!availability(before.session.game,before.session.level,difficulty,before.mode,before.alphabet).enabled)difficulty=original
  const next=reduceRound({...before,session:{...before.session,difficulty}},action)
  let round={...next,session:{...next.session,difficulty:original}}
  let adaptive=state.adaptive
  const correct=round.session.correct-before.session.correct,wrong=round.session.mistakes-before.session.mistakes
  for(let i=0;i<correct;i++)adaptive=adapt(adaptive,true)
  for(let i=0;i<wrong;i++)adaptive=adapt(adaptive,false)
  if(round.memory&&round.memory.phase==='showing'&&availability(round.session.game,round.session.level,adaptive.difficulty,round.mode,round.alphabet).enabled) round={...round,memory:{...round.memory,durationMs:Math.max(320,DIFFICULTY[adaptive.difficulty].memoryMs-LEVELS.indexOf(round.session.level)*40)}}
  const added=wrong>0?mistakeSources(before,action,wrong).map((item,i):GameLearningEvent=>({event_id:`${before.session.id}:${before.session.mistakes+i+1}`,game:before.session.game,level:before.session.level,source_type:item.kind,source_id:item.id,action:'wrong',answer:action.type==='answer'?action.value.slice(0,120):''})):[]
  const reached=round.session.correct>=state.goal&&(!state.mission?.boss||round.session.game!=='battle'||(round.battle?.stage||0)>3)
  if(round.session.status==='playing'&&(reached||state.mission&&round.session.elapsedMs>=state.mission.limitMs))round={...round,session:finish(round.session,reached?'completed':'exhausted')}
  return {...state,round,adaptive,events:added.length?[...state.events,...added]:state.events}
}
