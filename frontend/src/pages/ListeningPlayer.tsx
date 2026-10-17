import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Headphones, Pause, Play, Repeat1, SkipBack, SkipForward } from 'lucide-react'
import { useQuery } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { listeningAPI } from '../services/api'

export default function ListeningPlayer() {
  const { t } = useTranslation('common')
  const { id: rawId } = useParams<{ id: string }>()
  const id = Number(rawId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showJapanese, setShowJapanese] = useState(true)
  const [showFurigana, setShowFurigana] = useState(true)
  const [showVietnamese, setShowVietnamese] = useState(true)
  const [repeatSegment, setRepeatSegment] = useState(false)
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const lessonQuery = useQuery(['listening-lesson', id], () => listeningAPI.getLesson(id).then(({ data }) => data), { enabled: Number.isFinite(id) && id > 0, retry: 1 })
  const lesson = lessonQuery.data

  useEffect(() => {
    let objectUrl = ''
    let active = true
    if (lesson) listeningAPI.getAudio(id).then(({ data }) => {
      if (!active) return
      objectUrl = URL.createObjectURL(data)
      setAudioUrl(objectUrl)
      // Audio generation also writes the authoritative per-sentence timestamps.
      void lessonQuery.refetch()
    }).catch(() => toast.error(t('listening.audioLoadError')))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setAudioUrl('') }
  }, [id, Boolean(lesson)]) // eslint-disable-line react-hooks/exhaustive-deps

  const segments = lesson?.segments ?? []
  const activeIndex = useMemo(() => {
    const index = segments.findIndex((segment) => currentTime * 1000 >= (segment.start_ms ?? 0) && currentTime * 1000 < (segment.end_ms ?? Number.MAX_SAFE_INTEGER))
    return index < 0 ? 0 : index
  }, [segments, currentTime])
  const seekTo = (index: number) => {
    const segment = segments[index]
    if (!segment || !audioRef.current) return
    audioRef.current.currentTime = (segment.start_ms ?? 0) / 1000
    void audioRef.current.play().then(() => setPlaying(true)).catch(() => undefined)
  }
  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else void audioRef.current.play().catch(() => toast.error(t('listening.audioPlayError')))
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const update = () => setCurrentTime(audio.currentTime)
    const ended = () => {
      setPlaying(false)
      if (repeatSegment) seekTo(activeIndex)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      if (event.key === 'ArrowRight') seekTo(Math.min(segments.length - 1, activeIndex + 1))
      if (event.key === 'ArrowLeft') seekTo(Math.max(0, activeIndex - 1))
    }
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', ended)
    window.addEventListener('keydown', keydown)
    return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause); audio.removeEventListener('ended', ended); window.removeEventListener('keydown', keydown) }
  }, [activeIndex, playing, repeatSegment, segments.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
    const currentSegment = segments[activeIndex]
    const nextSegment = segments[activeIndex + 1]
    if (loopA !== null && loopB !== null && loopB >= loopA && currentSegment && nextSegment) {
      const end = segments[loopB]?.end_ms
      if (end !== undefined && currentTime * 1000 >= end) audio.currentTime = (segments[loopA].start_ms ?? 0) / 1000
    }
  }, [speed, loopA, loopB, currentTime, activeIndex, segments])

  if (lessonQuery.isLoading) return <div className="theme-card p-10 text-center">{t('listening.playerLoading')}</div>
  if (!lesson) return <div className="theme-card space-y-3 p-8 text-center"><p>{t('listening.notFound')}</p><Link to="/listening" className="btn btn-outline inline-flex">{t('listening.backToList')}</Link></div>

  return <section className="space-y-5 text-[color:var(--text)]">
    <Link to="/listening" className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--primary)]"><ArrowLeft className="h-4 w-4" />{t('listening.backToList')}</Link>
    <header><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{lesson.jlpt_level}</span><span className="text-sm text-[color:var(--text-muted)]">{lesson.topic}</span></div><h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1><p className="mt-2 text-[color:var(--text-muted)]">{lesson.description}</p></header>
    <div className="theme-card space-y-4 p-4 sm:p-5">
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" onError={() => audioUrl && toast.error(t('listening.audioFileError'))} />
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={togglePlay} disabled={!audioUrl} aria-label={playing ? t('listening.pause') : t('listening.play')} className="btn btn-primary inline-flex items-center gap-2">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? t('listening.pause') : t('listening.play')}</button><button type="button" onClick={() => seekTo(Math.max(0, activeIndex - 1))} className="btn btn-outline" aria-label={t('listening.previousSentence')}><SkipBack className="h-4 w-4" /></button><button type="button" onClick={() => seekTo(Math.min(segments.length - 1, activeIndex + 1))} className="btn btn-outline" aria-label={t('listening.nextSentence')}><SkipForward className="h-4 w-4" /></button><button type="button" onClick={() => setRepeatSegment((value) => !value)} aria-pressed={repeatSegment} className={`btn btn-outline inline-flex items-center gap-2 ${repeatSegment ? 'border-[color:var(--primary)] text-[color:var(--primary)]' : ''}`}><Repeat1 className="h-4 w-4" />{t('listening.repeatSentence')}</button><label className="ml-auto flex items-center gap-2 text-sm">{t('listening.speed')}<select className="input py-2" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[0.75, 1, 1.25].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label></div>
      <input aria-label={t('listening.audioProgress')} type="range" min={0} max={audioRef.current?.duration || Math.max(1, (lesson.duration_ms || 0) / 1000)} step="0.1" value={Math.min(currentTime, audioRef.current?.duration || currentTime)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value) }} className="w-full accent-[color:var(--primary)]" />
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{[[showJapanese, setShowJapanese, t('listening.japanese')], [showFurigana, setShowFurigana, 'Furigana'], [showVietnamese, setShowVietnamese, t('listening.vietnamese')]].map(([checked, setter, label]) => <label key={String(label)} className="inline-flex items-center gap-2"><input type="checkbox" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} />{label as string}</label>)}</div>
      <p className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]"><Headphones className="h-4 w-4" />{t('listening.generatedAudio')}</p>
      {audioUrl && <a className="text-xs text-[color:var(--primary)] underline" href="https://voicevox.hiroshiba.jp/term/" target="_blank" rel="noreferrer">{t('listening.terms')}</a>}
    </div>
    <div className="space-y-3">{segments.map((segment, index) => <article key={segment.idx} className={`theme-card p-4 transition ${index === activeIndex ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/30' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.sentence', { number: index + 1 })}</span><div className="flex gap-2"><button type="button" onClick={() => setLoopA(index)} className={`rounded-lg px-2 py-1 text-xs ${loopA === index ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'bg-[color:var(--accent)]'}`}>{t('listening.loopFromA')}</button><button type="button" onClick={() => setLoopB(index)} className={`rounded-lg px-2 py-1 text-xs ${loopB === index ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'bg-[color:var(--accent)]'}`}>{t('listening.toB')}</button><button type="button" onClick={() => seekTo(index)} className="rounded-lg bg-[color:var(--accent)] px-2 py-1 text-xs text-[color:var(--primary)]">{t('listening.listenSentence')}</button></div></div>
      {showJapanese && <button type="button" onClick={() => seekTo(index)} className="block text-left text-lg leading-loose">{showFurigana && segment.tokens?.length ? segment.tokens.map((token, tokenIndex) => <span key={`${tokenIndex}-${token.text}`}>{token.reading && token.reading !== token.text ? <ruby>{token.text}<rt className="text-xs text-[color:var(--text-muted)]">{token.reading}</rt></ruby> : token.text}</span>) : segment.ja}</button>}
      {showVietnamese && <p className="mt-1 text-sm text-[color:var(--text-muted)]">{segment.vi}</p>}
    </article>)}</div>
  </section>
}
