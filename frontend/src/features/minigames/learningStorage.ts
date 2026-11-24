import { emptyProgress,parseProgress,recordProgress,cosmetics,type ArcadeProgress,type GameLearningEvent,type Session,type Mission } from '../../../../shared-games'
export interface LocalReview { event:GameLearningEvent; count:number; pending:boolean }
export interface ArcadeStore { version:1; progress:ArcadeProgress; outbox:GameLearningEvent[]; seen:string[]; reviews:Record<string,LocalReview> }
export const arcadeKey=(account:number)=>`senpaiai.arcade.v1.account:${account}`
export const emptyArcade=():ArcadeStore=>({version:1,progress:emptyProgress(),outbox:[],seen:[],reviews:{}})
export function loadArcade(account:number):{store:ArcadeStore;error:boolean}{
  try{const raw=localStorage.getItem(arcadeKey(account));if(!raw)return{store:emptyArcade(),error:false};const value=JSON.parse(raw)
    if(value.version!==1||!Array.isArray(value.outbox)||!Array.isArray(value.seen)||!value.reviews||typeof value.reviews!=='object'||Array.isArray(value.reviews))throw Error('invalid_arcade')
    parseProgress(value.progress)
    if(!value.outbox.every((e:GameLearningEvent)=>e&&typeof e.event_id==='string'&&typeof e.source_id==='string'&&['wrong','reviewed'].includes(e.action)))throw Error('invalid_outbox')
    if(!value.seen.every((id:unknown)=>typeof id==='string')||!Object.values(value.reviews).every(v=>{const r=v as LocalReview;return r&&r.event&&typeof r.event.source_id==='string'&&Number.isSafeInteger(r.count)&&r.count>=0&&typeof r.pending==='boolean'}))throw Error('invalid_reviews')
    return{store:value,error:false}
  }catch{return{store:emptyArcade(),error:true}}
}
function update(account:number,change:(store:ArcadeStore)=>ArcadeStore):boolean{
  const current=loadArcade(account);if(current.error)return false
  try{const next=change(current.store);if(next===current.store)return true;localStorage.setItem(arcadeKey(account),JSON.stringify(next));if(typeof window!=='undefined')window.dispatchEvent(new Event('arcade-updated'));return true}catch{return false}
}
export function queueLearning(account:number,events:GameLearningEvent[]):boolean{
  return update(account,store=>{
    const seen=new Set(store.seen),added=events.filter(e=>{if(seen.has(e.event_id))return false;seen.add(e.event_id);return true})
    if(!added.length)return store;if(store.outbox.length+added.length>2000)throw Error('outbox_full')
    const reviews={...store.reviews}
    for(const event of added){const key=`${event.source_type}:${event.source_id}`,old=reviews[key];reviews[key]={event,count:(old?.count||0)+(event.action==='wrong'?1:0),pending:event.action==='wrong'}}
    return{...store,reviews,seen:[...seen].slice(-8192),outbox:[...store.outbox,...added]}
  })
}
export const acknowledgeLearning=(account:number,ids:string[])=>update(account,store=>({...store,outbox:store.outbox.filter(e=>!ids.includes(e.event_id))}))
export const saveArcadeRound=(account:number,session:Session,day:string,mission?:Mission)=>update(account,store=>{const progress=recordProgress(store.progress,session,day,mission);return progress===store.progress?store:{...store,progress}})
export const markTutorial=(account:number,game:string)=>update(account,store=>({...store,progress:{...store.progress,tutorials:[...new Set([...store.progress.tutorials,game])]}}))
export const chooseCosmetic=(account:number,cosmetic:string)=>update(account,store=>{if(!cosmetics(store.progress).includes(cosmetic))throw Error('locked');return{...store,progress:{...store.progress,cosmetic}}})
export function clearArcade(account:number){try{localStorage.removeItem(arcadeKey(account));return true}catch{return false}}
