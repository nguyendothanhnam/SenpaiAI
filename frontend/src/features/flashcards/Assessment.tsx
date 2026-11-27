import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { flashcardsAPI as api } from '../../services/flashcards'
import type { Assessment, AssessmentPayload, AssessmentSubmission } from '../../../../shared-games/flashcard-types'
import { answerLearn, createLearn, gradeStudy, isStudyAnswerComplete, matchPair } from '../../../../shared-games/flashcard-study'
import type { StudyQuestion, StudyAnswer, QuestionType } from '../../../../shared-games/flashcard-study'
import './flashcards.css'
import FlashcardShell from './FlashcardShell'
import { BookOpen, CheckCircle2, Clock3, Flame, Target, TrendingUp, History } from 'lucide-react'

const button='btn btn-outline px-3'
export default function AssessmentPage({account,id,mode}:{account:number;id?:number;mode:'learn'|'test'}){
  const{t}=useTranslation('common'),f=(key:string,values?:Record<string,unknown>)=>String(t(`flashcardsStudy.${key}`,values)),cache=useQueryClient(),[params]=useSearchParams()
  const[count,setCount]=useState(20),[types,setTypes]=useState<QuestionType[]>(['choice','typed']),[round,setRound]=useState(0)
  const[active,setActive]=useState<Assessment|null>(null),[learn,setLearn]=useState(()=>createLearn([])),[index,setIndex]=useState(0),[answer,setAnswer]=useState<StudyAnswer>(''),[answers,setAnswers]=useState<Record<string,StudyAnswer>>({})
  const[feedback,setFeedback]=useState<{correct:boolean;question:StudyQuestion}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const startBody=useRef<AssessmentPayload|null>(null),submission=useRef<AssessmentSubmission|null>(null),started=useRef(Date.now()),lock=useRef(false)
  const history=params.get('attempt')
  const previous=useQuery(['flashcards',account,'assessment',history],()=>api.assessment(history!),{enabled:!!history,retry:false})
  useEffect(()=>{if(previous.data)setActive(previous.data)},[previous.data])
  const begin=async(nextRound=round)=>{
    if(!id||lock.current)return
    lock.current=true;setBusy(true);setError('')
    const value={deck_id:id,mode,count,types,round_index:nextRound}
    if(!startBody.current||JSON.stringify({...startBody.current,request_id:undefined})!==JSON.stringify(value))startBody.current={...value,request_id:crypto.randomUUID()}
    try{const data=await api.start(startBody.current);setActive(data);setLearn(createLearn(data.questions));setIndex(0);setAnswers({});setAnswer('');setFeedback(null);submission.current=null;started.current=Date.now();setRound(nextRound)}catch{setError(f('error'))}finally{setBusy(false);lock.current=false}
  }
  const save=async()=>{
    if(!active||lock.current)return
    if(!submission.current)submission.current={duration_seconds:Math.min(14400,Math.round((Date.now()-started.current)/1000)),answers:mode==='learn'?learn.responses:Object.entries(answers).map(([question_id,value])=>({question_id,answer:value}))}
    if(!submission.current.answers.length)return
    lock.current=true;setBusy(true);setError('')
    try{setActive(await api.submit(active.id,submission.current));await cache.invalidateQueries(['flashcards',account])}catch{setError(f('error'))}finally{setBusy(false);lock.current=false}
  }
  const q=active?.questions[mode==='learn'?active.questions.findIndex(item=>item.id===learn.queue[0]):index]
  const valid=q&&isStudyAnswerComplete(q,answer)
  const mark=()=>{
    if(!q||!valid||busy||feedback||mode==='learn'&&learn.responses.length>=500)return
    if(mode==='learn'){setFeedback({correct:gradeStudy(q,answer),question:q});setLearn(current=>answerLearn(current,q,answer))}
    else{setAnswers(current=>({...current,[q.id]:answer}));if(index+1<active!.questions.length){const next=active!.questions[index+1];setIndex(index+1);setAnswer(answers[next.id]??'')}}
  }
  const errorNotice=(error||previous.isError)&&<p role="alert" className="fc-panel">{error||f('error')}</p>
  if(!id&&!history)return <FlashcardShell><p>{f('chooseDeck')}</p></FlashcardShell>
  if(!active)return <FlashcardShell><h1 className="text-2xl font-bold">{f(mode)}</h1>{errorNotice}{history?<p>{f('loading')}</p>:<div className="fc-panel fc-setup space-y-3"><p>{f(mode==='learn'?'learnHelp':'testHelp')}</p>{mode==='test'&&<><label>{f('questionCount')}<input type="number" min={1} max={100} value={count} onChange={e=>setCount(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label><fieldset><legend>{f('questionTypes')}</legend>{(['choice','typed','true_false','match']as const).map(type=><label className="fc-toggle" key={type}><input type="checkbox" checked={types.includes(type)} onChange={e=>setTypes(current=>e.target.checked?[...current,type]:current.filter(v=>v!==type))}/>{f(type)}</label>)}</fieldset></>}<button className="btn btn-primary px-4" disabled={busy||!types.length} onClick={()=>void begin()}>{f(busy?'loading':'start')}</button></div>}<Link to={`/flashcard/${id}`} className={button}>{f('back')}</Link></FlashcardShell>
  if(active.status==='completed'&&active.result)return <FlashcardShell><h1 className="text-2xl font-bold">{f('summary')}</h1><div className="fc-panel"><p>{f('result',{...active.result})}</p><p>{f('scheduleHelp')}</p></div>{active.result.questions.map((row,i)=>{const question=active.questions.find(item=>item.id===row.question_id);return <details className="fc-panel" key={i} open={!row.correct}><summary>{f(row.correct?'correct':'wrong')} · {question?.prompt||f('match')}</summary>{question&&<><p>{f('yourAnswer')}: {displayAnswer(question,row.answer,f)}</p><p>{f('expected')}: {displayAnswer(question,row.expected,f)}</p>{row.reading&&<p lang="ja">{row.reading}</p>}</>}</details>})}{!history&&mode==='learn'&&<button disabled={busy} className={button} onClick={()=>{startBody.current=null;void begin(round+1)}}>{f('nextRound')}</button>}<Link className={button} to={`/flashcard/${active.deck_id}`}>{f('back')}</Link><Link className={button} to={`/flashcard/stats?set=${active.deck_id}`}>{f('statistics')}</Link>{errorNotice}</FlashcardShell>
  return <FlashcardShell><header className="fc-panel fc-session-header"><h1 className="text-2xl font-bold">{f(mode)}</h1><p>{f('actualCount',{count:active.questions.length})}{mode==='learn'?` · ${f('round',{number:round+1})}`:''}</p><progress max={active.questions.length} value={mode==='learn'?active.questions.filter(item=>!learn.queue.includes(item.id)).length:Object.keys(answers).length} aria-label={f('progress')}/></header>{errorNotice}
    {q&&!feedback&&<fieldset className="fc-panel fc-question space-y-3" disabled={busy}><legend>{f(q.type)}</legend><h2 className="text-2xl fc-card-text">{q.prompt||f('matchHelp')}</h2><QuestionInput question={q} answer={answer} onChange={setAnswer} f={f}/><button className={button} disabled={!valid} onClick={mark}>{f(mode==='learn'?'check':'recordAnswer')}</button></fieldset>}
    {feedback&&<div className="fc-panel fc-feedback space-y-3" data-correct={feedback.correct} role="status"><p>{f(feedback.correct?'correct':'wrong')}</p><p>{f('expected')}: {displayAnswer(feedback.question,feedback.question.expected,f)}</p>{feedback.question.reading&&<p lang="ja">{feedback.question.reading}</p>}<button className={button} onClick={()=>{setFeedback(null);setAnswer('')}}>{f('continue')}</button></div>}
    <footer className="fc-toolbar space-y-3">{mode==='test'&&<div className="fc-row"><button className={button} disabled={index===0||busy} onClick={()=>{const next=index-1;setIndex(next);setAnswer(answers[active.questions[next].id]??'')}}>{f('previous')}</button><p>{index+1}/{active.questions.length}</p><button className="btn btn-primary px-4" disabled={Object.keys(answers).length!==active.questions.length||busy} onClick={()=>void save()}>{f('submit')}</button></div>}
    {mode==='learn'&&<><p>{f('remaining',{count:learn.queue.length})}</p>{learn.responses.length>=490&&<p>{f('roundLimit')}</p>}<button className="btn btn-primary px-4" disabled={!learn.responses.length||busy} onClick={()=>void save()}>{f(learn.queue.length?'finishRound':'saveRound')}</button></>}
    <Link className={button} to={`/flashcard/${active.deck_id}`} onClick={()=>{if(active.status==='active')void api.abandon(active.id)}}>{f('leave')}</Link></footer>
  </FlashcardShell>
}

function displayAnswer(q:StudyQuestion,value:unknown,f:(key:string)=>string):string{
  if(q.type==='true_false')return f(value===true?'true':'false')
  if(q.type==='choice')return q.options?.find(o=>o.id===value)?.label||String(value??'')
  if(q.type==='match'&&value&&typeof value==='object')return(q.targets||[]).map(t=>`${t.label} → ${q.options?.find(o=>o.id===(value as Record<string,string>)[t.id])?.label||'—'}`).join('; ')
  return String(value??'')
}
function QuestionInput({question:q,answer,onChange,f}:{question:StudyQuestion;answer:StudyAnswer;onChange:(value:StudyAnswer)=>void;f:(key:string)=>string}){
  if(q.type==='typed')return <label>{f('answer')}<input value={typeof answer==='string'?answer:''} maxLength={2000} autoComplete="off" onChange={e=>onChange(e.target.value)}/></label>
  if(q.type==='true_false')return <><p lang="ja">{q.candidate}</p><div className="fc-evaluation">{[true,false].map(v=><button type="button" className="fc-option" key={String(v)} aria-pressed={answer===v} onClick={()=>onChange(v)}>{f(v?'true':'false')}</button>)}</div></>
  if(q.type==='choice')return <div className="grid gap-2">{q.options?.map(o=><button type="button" className="fc-option" key={o.id} aria-pressed={answer===o.id} onClick={()=>onChange(o.id)}>{o.label}</button>)}</div>
  const selected=typeof answer==='object'?answer:{}
  return <div className="space-y-3">{q.targets?.map(t=><label key={t.id}>{t.label}<select value={selected[t.id]||''} onChange={e=>onChange(matchPair(selected,t.id,e.target.value))}><option value="">{f('choose')}</option>{q.options?.map(o=><option value={o.id} key={o.id}>{o.label}</option>)}</select></label>)}</div>
}

export function FlashcardStatistics({account,id}:{account:number;id?:number}){
  const{t,i18n}=useTranslation('common'),f=(key:string,values?:Record<string,unknown>)=>String(t(`flashcardsStudy.${key}`,values)),[offset,setOffset]=useState(0)
  const stats=useQuery(['flashcards',account,'stats',id],()=>api.deckStats(id))
  const history=useQuery(['flashcards',account,'history',id,offset],()=>api.history(id,offset))
  return <FlashcardShell><h1 className="text-2xl font-bold">{f('statistics')}</h1>{(stats.isError||history.isError)&&<p role="alert">{f('error')} <button className={button} onClick={()=>{void stats.refetch();void history.refetch()}}>{f('retry')}</button></p>}{stats.isLoading?<p>{f('loading')}</p>:stats.data&&<div className="fc-kpis">{(['new','learning','mastered','accuracy','review_streak','due_today']as const).map(key=>{const Icon={new:BookOpen,learning:TrendingUp,mastered:CheckCircle2,accuracy:Target,review_streak:Flame,due_today:Clock3}[key];return <div className="fc-panel fc-kpi" key={key}><Icon aria-hidden="true"/><h2>{f(key)}</h2><strong>{stats.data[key]||0}{key==='accuracy'?'%':''}</strong></div>})}</div>}<section className="fc-panel fc-history"><h2 className="text-lg font-bold">{f('history')}</h2>{history.data?.total===0&&<div className="fc-empty"><History size={32} aria-hidden="true"/><p>{f('noHistory')}</p></div>}{history.data?.items.map(item=><article className="fc-history-entry" key={item.id}><p>{f(item.mode)} · {new Date(item.created_at).toLocaleString(i18n.language)}</p><p>{f('result',{...item})}</p><Link className={button} to={`/flashcard/${item.mode}?set=${item.deck_id}&attempt=${item.id}`}>{f('review')}</Link></article>)}<div className="fc-row"><button className={button} disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-20))}>{f('previous')}</button><button className={button} disabled={offset+20>=(history.data?.total||0)} onClick={()=>setOffset(v=>v+20)}>{f('next')}</button><Link className={button} to={id?`/flashcard/${id}`:'/flashcard'}>{f('back')}</Link></div></section></FlashcardShell>
}
