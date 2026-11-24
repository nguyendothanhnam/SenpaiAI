import { api } from './api'
import { loadArcade,acknowledgeLearning } from '../features/minigames/learningStorage'
import type { GameLearningEvent, ReviewKind } from '../../../shared-games'
export interface GameReviewItem { id:string;kind:ReviewKind;label:string;reading:string;meaning:string;level:string|null;wrong_count:number;last_wrong_at:string }
export interface ReviewPage {items:GameReviewItem[];total:number;offset:number;has_more:boolean}
export const minigameLearningAPI={
  review:(offset=0)=>api.get<ReviewPage>('/minigames/review',{params:{offset,limit:30}}).then(r=>r.data),
  sync:(events:GameLearningEvent[])=>api.post<{acknowledged:string[]}>('/minigames/learning-events',{events}).then(r=>r.data),
}
const syncing=new Map<number,Promise<number>>()
export function syncArcade(account:number):Promise<number>{
  const active=syncing.get(account);if(active)return active
  const promise=(async()=>{let count=0
    for(let batch=0;batch<20;batch++){
      const local=loadArcade(account);if(local.error)throw Error('local_storage_error')
      const events=local.store.outbox.slice(0,100);if(!events.length)return count
      const data=await minigameLearningAPI.sync(events)
      if(!acknowledgeLearning(account,data.acknowledged))throw Error('ack_storage_error')
      count+=data.acknowledged.length
    }return count
  })().finally(()=>syncing.delete(account))
  syncing.set(account,promise);return promise
}
