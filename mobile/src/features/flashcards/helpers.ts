import type { DeckInput, FlashCard } from '../../../../shared-games/flashcard-types'
import type { StudySet } from '../study/types'
import { normalizeStudy } from '../../../../shared-games/flashcard-study'
export const flashcardDraftKey=(account:number,id?:number)=>`senpaiai.cloud-flashcards.draft.${account}.${id||'new'}`
export const flashcardRequestKey=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
export function validateCloudDeck(data:DeckInput){
  if(!data.title.trim()||data.title.length>160||data.description.length>2000||data.topic.length>100||data.cards.length>500)return 'invalid'
  const seen=new Set<string>()
  for(const card of data.cards){
    if(!card.front.trim()||!card.back.trim()||card.front.length>1000||card.back.length>2000||card.reading.length>500||card.note.length>2000)return 'invalid'
    const key=JSON.stringify([normalizeStudy(card.front),normalizeStudy(card.back)])
    if(seen.has(key))return 'duplicateCard'
    seen.add(key)
  }
  return null
}
export function legacyCloudDeck(set:StudySet){return{local_id:set.id,title:set.name,description:'',jlpt_level:set.jlpt_level||null,topic:set.category,cards:set.cards.map(card=>({front:card.front,back:card.back,reading:'',note:''}))}}
export function selectFlipCards(cards:FlashCard[],starred:boolean,shuffle:boolean,random=Math.random){
  const result=cards.filter(c=>!starred||c.progress?.starred)
  if(shuffle)for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result
}
