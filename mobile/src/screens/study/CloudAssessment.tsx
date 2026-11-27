import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useQuery, useQueryClient } from 'react-query'
import { AppText, Button, Card, Loading, Muted, Progress, Screen, Title, styles } from '../../components/ui'
import { flashcardsAPI as api } from '../../api/flashcards'
import type { Assessment, AssessmentPayload, AssessmentSubmission } from '../../../../shared-games/flashcard-types'
import { answerLearn, createLearn, gradeStudy, isStudyAnswerComplete, matchPair, studyAnswerLabel } from '../../../../shared-games/flashcard-study'
import type { StudyAnswer, StudyQuestion, QuestionType } from '../../../../shared-games/flashcard-study'
import { flashcardRequestKey } from '../../features/flashcards/helpers'
import { CloudBack, CloudError, CloudSelect, CloudSpeech, CloudToggle, go, useCloudWords, useCloudWork } from '../../features/flashcards/ui'
import { useFlashcardSpeech } from '../../features/flashcards/useSpeech'
import { Field, useLeaveGuard } from './shared'

export function CloudAssessment({account,id,mode,attempt}:{account:number;id?:number;mode:'learn'|'test';attempt?:string}){
  const{s,f}=useCloudWords(),work=useCloudWork(),speech=useFlashcardSpeech(),cache=useQueryClient()
  const[count,setCount]=useState('20'),[types,setTypes]=useState<QuestionType[]>(['choice','typed']),[round,setRound]=useState(0)
  const[active,setActive]=useState<Assessment|null>(null),[learn,setLearn]=useState(()=>createLearn([])),[index,setIndex]=useState(0),[answers,setAnswers]=useState<Record<string,StudyAnswer>>({}),[answer,setAnswer]=useState<StudyAnswer>(''),[feedback,setFeedback]=useState<{question:StudyQuestion;correct:boolean}|null>(null)
  const startBody=useRef<{hash:string;body:AssessmentPayload}|null>(null),submission=useRef<AssessmentSubmission|null>(null),clock=useRef(Date.now())
  const previous=useQuery(['cloud-flashcards',account,'assessment',attempt],()=>api.assessment(attempt!),{enabled:!!attempt})
  const disableGuard=useLeaveGuard(active?.status==='active',work.busy)
  useEffect(()=>{if(previous.data)setActive(previous.data)},[previous.data])
  async function begin(nextRound=round){
    if(!id)return
    const value={deck_id:id,mode,count:Math.max(1,Math.min(100,Number(count)||20)),types,round_index:nextRound},hash=JSON.stringify(value)
    if(!startBody.current||startBody.current.hash!==hash)startBody.current={hash,body:{...value,request_id:flashcardRequestKey()}}
    const next=await api.start(startBody.current.body)
    setActive(next);setLearn(createLearn(next.questions));setAnswers({});setIndex(0);setAnswer('');setFeedback(null);setRound(nextRound);submission.current=null;clock.current=Date.now()
  }
  async function submit(){
    if(!active)return
    if(!submission.current)submission.current={duration_seconds:Math.min(14400,Math.round((Date.now()-clock.current)/1000)),answers:mode==='learn'?learn.responses:Object.entries(answers).map(([question_id,value])=>({question_id,answer:value}))}
    const next=await api.submit(active.id,submission.current)
    setActive(next);await cache.invalidateQueries(['cloud-flashcards',account])
  }
  const q=active?.questions[mode==='learn'?active.questions.findIndex(item=>item.id===learn.queue[0]):index]
  const valid=q&&isStudyAnswerComplete(q,answer)
  function mark(){
    if(!q||!valid||feedback||work.busy||mode==='learn'&&learn.responses.length>=500)return
    if(mode==='learn'){setFeedback({question:q,correct:gradeStudy(q,answer)});setLearn(current=>answerLearn(current,q,answer))}
    else{setAnswers(current=>({...current,[q.id]:answer}));if(index+1<active!.questions.length){setIndex(index+1);setAnswer(answers[active!.questions[index+1].id]??'')}}
  }
  if(!id&&!attempt)return <Screen><Muted>{s('chooseDeck')}</Muted><CloudBack/></Screen>
  if(previous.isLoading&&attempt)return <Loading/>
  if(!active)return <Screen><Title>{s(mode)}</Title><Muted>{s(mode==='learn'?'learnHelp':'testHelp')}</Muted><CloudError error={work.error||previous.error} retry={previous.isError?()=>void previous.refetch():undefined}/>{!attempt&&<>{mode==='test'&&<><Field label={s('questionCount')} value={count} limit={3} onChange={setCount}/>{(['choice','typed','true_false','match']as const).map(type=><CloudToggle key={type} label={s(type)} value={types.includes(type)} onChange={value=>setTypes(current=>value?[...current,type]:current.filter(v=>v!==type))}/>)}</>}<Button title={s('start')} disabled={work.busy||!types.length} onPress={()=>void work.run(()=>begin())}/></>}<CloudBack id={id}/></Screen>
  if(active.status==='completed'&&active.result)return <Screen><Title>{s('summary')}</Title><Card><AppText>{s('result',{...active.result})}</AppText><Muted>{s('scheduleHelp')}</Muted></Card>{active.result.questions.map((row,i)=>{const question=active.questions.find(item=>item.id===row.question_id);return <Card key={i}><AppText>{s(row.correct?'correct':'wrong')}: {question?.prompt||s('match')}</AppText>{question&&<><AppText>{s('yourAnswer')}: {studyAnswerLabel(question,row.answer,s('true'),s('false'))}</AppText><AppText>{s('expected')}: {studyAnswerLabel(question,row.expected,s('true'),s('false'))}</AppText>{!!row.reading&&<Muted>{row.reading}</Muted>}</>}</Card>})}{mode==='learn'&&!attempt&&<Button title={s('nextRound')} disabled={work.busy} onPress={()=>void work.run(async()=>{startBody.current=null;await begin(round+1)})}/>}<Button secondary title={s('statistics')} onPress={()=>{disableGuard();go('stats',active.deck_id)}}/><CloudError error={work.error}/><CloudBack id={active.deck_id}/></Screen>
  const completed=mode==='learn'?active.questions.filter(question=>!learn.queue.includes(question.id)).length:Object.keys(answers).length
  return <Screen><Title>{s(mode)}</Title><Muted>{s('actualCount',{count:active.questions.length})}{mode==='learn'?` · ${s('round',{number:round+1})}`:''}</Muted><Progress current={completed} total={active.questions.length}/><CloudError error={work.error}/>{q&&!feedback&&<Card><Title>{q.prompt||s('matchHelp')}</Title><Muted>{s(q.type)}</Muted><NativeQuestion question={q} answer={answer} onChange={setAnswer}/><Button title={s(mode==='learn'?'check':'recordAnswer')} disabled={!valid||work.busy||mode==='learn'&&learn.responses.length>=500} onPress={mark}/></Card>}
    {feedback&&<Card><Title>{s(feedback.correct?'correct':'wrong')}</Title><AppText>{s('expected')}: {studyAnswerLabel(feedback.question,feedback.question.expected,s('true'),s('false'))}</AppText>{!!feedback.question.reading&&<AppText>{feedback.question.reading}</AppText>}<CloudSpeech speech={speech}/><Button secondary title={f('listen')} disabled={!speech.available||!speech.enabled} onPress={()=>void speech.speak({front:studyAnswerLabel(feedback.question,feedback.question.expected,s('true'),s('false')),back:'',reading:feedback.question.reading||'',note:''})}/><Button title={s('continue')} onPress={()=>{setFeedback(null);setAnswer('')}}/></Card>}
    {mode==='test'?<View style={styles.row}><Button secondary title={s('previous')} disabled={!index||work.busy} onPress={()=>{setIndex(index-1);setAnswer(answers[active.questions[index-1].id]??'')}}/><AppText>{index+1}/{active.questions.length}</AppText><Button title={s('submit')} disabled={Object.keys(answers).length!==active.questions.length||work.busy} onPress={()=>void work.run(submit)}/></View>:<><Muted>{s('remaining',{count:learn.queue.length})}</Muted>{learn.responses.length>=490&&<Muted>{s('roundLimit')}</Muted>}<Button title={s(learn.queue.length?'finishRound':'saveRound')} disabled={!learn.responses.length||work.busy} onPress={()=>void work.run(submit)}/></>}
    <Button secondary title={s('leave')} disabled={work.busy} onPress={()=>void work.run(async()=>{await api.abandon(active.id);disableGuard();go('detail',active.deck_id)})}/>
  </Screen>
}

function NativeQuestion({question:q,answer,onChange}:{question:StudyQuestion;answer:StudyAnswer;onChange:(value:StudyAnswer)=>void}){
  const{s}=useCloudWords()
  if(q.type==='typed')return <Field label={s('answer')} value={typeof answer==='string'?answer:''} limit={2000} onChange={onChange}/>
  if(q.type==='true_false')return <><AppText>{q.candidate}</AppText><View style={styles.row}>{[true,false].map(value=><Button key={String(value)} secondary={answer!==value} selected={answer===value} title={s(value?'true':'false')} onPress={()=>onChange(value)}/>)}</View></>
  if(q.type==='choice')return <>{q.options?.map(option=><Button key={option.id} secondary={answer!==option.id} selected={answer===option.id} title={option.label} onPress={()=>onChange(option.id)}/>)}</>
  const selected=typeof answer==='object'?answer:{}
  return <>{q.targets?.map(target=><CloudSelect key={target.id} label={target.label} value={selected[target.id]||''} options={[{value:'',label:s('choose')},...(q.options||[]).map(o=>({value:o.id,label:o.label}))]} onChange={value=>onChange(matchPair(selected,target.id,value))}/>)}</>
}
