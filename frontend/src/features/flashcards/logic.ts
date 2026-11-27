import type { FlashCard, DeckInput } from '../../services/flashcards'

export const normalize = (value:string)=>value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')
export function validateDeck(value:DeckInput):string|null {
  if(!value.title.trim()||value.title.trim().length>160||value.description.length>2000||value.topic.length>100||value.cards.length>500)return 'invalid'
  const seen=new Set<string>()
  for(const card of value.cards){
    if(!card.front.trim()||!card.back.trim()||card.front.length>1000||card.back.length>2000||card.reading.length>500||card.note.length>2000)return 'invalid'
    const key=JSON.stringify([normalize(card.front),normalize(card.back)])
    if(seen.has(key))return 'duplicateCard'
    seen.add(key)
  }
  return null
}
export function shuffled<T>(items:T[],random= Math.random):T[]{
  const result=[...items]
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result
}
export function studyCards(cards:FlashCard[],starred:boolean,shuffle:boolean,random=Math.random){
  const selected=cards.filter(c=>!starred||c.progress?.starred)
  return shuffle?shuffled(selected,random):[...selected]
}
export function draftKey(account:number,id?:number){return `senpaiai.flashcard.draft.${account}.${id||'new'}`}
export function legacyDecks(storage:Pick<Storage,'getItem'>){
  const saved=storage.getItem('dacs_flashcard_sets')
  const raw=saved!==null?JSON.parse(saved):[{id:'legacy-list',name:'',cards:JSON.parse(storage.getItem('dacs_flashcard_list')||'[]')}]
  if(!Array.isArray(raw))throw Error('invalid')
  return raw.filter(s=>s.cards?.length).map((s,index)=>{
    if(!Array.isArray(s.cards))throw Error('invalid')
    const cards=s.cards.map((c:FlashCard)=>({front:String(c.front??''),back:String(c.back??''),reading:String(c.reading??''),note:String(c.note??'')}))
    const deck={title:String(s.name||s.title||''),description:String(s.description||''),jlpt_level:s.jlpt_level||null,topic:String(s.category||s.topic||''),cards}
    return {...deck,local_id:String(s.id??`legacy-${index}-${JSON.stringify(cards)}`).slice(0,180)}
  })
}
export function reviewSummary(results:Record<number,boolean>){
  const values=Object.values(results),correct=values.filter(Boolean).length
  return{total:values.length,correct,wrong:values.length-correct,accuracy:values.length?Math.round(correct/values.length*100):0}
}
