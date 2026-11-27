import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KanjiText } from '../kanji/KanjiText'
import ListeningExercises from './ListeningExercises'
import type { ListeningLesson } from '../../services/api'

type Player = { destroy(): void; seekTo(time:number, allow:boolean):void; playVideo():void; pauseVideo():void; getCurrentTime():number; getAvailablePlaybackRates():number[]; setPlaybackRate(rate:number):void; getPlaybackRate():number }
type Youtube = { Player: new (element: HTMLElement, options: object) => Player }
declare global { interface Window { YT?: Youtube; onYouTubeIframeAPIReady?: () => void } }
let youtubeLoader: Promise<Youtube> | undefined
function loadYoutube(): Promise<Youtube> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeLoader) return youtubeLoader
  youtubeLoader = new Promise<Youtube>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timeout = window.setTimeout(() => reject(new Error('timeout')), 15000)
    window.onYouTubeIframeAPIReady = () => { previous?.(); window.clearTimeout(timeout); if(window.YT?.Player) resolve(window.YT); else reject(new Error('unavailable')) }
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('unavailable')) }
    document.head.append(script)
  }).catch(error => { youtubeLoader = undefined; throw error })
  return youtubeLoader!
}

export default function VideoLessonPlayer({ lesson }: { lesson: ListeningLesson }) {
  const { t } = useTranslation('common')
  const container = useRef<HTMLDivElement>(null), player = useRef<Player | null>(null), generated = useId().replace(/:/g,'')
  const [ready,setReady] = useState(false), [failed,setFailed] = useState(false), [current,setCurrent] = useState(0)
  const [activity,setActivity] = useState<'listen'|'exercises'>('listen'), [showJa,setShowJa] = useState(true), [showVi,setShowVi] = useState(true), [furigana,setFurigana] = useState(true)
  const [repeat,setRepeat] = useState(false), [loopA,setLoopA] = useState<number|null>(null), [loopB,setLoopB] = useState<number|null>(null), [rates,setRates] = useState<number[]>([1]), [rate,setRate] = useState(1)
  const repeatRef = useRef({repeat,loopA,loopB}); repeatRef.current = {repeat,loopA,loopB}
  const clipEnd = useRef<number | null>(null)
  const segments = lesson.segments
  const active = Math.max(0, segments.findIndex(row => current*1000 >= (row.start_ms ?? 0) && current*1000 < (row.end_ms ?? 0)))
  const activeRef = useRef(active); activeRef.current = active
  useEffect(() => {
    let cancelled = false, timer = 0
    if (!lesson.video_id || !/^[A-Za-z0-9_-]{11}$/.test(lesson.video_id) || lesson.video_provider !== 'youtube') { setFailed(true); return }
    void loadYoutube().then(YT => {
      if (cancelled || !container.current) return
      player.current = new YT.Player(container.current, {videoId:lesson.video_id, playerVars:{origin:window.location.origin, playsinline:1}, events:{
        onReady: () => { if (cancelled) return; setReady(true); setRates(player.current?.getAvailablePlaybackRates() || [1]) },
        onError: () => { if (!cancelled) setFailed(true) },
        onPlaybackRateChange: () => { if (!cancelled) setRate(player.current?.getPlaybackRate() || 1) },
      }})
      timer = window.setInterval(() => {
        const instance = player.current
        if (!instance?.getCurrentTime) return
        const time = instance.getCurrentTime(); if (!Number.isFinite(time)) return
        const settings = repeatRef.current, a = settings.loopA, b = settings.loopB
        if (clipEnd.current !== null && time >= clipEnd.current) { instance.pauseVideo(); clipEnd.current = null }
        else if (a !== null && b !== null && b >= a && time*1000 >= (segments[b]?.end_ms ?? Infinity)) instance.seekTo((segments[a].start_ms ?? 0)/1000, true)
        else if (settings.repeat && time*1000 >= (segments[activeRef.current]?.end_ms ?? Infinity)) instance.seekTo((segments[activeRef.current].start_ms ?? 0)/1000, true)
        setCurrent(time)
      }, 250)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; window.clearInterval(timer); player.current?.destroy(); player.current = null }
  }, [lesson.video_id, lesson.video_provider, segments])
  const seek = (index:number, sentenceOnly=false) => { const item=segments[index]; if(!ready || !item) return; clipEnd.current = sentenceOnly ? (item.end_ms ?? 0)/1000 : null; setCurrent((item.start_ms ?? 0)/1000); player.current?.seekTo((item.start_ms ?? 0)/1000,true); player.current?.playVideo() }
  return <section className="space-y-4 text-[color:var(--text)]"><Link to="/listening" className="underline text-[color:var(--primary)]">{t('listening.backToList')}</Link><h1 className="text-2xl font-bold">{lesson.title}</h1>
    <p>{t('videoLesson.rights')}</p>{lesson.video_url && <a href={lesson.video_url} target="_blank" rel="noreferrer" className="underline text-[color:var(--primary)]">{t('videoLesson.source')}</a>}{lesson.source_note && <p className="whitespace-pre-wrap break-words">{lesson.source_note}</p>}
    <div className="mx-auto w-full max-w-3xl" style={{minHeight:200}}><div id={`youtube-${generated}`} ref={container} className="aspect-video min-h-[200px] w-full" /></div>
    {failed && <p role="alert">{t('videoLesson.playerError')}</p>}{!ready && !failed && <p role="status">{t('videoLesson.playerLoading')}</p>}
    <div className="flex flex-wrap gap-3"><button className="btn btn-outline" onClick={()=>setActivity('listen')}>{t('listening.exercises.listenRead')}</button><button className="btn btn-outline" onClick={()=>setActivity('exercises')}>{t('listening.exercises.title')}</button><label>{t('listening.speed')} <select className="input" value={rate} disabled={!ready} onChange={e=>player.current?.setPlaybackRate(Number(e.target.value))}>{rates.map(v=><option value={v} key={v}>{v}x</option>)}</select></label></div>
    <div hidden={activity !== 'exercises'}><ListeningExercises lessonId={lesson.id} active={activity==='exercises'} audioReady={ready && !failed} onPlaySegment={index=>seek(index,true)} /></div>
    {activity==='listen' && <><div className="flex flex-wrap gap-3"><label><input type="checkbox" checked={showJa} onChange={e=>setShowJa(e.target.checked)}/> {t('listening.japanese')}</label><label><input type="checkbox" checked={furigana} onChange={e=>setFurigana(e.target.checked)}/> {t('videoLesson.furigana')}</label><label><input type="checkbox" checked={showVi} onChange={e=>setShowVi(e.target.checked)}/> {t('listening.vietnamese')}</label><label><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> {t('listening.repeatSentence')}</label></div>
      {segments.map((segment,index)=><article key={index} className={`theme-card space-y-2 p-4 ${index===active?'ring-2 ring-[color:var(--primary)]':''}`}><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-outline" disabled={!ready} onClick={()=>seek(index)}>{t('listening.listenSentence')} {index+1}</button><button type="button" className="btn btn-outline" onClick={()=>setLoopA(loopA===index?null:index)} aria-pressed={loopA===index}>{t('listening.loopFromA')}</button><button type="button" className="btn btn-outline" onClick={()=>setLoopB(loopB===index?null:index)} aria-pressed={loopB===index}>{t('listening.toB')}</button></div>
        {showJa && <p lang="ja" className="text-lg">{furigana && segment.tokens?.length ? segment.tokens.map((token,n)=>token.reading && token.reading!==token.text?<ruby key={n}><KanjiText text={token.text}/><rt>{token.reading}</rt></ruby>:<KanjiText key={n} text={token.text}/>):<KanjiText text={segment.ja}/>}</p>}{showVi && segment.vi && <p>{segment.vi}</p>}</article>)}
    </>}
  </section>
}
