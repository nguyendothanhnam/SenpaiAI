import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Headphones, Pause, Play, Repeat1, SkipBack, SkipForward } from 'lucide-react'
import { useQuery } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { listeningAPI } from '../services/api'
import { localizeListeningLesson, localizeListeningSegment } from '../utils/listeningLocale'
import ListeningExercises from '../components/listening/ListeningExercises'

export default function ListeningPlayer() {
  const { t, i18n } = useTranslation('common')
  const { id: rawId } = useParams<{ id: string }>()
  const id = Number(rawId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showJapanese, setShowJapanese] = useState(true)
  const [showFurigana, setShowFurigana] = useState(true)
  const [showVietnamese, setShowVietnamese] = useState(true)
  const [repeatSegment, setRepeatSegment] = useState(false)
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const [activity, setActivity] = useState<'listen' | 'exercises'>('listen')
  const clipEnd = useRef<number | null>(null)
  const lessonQuery = useQuery(['listening-lesson', id], () => listeningAPI.getLesson(id).then(({ data }) => data), { enabled: Number.isFinite(id) && id > 0, retry: 1 })
  const lesson = lessonQuery.data
  const displayLesson = lesson ? localizeListeningLesson(lesson, t) : null
  const audioObjectUrl = useRef('')
  const audioRequestId = useRef(0)

  const loadAudio = async () => {
    const requestId = ++audioRequestId.current
    clipEnd.current = null
    setAudioLoading(true)
    setAudioError(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    try {
      const { data } = await listeningAPI.getAudio(id)
      if (requestId !== audioRequestId.current) return
      const nextUrl = URL.createObjectURL(data)
      if (audioObjectUrl.current) URL.revokeObjectURL(audioObjectUrl.current)
      audioObjectUrl.current = nextUrl
      setAudioUrl(nextUrl)
      // Audio generation also writes the authoritative per-sentence timestamps.
      void lessonQuery.refetch()
    } catch {
      if (requestId === audioRequestId.current) setAudioError(true)
    } finally {
      if (requestId === audioRequestId.current) setAudioLoading(false)
    }
  }

  useEffect(() => {
    if (lesson) void loadAudio()
    return () => {
      audioRequestId.current += 1
      if (audioObjectUrl.current) URL.revokeObjectURL(audioObjectUrl.current)
      audioObjectUrl.current = ''
      setAudioUrl('')
    }
  }, [id, Boolean(lesson)]) // eslint-disable-line react-hooks/exhaustive-deps

  const segments = lesson?.segments ?? []
  const audioDuration = duration || (lesson?.duration_ms || 0) / 1000
  const formatTime = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
  const activeIndex = useMemo(() => {
    const index = segments.findIndex((segment) => currentTime * 1000 >= (segment.start_ms ?? 0) && currentTime * 1000 < (segment.end_ms ?? Number.MAX_SAFE_INTEGER))
    return index < 0 ? 0 : index
  }, [segments, currentTime])
  const seekTo = (index: number, sentenceOnly = false) => {
    const segment = segments[index]
    if (!segment || !audioRef.current) return
    if (sentenceOnly && ((segment.end_ms ?? 0) <= (segment.start_ms ?? 0))) {
      toast.error(t('listening.exercises.timestampsUnavailable'))
      return
    }
    clipEnd.current = sentenceOnly ? (segment.end_ms ?? 0) / 1000 : null
    audioRef.current.currentTime = (segment.start_ms ?? 0) / 1000
    setCurrentTime(audioRef.current.currentTime)
    void audioRef.current.play().then(() => setPlaying(true)).catch(() => undefined)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playing || clipEnd.current === null) return
    const end = clipEnd.current
    const timer = window.setTimeout(() => {
      if (clipEnd.current !== end) return
      audio.pause()
      clipEnd.current = null
    }, Math.max(0, (end - audio.currentTime) / speed * 1000))
    return () => window.clearTimeout(timer)
  }, [playing, speed, currentTime, audioUrl])

  useEffect(() => {
    audioRef.current?.pause()
    clipEnd.current = null
    setRepeatSegment(false)
    setLoopA(null)
    setLoopB(null)
  }, [activity, id])
  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else void audioRef.current.play().catch(() => toast.error(t('listening.audioPlayError')))
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const update = () => {
      setCurrentTime(audio.currentTime)
      if (clipEnd.current !== null && audio.currentTime >= clipEnd.current) {
        audio.pause()
        clipEnd.current = null
      }
    }
    const ended = () => {
      setPlaying(false)
      if (repeatSegment) seekTo(activeIndex)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, button, a') || event.target.isContentEditable)) return
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
    <header><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{lesson.jlpt_level}</span><span className="text-sm text-[color:var(--text-muted)]">{displayLesson?.topic}</span></div><h1 className="listening-japanese mt-2 text-3xl font-bold">{displayLesson?.title}</h1><p className="mt-2 text-[color:var(--text-muted)]">{displayLesson?.description}</p></header>
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-1" role="group" aria-label={t('listening.exercises.chooseActivity')}>
      <button type="button" onClick={() => setActivity('listen')} aria-pressed={activity === 'listen'} className={`min-h-10 rounded-xl px-5 text-sm font-semibold transition ${activity === 'listen' ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]'}`}>{t('listening.exercises.listenRead')}</button>
      <button type="button" onClick={() => setActivity('exercises')} aria-pressed={activity === 'exercises'} className={`min-h-10 rounded-xl px-5 text-sm font-semibold transition ${activity === 'exercises' ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]'}`}>{t('listening.exercises.title')}</button>
    </div>
    <section className="theme-card overflow-hidden rounded-3xl border border-[color:var(--border)] shadow-[var(--shadow-card)]" aria-label={t('listening.audioSectionTitle')}>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} onDurationChange={() => setDuration(audioRef.current?.duration || 0)} onError={() => { if (audioUrl) { setAudioError(true); setPlaying(false); toast.error(t('listening.audioFileError')) } }} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Headphones className="h-5 w-5" /></span><div><h2 className="font-bold">{t('listening.audioSectionTitle')}</h2><p className="text-xs text-[color:var(--text-muted)]">{t('listening.generatedAudio')}</p></div></div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${audioError ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : audioLoading ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-[color:var(--accent)] text-[color:var(--primary)]'}`}><span className={`h-2 w-2 rounded-full ${audioError ? 'bg-red-500' : audioLoading ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />{audioError ? t('listening.audioStatusError') : audioLoading ? t('listening.audioStatusLoading') : t('listening.audioStatusReady')}</span>
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        {audioError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"><span>{t('listening.audioUnavailable')}</span><button type="button" disabled={audioLoading} onClick={() => void loadAudio()} className="btn btn-outline w-full border-current px-4 py-2 text-current disabled:opacity-50 sm:w-auto">{audioLoading ? t('listening.audioGenerating') : t('listening.retryAudio')}</button></div>}
        {audioLoading && <p role="status" className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-medium text-[color:var(--primary)]">{t('listening.audioGenerating')}</p>}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <button type="button" onClick={() => seekTo(Math.max(0, activeIndex - 1))} disabled={!audioUrl || !segments.length} className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)] disabled:opacity-40" aria-label={t('listening.previousSentence')}><SkipBack className="h-5 w-5" /></button>
          <button type="button" onClick={togglePlay} disabled={!audioUrl || audioLoading} aria-label={playing ? t('listening.pause') : t('listening.play')} className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-lg transition hover:scale-105 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[4.5rem] sm:w-[4.5rem]">{playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}</button>
          <button type="button" onClick={() => seekTo(Math.min(segments.length - 1, activeIndex + 1))} disabled={!audioUrl || !segments.length} className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)] disabled:opacity-40" aria-label={t('listening.nextSentence')}><SkipForward className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2"><input aria-label={t('listening.audioProgress')} type="range" min={0} max={audioDuration || 1} step="0.1" value={Math.min(currentTime, audioDuration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value) }} disabled={!audioUrl} className="h-2 w-full cursor-pointer accent-[color:var(--primary)] disabled:cursor-not-allowed" /><div className="flex justify-between text-xs font-medium tabular-nums text-[color:var(--text-muted)]"><span>{formatTime(currentTime)}</span><span>{formatTime(audioDuration)}</span></div></div>
        {activity === 'listen' && <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
          <div className="flex flex-wrap gap-2">{[[showJapanese, setShowJapanese, t('listening.japanese')], [showFurigana, setShowFurigana, 'Furigana'], [showVietnamese, setShowVietnamese, i18n.resolvedLanguage?.toLowerCase().startsWith('en') ? t('listening.englishTranslation') : t('listening.vietnamese')]].map(([checked, setter, label]) => <label key={String(label)} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${checked ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--text-muted)]'}`}><input type="checkbox" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="accent-[color:var(--primary)]" />{label as string}</label>)}</div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setRepeatSegment((value) => !value)} aria-pressed={repeatSegment} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${repeatSegment ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--bg-elevated)]'}`}><Repeat1 className="h-4 w-4" />{t('listening.repeatSentence')}</button><label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.speed')}<select className="input w-[4.5rem] px-2 py-2 text-sm" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[0.75, 1, 1.25].map((value) => <option key={value} value={value}>{value}x</option>)}</select></label></div>
        </div>
        </>}
        {activity === 'exercises' && <label className="flex items-center justify-end gap-2 text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.speed')}<select value={speed} onChange={event => setSpeed(Number(event.target.value))} className="input w-24 rounded-xl">{[0.75, 1, 1.25].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>}
        {audioUrl && <div className="flex justify-end"><a className="text-xs text-[color:var(--primary)] underline underline-offset-2" href="https://voicevox.hiroshiba.jp/term/" target="_blank" rel="noreferrer">{t('listening.terms')}</a></div>}
      </div>
    </section>
    <div hidden={activity !== 'exercises'}><ListeningExercises key={id} active={activity === 'exercises'} lessonId={id} audioReady={Boolean(audioUrl) && !audioLoading && !audioError && segments.every(segment => (segment.end_ms ?? 0) > (segment.start_ms ?? 0))} onPlaySegment={index => seekTo(index, true)} /></div>
    {activity === 'listen' && <>
    <div className="space-y-3">{segments.map((segment, index) => <article key={segment.idx} className={`theme-card p-4 transition ${index === activeIndex ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.sentence', { number: index + 1 })}</span><div className="flex gap-2"><button type="button" onClick={() => setLoopA(index)} className={`rounded-lg px-2 py-1 text-xs ${loopA === index ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'bg-[color:var(--accent)]'}`}>{t('listening.loopFromA')}</button><button type="button" onClick={() => setLoopB(index)} className={`rounded-lg px-2 py-1 text-xs ${loopB === index ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'bg-[color:var(--accent)]'}`}>{t('listening.toB')}</button><button type="button" onClick={() => seekTo(index)} className="rounded-lg bg-[color:var(--accent)] px-2 py-1 text-xs text-[color:var(--primary)]">{t('listening.listenSentence')}</button></div></div>
      {showJapanese && <button type="button" onClick={() => seekTo(index)} className="listening-japanese block text-left text-lg">{showFurigana && segment.tokens?.length ? segment.tokens.map((token, tokenIndex) => <span key={`${tokenIndex}-${token.text}`}>{token.reading && token.reading !== token.text ? <ruby>{token.text}<rt className="text-xs text-[color:var(--text-muted)]">{token.reading}</rt></ruby> : token.text}</span>) : segment.ja}</button>}
      {showVietnamese && <p className="mt-1 text-sm text-[color:var(--text-muted)]">{localizeListeningSegment(segment.vi, i18n.resolvedLanguage || i18n.language, t)}</p>}
    </article>)}</div>
    </>}
  </section>
}
