import kanaData from './flashcard-kana.json'
export type StudyMode='learn'|'test'
export type QuestionType='choice'|'typed'|'true_false'|'match'
export interface StudyQuestion {id:string;type:QuestionType;prompt:string;options?:{id:string;label:string}[];targets?:{id:string;label:string}[];candidate?:string;expected?:string|boolean|Record<string,string>;accepted?:string[];reading?:string}
export type StudyAnswer=string|boolean|Record<string,string>
export interface StudyResponse {question_id:string;answer:StudyAnswer}
export const normalizeStudy=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')
export const hiraganaStudy=(value:string)=>normalizeStudy(value).replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
const kana=Object.fromEntries(kanaData.kana.split(' ').map((c,i)=>[c,kanaData.romaji.split(' ')[i]]))
export function kanaRomaji(value:string){
  const text=hiraganaStudy(value);let result='',double=false
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='っ'){double=true;continue}
    if(c==='ー'){result+=(result.match(/[aeiou](?!.*[aeiou])/)||[''])[0];continue}
    const pair=text.slice(i,i+2),digraph=(kanaData.digraphs as Record<string,string>)[pair]
    const part=digraph||kana[c]||c;if(digraph)i++
    if(double){result+=part[0]==='c'?'t':part[0];double=false}
    result+=part
  }
  return result
}
function roman(value:string){return normalizeStudy(value).replace(/ā/g,'aa').replace(/ī/g,'ii').replace(/ū/g,'uu').replace(/ē/g,'ee').replace(/ō/g,'ou').replace(/['’\s]/g,'').replace(/sya/g,'sha').replace(/syu/g,'shu').replace(/syo/g,'sho').replace(/tya/g,'cha').replace(/tyu/g,'chu').replace(/tyo/g,'cho').replace(/jya/g,'ja').replace(/jyu/g,'ju').replace(/jyo/g,'jo').replace(/si/g,'shi').replace(/(^|[^s])ti/g,'$1chi').replace(/tu/g,'tsu').replace(/hu/g,'fu').replace(/zi/g,'ji').replace(/ou/g,'oo')}
export function acceptsStudy(answer:string,accepted:string[]){
  const value=hiraganaStudy(answer)
  return accepted.some(expected=>value===hiraganaStudy(expected)||(/^[ぁ-ゖー\s]+$/u.test(hiraganaStudy(expected))&&roman(answer)===roman(kanaRomaji(expected))))
}
export function gradeStudy(question:StudyQuestion,answer:StudyAnswer){
  if(question.type==='typed')return typeof answer==='string'&&acceptsStudy(answer,question.accepted||[])
  if(question.type==='match')return typeof answer==='object'&&Object.keys(answer).length===question.targets?.length&&question.targets?.every(t=>answer[t.id]===(question.expected as Record<string,string>)?.[t.id])===true
  return answer===question.expected
}
export function isStudyAnswerComplete(question:StudyQuestion,answer:StudyAnswer){
  if(question.type==='typed')return typeof answer==='string'&&!!answer.trim()
  if(question.type==='true_false')return typeof answer==='boolean'
  if(question.type==='choice')return typeof answer==='string'&&question.options?.some(o=>o.id===answer)===true
  if(typeof answer!=='object'||Object.keys(answer).length!==question.targets?.length)return false
  return new Set(Object.values(answer)).size===question.targets.length&&question.targets.every(t=>question.options?.some(o=>o.id===answer[t.id]))
}
export interface LearnState {queue:string[];responses:StudyResponse[];visits:Record<string,number>;round:number}
export function createLearn(questions:StudyQuestion[]):LearnState{return{queue:questions.map(q=>q.id),responses:[],visits:{},round:1}}
export function answerLearn(state:LearnState,question:StudyQuestion,answer:StudyAnswer):LearnState{
  if(state.queue[0]!==question.id)return state
  const queue=state.queue.slice(1),correct=gradeStudy(question,answer)
  // Wrong cards wait behind the remaining cards; they are never repeated immediately when other work exists.
  if(!correct)queue.push(question.id)
  return{...state,queue,responses:[...state.responses,{question_id:question.id,answer}],visits:{...state.visits,[question.id]:(state.visits[question.id]||0)+1}}
}
export function matchPair(answer:Record<string,string>,target:string,option:string){
  return{...Object.fromEntries(Object.entries(answer).filter(([key,value])=>key!==target&&value!==option)),[target]:option}
}
export function studyAnswerLabel(q:StudyQuestion,value:unknown,trueLabel:string,falseLabel:string){
  if(q.type==='true_false')return value===true?trueLabel:falseLabel
  if(q.type==='choice')return q.options?.find(o=>o.id===value)?.label||String(value??'')
  if(q.type==='match'&&value&&typeof value==='object')return(q.targets||[]).map(t=>`${t.label} → ${q.options?.find(o=>o.id===(value as Record<string,string>)[t.id])?.label||'—'}`).join('; ')
  return String(value??'')
}
