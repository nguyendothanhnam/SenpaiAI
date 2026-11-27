import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { appGameDay,dailyChallenge,LEVELS,playerLevel,playStreak,kanjiFor,wordsFor,type Level,type GameLearningEvent,GAMES,availability } from '../../../../shared-games'
import { useAuth } from '../../services/auth'
import { loadArcade,queueLearning } from '../../features/minigames/learningStorage'
import { minigameLearningAPI,syncArcade,type GameReviewItem } from '../../services/minigameLearning'
import { learningAPI } from '../../services/learning'
import './minigames.css'

export default function ArcadeDashboard(){
  const {t}=useTranslation('common'),{user}=useAuth(),cache=useQueryClient(),[params]=useSearchParams()
  const [local,setLocal]=useState(()=>loadArcade(user!.id)),[syncError,setSyncError]=useState(false),[offset,setOffset]=useState(0)
  const [showReview,setShowReview]=useState(params.get('review')==='1'),[revealed,setRevealed]=useState<string|null>(null)
  const review=useQuery(['gameReview',user!.id,offset],()=>minigameLearningAPI.review(offset),{enabled:showReview,retry:false})
  const overview=useQuery(['learning',user!.id,'overview'],learningAPI.overview,{staleTime:60000,retry:false})
  const level=LEVELS.includes(user!.current_jlpt_level as Level)?user!.current_jlpt_level as Level:'N5',today=appGameDay(Date.now()),daily=dailyChallenge(today,level),progress=local.store.progress
  useEffect(()=>{
    const read=()=>setLocal(loadArcade(user!.id))
    const sync=()=>{void syncArcade(user!.id).then(count=>{setSyncError(false);read();if(count){void cache.invalidateQueries(['gameReview',user!.id]);void cache.invalidateQueries(['learning',user!.id])}}).catch(()=>{setSyncError(true);read()})}
    read();sync();window.addEventListener('arcade-updated',read);window.addEventListener('online',sync);window.addEventListener('storage',read)
    return()=>{window.removeEventListener('arcade-updated',read);window.removeEventListener('online',sync);window.removeEventListener('storage',read)}
  },[user,cache])
  const pendingLocal=Object.values(local.store.reviews).filter(r=>r.pending&&(review.isError||!review.data||local.store.outbox.some(e=>e.event_id===r.event.event_id)))
  const merged=new Map<string,GameReviewItem>()
  for(const item of review.data?.items||[])if(!local.store.outbox.some(e=>e.action==='reviewed'&&e.source_type===item.kind&&e.source_id===item.id))merged.set(`${item.kind}:${item.id}`,item)
  for(const row of pendingLocal){const event=row.event,word=wordsFor(event.level).find(w=>w.id===event.source_id),kanji=kanjiFor(event.level).find(k=>k.id===event.source_id)
    const item:GameReviewItem={id:event.source_id,kind:event.source_type,label:word?.word||kanji?.id||event.source_id,reading:word?.reading||kanji?.readings[0]||(event.source_type==='kana'?event.source_id:''),meaning:word?.meaning||kanji?.meaning||'',level:event.level,wrong_count:row.count,last_wrong_at:''}
    if(!merged.has(`${item.kind}:${item.id}`))merged.set(`${item.kind}:${item.id}`,item)
  }
  const acknowledge=(item:GameReviewItem,remembered:boolean)=>{
    const event:GameLearningEvent={event_id:crypto.randomUUID(),game:'review',level:LEVELS.includes(item.level as Level)?item.level as Level:level,source_type:item.kind,source_id:item.id,action:remembered?'reviewed':'wrong',answer:remembered?item.reading:''}
    if(!queueLearning(user!.id,[event])){setLocal({...local,error:true});return}
    setLocal(loadArcade(user!.id));setRevealed(null)
    void syncArcade(user!.id).then(()=>{setSyncError(false);setLocal(loadArcade(user!.id));void cache.invalidateQueries(['gameReview',user!.id]);void cache.invalidateQueries(['learning',user!.id])}).catch(()=>setSyncError(true))
  }
  const weak=overview.data?(['kanji','vocab'] as const).filter(s=>overview.data!.skills[s].evidence==='sufficient').sort((a,b)=>(overview.data!.skills[a].score||0)-(overview.data!.skills[b].score||0))[0]:undefined
  const suggested=GAMES.filter(g=>availability(g,level).enabled&&(!weak||(weak==='kanji'?['falling','missing','workshop'].includes(g):['cipher','battle','shiritori','wordsearch','ninja'].includes(g)))).slice(0,3)
  return <section className="my-6 space-y-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-6" aria-label={t('arcadeLearning.title')}>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold">{t('arcadeLearning.title')}</h2><p className="mt-2 font-semibold text-[color:var(--primary)]">{t('arcadeLearning.player',{level:playerLevel(progress.xp).level,xp:progress.xp})}</p><p className="text-sm">{t('arcadeLearning.streak',{count:playStreak(progress.days,today)})}</p></div><button className="mg-btn" onClick={()=>setShowReview(v=>!v)} aria-expanded={showReview}>{t('arcadeLearning.review')}</button></div>
    <p className="text-xs text-[color:var(--text-muted)]">{t('arcadeLearning.separateXp')}</p>
    <div className="flex flex-wrap gap-2">{progress.badges.map(b=><span key={b} className="rounded-full bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-[color:var(--primary)]">{t(`arcadeLearning.badges.${b}`)}</span>)}</div>
    {daily&&<div className="rounded-2xl bg-[color:var(--accent)] p-4"><h3 className="font-bold">{t('arcadeLearning.modes.daily')} · {today}</h3><p className="my-2 text-sm">{t('arcadeLearning.dailyRules',{game:t(`minigames.games.${daily.game}.name`),level:daily.level,seconds:45})}</p>{progress.dailyWins.includes(today)&&<p>{t('arcadeLearning.dailyDone')}</p>}<Link className="mg-btn" to={`/games/${daily.game}?level=${daily.level}&challenge=${today}`}>{t('arcadeLearning.openDaily')}</Link></div>}
    <div><h3 className="font-bold">{t(weak?'arcadeLearning.weakSuggestion':'arcadeLearning.practiceSuggestion',{skill:weak?t(`learning.skills.${weak}`):''})}</h3><div className="mt-2 flex flex-wrap gap-2">{suggested.map(g=><Link className="mg-btn" key={g} to={`/games/${g}?level=${level}`}>{t(`minigames.games.${g}.name`)}</Link>)}</div></div>
    {(syncError||local.error||local.store.outbox.length>0)&&<p role="status" className="text-sm">{t(local.error?'arcadeLearning.localError':'arcadeLearning.pending',{count:local.store.outbox.length})} <button className="underline" onClick={()=>{void syncArcade(user!.id).then(()=>{setSyncError(false);setLocal(loadArcade(user!.id));void review.refetch()}).catch(()=>setSyncError(true))}}>{t('arcadeLearning.sync')}</button></p>}
    {showReview&&<div className="space-y-3 border-t border-[color:var(--border)] pt-4"><h3 className="font-bold">{t('arcadeLearning.review')}</h3><p className="text-sm text-[color:var(--text-muted)]">{t('arcadeLearning.reviewNotice')}</p>{review.isLoading&&<p role="status">{t('arcadeLearning.loading')}</p>}{review.isError&&<p role="alert">{t('arcadeLearning.offlineReview')}</p>}{!merged.size&&!review.isLoading&&<p>{t('arcadeLearning.noReview')}</p>}{[...merged.values()].map(item=>{
      const key=`${item.kind}:${item.id}`
      return <article key={key} className="rounded-2xl border border-[color:var(--border)] p-4"><p className="japanese-text text-2xl font-bold">{item.kind==='mechanic'?t('arcadeLearning.mechanic'):item.label}</p><p className="text-xs">{t('arcadeLearning.wrongCount',{count:item.wrong_count})}{item.level&&` · ${item.level}`}</p>{revealed===key?<><p className="my-3 japanese-text">{item.reading} {item.meaning&&`· ${item.meaning}`}</p><div className="flex flex-wrap gap-2"><button className="mg-btn" onClick={()=>acknowledge(item,false)}>{t('arcadeLearning.again')}</button><button className="mg-btn" onClick={()=>acknowledge(item,true)}>{t('arcadeLearning.remembered')}</button></div></>:<button className="mg-btn mt-3" onClick={()=>setRevealed(key)}>{t('arcadeLearning.reveal')}</button>}</article>
    })}<div className="flex gap-3"><button className="mg-btn" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-30))}>{t('arcadeLearning.previous')}</button><button className="mg-btn" disabled={!review.data?.has_more} onClick={()=>setOffset(offset+30)}>{t('arcadeLearning.next')}</button></div></div>}
  </section>
}
