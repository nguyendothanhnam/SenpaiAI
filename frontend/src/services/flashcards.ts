import { api } from './api'

export type { CardProgress, FlashCard, DeckStats, Deck, DeckInput, ReviewPayload, TextPreview } from '../../../shared-games/flashcard-types'
import type { Deck, DeckInput, FlashCard, DeckStats, ReviewPayload, TextPreview, Assessment, AssessmentPayload, AssessmentSubmission, HistoryItem } from '../../../shared-games/flashcard-types'
export const flashcardsAPI = {
  start: async(body:AssessmentPayload)=>(await api.post<Assessment>('/flashcards/assessments',body)).data,
  submit: async(id:string,body:AssessmentSubmission)=>(await api.post<Assessment>(`/flashcards/assessments/${id}/submit`,body)).data,
  assessment: async(id:string)=>(await api.get<Assessment>(`/flashcards/assessments/${id}`)).data,
  abandon: async(id:string)=>api.delete(`/flashcards/assessments/${id}`),
  history: async(deck_id?:number,offset=0)=>(await api.get<{items:HistoryItem[];total:number}>('/flashcards/sessions',{params:{deck_id,offset,limit:20}})).data,
  deckStats: async(deck_id?:number)=>(await api.get<DeckStats>('/flashcards/stats',{params:{deck_id}})).data,

  importFile: async(file:File)=>{const body=new FormData();body.append('file',file);return(await api.post<{cards:FlashCard[]}>('/game/flashcard/import',body)).data},
  list: async(params:Record<string,string|number>)=>(await api.get<{items:Deck[];total:number}>('/flashcards',{params})).data,
  detail: async(id:number)=>(await api.get<Deck>(`/flashcards/${id}`)).data,
  save: async(id:number|undefined,body:DeckInput)=>(await (id?api.put<Deck>(`/flashcards/${id}`,body):api.post<Deck>('/flashcards',body))).data,
  remove: async(id:number)=>api.delete(`/flashcards/${id}`),
  duplicate: async(id:number)=>(await api.post<Deck>(`/flashcards/${id}/duplicate`)).data,
  star: async(deck:number,card:number,starred:boolean)=>api.put(`/flashcards/${deck}/cards/${card}/star`,{starred}),
  queue: async(params:{deck_id?:number;starred?:boolean;limit?:number})=>(await api.get<{items:FlashCard[];total:number;limit:number}>('/flashcards/queue',{params})).data,
  stats: async()=>(await api.get<DeckStats>('/flashcards/stats')).data,
  preview: async(text:string,field_separator:string,card_separator:string)=>(await api.post<TextPreview>('/flashcards/import/preview',{text,field_separator,card_separator})).data,
  transfer: async(decks:unknown[])=>(await api.post('/flashcards/transfer',{confirmed:true,source:'web',decks})).data,
  quick: async(body:{title:string;source:string;level:string;group:number})=>(await api.post<Deck>('/flashcards/quick-create',body)).data,
  review: async(body:ReviewPayload)=>(await api.post('/flashcards/reviews',body)).data,
  export: async(id:number,format:string)=>(await api.get<Blob>(`/flashcards/${id}/export`,{params:{format},responseType:'blob'})).data,
}
