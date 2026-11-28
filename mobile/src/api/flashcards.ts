import { api } from './services'
import type { Assessment, AssessmentPayload, AssessmentSubmission, Deck, DeckInput, DeckStats, FlashCard, HistoryItem, ReviewPayload, TextPreview } from '../../../shared-games/flashcard-types'
export const flashcardsAPI={
  list:async(params:Record<string,string|number>={})=>(await api.get<{items:Deck[];total:number}>('/flashcards',{params:{limit:100,...params}})).data,
  detail:async(id:number)=>(await api.get<Deck>(`/flashcards/${id}`)).data,
  save:async(id:number|undefined,body:DeckInput)=>(await(id?api.put<Deck>(`/flashcards/${id}`,body):api.post<Deck>('/flashcards',body))).data,
  remove:async(id:number)=>api.delete(`/flashcards/${id}`),
  duplicate:async(id:number)=>(await api.post<Deck>(`/flashcards/${id}/duplicate`)).data,
  star:async(deck:number,card:number,starred:boolean)=>api.put(`/flashcards/${deck}/cards/${card}/star`,{starred}),
  queue:async(starred=false)=>(await api.get<{items:FlashCard[];total:number}>('/flashcards/queue',{params:{limit:500,starred}})).data,
  stats:async(deck_id?:number)=>(await api.get<DeckStats>('/flashcards/stats',{params:{deck_id}})).data,
  preview:async(text:string,field_separator:string,card_separator:string)=>(await api.post<TextPreview>('/flashcards/import/preview',{text,field_separator,card_separator})).data,
  importFile:async(file:{uri:string;name:string;size:number;mimeType?:string})=>{const body=new FormData();body.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as unknown as Blob);return(await api.post<{cards:FlashCard[]}>('/game/flashcard/import',body,{timeout:45000,headers:{'Content-Type':'multipart/form-data'}})).data},
  transfer:async(decks:unknown[])=>api.post('/flashcards/transfer',{confirmed:true,source:'mobile',decks}),
  review:async(body:ReviewPayload)=>api.post('/flashcards/reviews',body),
  start:async(body:AssessmentPayload)=>(await api.post<Assessment>('/flashcards/assessments',body)).data,
  submit:async(id:string,body:AssessmentSubmission)=>(await api.post<Assessment>(`/flashcards/assessments/${id}/submit`,body)).data,
  assessment:async(id:string)=>(await api.get<Assessment>(`/flashcards/assessments/${id}`)).data,
  abandon:async(id:string)=>api.delete(`/flashcards/assessments/${id}`),
  history:async(deck_id?:number,offset=0)=>(await api.get<{items:HistoryItem[];total:number}>('/flashcards/sessions',{params:{deck_id,offset,limit:20}})).data,
}
