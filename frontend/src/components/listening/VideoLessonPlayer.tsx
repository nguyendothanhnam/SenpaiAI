import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KanjiText } from '../kanji/KanjiText'
import ListeningExercises from './ListeningExercises'
import type { ListeningLesson } from '../../services/api'
import { ArrowLeft, Headphones, Pause, Play, Repeat1 } from 'lucide-react'
import { ListeningToggle, ListeningTranscriptRow } from './ListeningUI'
import { listeningTimestamp } from '../../utils/listeningPresentation'

type Player = { destroy(): void; seekTo(time:number, allow:boolean):void; playVideo():void; pauseVideo():void; getCurrentTime():number; getDuration():number; getAvailablePlaybackRates():number[]; setPlaybackRate(rate:number):void; getPlaybackRate():number }
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
  const [playing, setPlaying] = useState(false), [videoDuration, setVideoDuration] = useState(0)
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
        onReady: () => { if (cancelled) return; setReady(true); setRates(player.current?.getAvailablePlaybackRates() || [1]); setVideoDuration(player.current?.getDuration?.() || 0) },
        onError: () => { if (!cancelled) setFailed(true) },
        onPlaybackRateChange: () => { if (!cancelled) setRate(player.current?.getPlaybackRate() || 1) },
        onStateChange: (event: { data: number }) => { if (!cancelled) { setPlaying(event.data === 1); setVideoDuration(player.current?.getDuration?.() || 0) } },
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
  const timelineDuration = videoDuration || lesson.duration_ms / 1000
  return <section className="listening-module mx-auto max-w-5xl space-y-5 px-4 py-6">
    <header className="listening-glass space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><Link to="/listening" className="listening-secondary"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('listening.backToList')}</Link>{activity === 'listen' && <div className="flex flex-wrap gap-2"><ListeningToggle checked={furigana} onChange={setFurigana}>{t('listening.ui.furiganaToggle')}</ListeningToggle><ListeningToggle checked={showVi} onChange={setShowVi}>{t('listening.ui.vietnameseToggle')}</ListeningToggle></div>}</div><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--listening-accent-text)]"><Headphones className="h-6 w-6" aria-hidden="true" /></span><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="listening-badge">{lesson.jlpt_level}</span><span className="listening-badge">{t('listening.ui.sources.video')}</span></div><h1 className="mt-2 break-words text-xl font-bold leading-8 sm:text-2xl">{lesson.title}</h1></div></div></header>
    <div className="listening-glass inline-flex flex-wrap gap-1 p-1" role="group" aria-label={t('listening.exercises.chooseActivity')}><button type="button" className={`listening-tab ${activity === 'listen' ? 'is-active' : ''}`} aria-pressed={activity === 'listen'} onClick={()=>setActivity('listen')}>{t('listening.exercises.listenRead')}</button><button type="button" className={`listening-tab ${activity === 'exercises' ? 'is-active' : ''}`} aria-pressed={activity === 'exercises'} onClick={()=>setActivity('exercises')}>{t('listening.exercises.title')}</button></div>
    <section className="listening-glass space-y-4 p-4 sm:p-6" aria-label={t('listening.audioSectionTitle')}>
      <div className="listening-player-frame relative mx-auto aspect-video min-h-[200px] w-full max-w-3xl overflow-hidden rounded-xl bg-slate-950"><div id={`youtube-${generated}`} ref={container} className="aspect-video min-h-[200px] w-full" /></div>
      {failed && <p role="alert" className="listening-notice">{t('videoLesson.playerError')}</p>}{!ready && !failed && <p role="status" className="listening-notice">{t('videoLesson.playerLoading')}</p>}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3 sm:gap-4">
        <button type="button" className="listening-action !h-12 !w-12 !rounded-full !p-0" disabled={!ready || failed} aria-label={t(playing ? 'listening.pause' : 'listening.play')} onClick={() => { if (playing) player.current?.pauseVideo(); else player.current?.playVideo() }}>{playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}</button>
        <div className="min-w-0 flex-1 space-y-1.5"><input aria-label={t('listening.audioProgress')} type="range" min={0} max={timelineDuration || 1} step="0.1" value={Math.min(current, timelineDuration || 0)} disabled={!ready || failed} className="w-full cursor-pointer accent-[color:var(--primary)]" onChange={event => { const value = Number(event.target.value); player.current?.seekTo(value, true); setCurrent(value) }} /><div className="flex justify-between text-xs tabular-nums text-[color:var(--text-muted)]"><span>{listeningTimestamp(current)}</span><span>{listeningTimestamp(timelineDuration)}</span></div></div>
        <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.speed')}<select className="listening-input w-24" value={rate} disabled={!ready} onChange={e=>player.current?.setPlaybackRate(Number(e.target.value))}>{rates.map(v=><option value={v} key={v}>{v}x</option>)}</select></label>
      </div>
      {activity === 'listen' && <div className="flex flex-wrap gap-2"><ListeningToggle checked={showJa} onChange={setShowJa}>{t('listening.japanese')}</ListeningToggle><ListeningToggle checked={repeat} onChange={setRepeat}><Repeat1 className="h-4 w-4" aria-hidden="true" />{t('listening.repeatSentence')}</ListeningToggle></div>}
      <p className="listening-notice">{t('videoLesson.rights')}</p><div className="flex flex-wrap items-center gap-3">{lesson.video_url && <a href={lesson.video_url} target="_blank" rel="noreferrer" className="listening-secondary">{t('videoLesson.source')}</a>}{lesson.source_note && <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-[color:var(--text-muted)]">{lesson.source_note}</p>}</div>
    </section>
    <div hidden={activity !== 'exercises'}><ListeningExercises lessonId={lesson.id} active={activity==='exercises'} audioReady={ready && !failed} onPlaySegment={index=>seek(index,true)} /></div>
    {activity==='listen' && <section className="listening-glass space-y-4 p-4 sm:p-6"><header><h2 className="text-base font-bold">{t('listening.ui.transcript')}</h2><p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{t('listening.ui.transcriptHint')}</p></header><div className="space-y-3">
      {segments.map((segment,index)=><ListeningTranscriptRow key={index} number={index+1} startMs={segment.start_ms ?? 0} active={index === active} disabled={!ready || failed} onReplay={()=>seek(index)} controls={<><button type="button" className={`listening-toggle !min-h-9 !px-2.5 !text-xs ${loopA === index ? 'is-active' : ''}`} onClick={()=>setLoopA(loopA===index?null:index)} aria-pressed={loopA===index}>{t('listening.loopFromA')}</button><button type="button" className={`listening-toggle !min-h-9 !px-2.5 !text-xs ${loopB === index ? 'is-active' : ''}`} onClick={()=>setLoopB(loopB===index?null:index)} aria-pressed={loopB===index}>{t('listening.toB')}</button></>}>
        {showJa && <p lang="ja" className="listening-japanese break-words text-lg leading-9">{furigana && segment.tokens?.length ? segment.tokens.map((token,n)=>token.reading && token.reading!==token.text?<ruby key={n}><KanjiText text={token.text}/><rt className="text-xs text-[color:var(--text-muted)]">{token.reading}</rt></ruby>:<KanjiText key={n} text={token.text}/>):<KanjiText text={segment.ja}/>}</p>}{showVi && segment.vi && <p className="text-sm leading-7 text-[color:var(--text-muted)]">{segment.vi}</p>}</ListeningTranscriptRow>)}
    </div></section>}
  </section>
}
