import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Clock3, RotateCcw, BookOpenCheck } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../services/auth'
import { placementAPI, PlacementAnswer, PlacementAttempt, PlacementMode, PlacementQuestion } from '../services/placement'
import { getErrorMessage } from '../utils/getErrorMessage'
import { confirmDialog } from '../features/dialogs/queue'
import PlacementSetup from '../components/placement/PlacementSetup'
import PlacementResults from '../components/placement/PlacementResults'
import { LegacyPlacementQuestion } from '../components/placement/LegacyPlacementQuestion'

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-5 py-3 font-semibold focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-50'

function AudioClip({ question }: { question: PlacementQuestion }) {
  const { t } = useTranslation('placement')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    setUrl(''); setError('')
    api.get(question.audio_url!, { responseType: 'blob', signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(res.data); setUrl(objectUrl) } })
      .catch(err => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [question.audio_url, retry])
  const start = (question.start_ms || 0) / 1000
  const end = (question.end_ms || 0) / 1000
  if (error) return <div role="alert"><p>{error}</p><button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>{t('retry')}</button></div>
  if (!url) return <p role="status">{t('loadingAudio')}</p>
  return <audio className="w-full" aria-label={t('skills.listening')} controls src={url}
    onLoadedMetadata={event => { event.currentTarget.currentTime = start }}
    onPlay={event => { const audio = event.currentTarget; if (audio.currentTime < start || audio.currentTime >= end) audio.currentTime = start }}
    onTimeUpdate={event => { const audio = event.currentTarget; if (audio.currentTime >= end) audio.pause(); if (audio.currentTime < start) audio.currentTime = start }} />
}

export default function Placement({ requiredSetup = false }: { requiredSetup?: boolean }) {
  const { t, i18n } = useTranslation('placement')
  const { user, refreshUser, logout } = useAuth()
  const queryClient = useQueryClient()
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const [mode, setMode] = useState<PlacementMode>('adaptive')
  const [level, setLevel] = useState('N5')
  const [attempt, setAttempt] = useState<PlacementAttempt | null>(null)
  const [position, setPosition] = useState(0)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(Date.now())
  const pending = useRef(false)
  const autoSubmitted = useRef<number | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const history = useQuery(['placement', 'history', user?.id], () => placementAPI.history().then(res => res.data))
  const availability = useQuery(['placement', 'levels', user?.id, language], () => placementAPI.levels(language).then(res => res.data))
  const active = history.data?.find(row => row.status === 'in_progress')
  const questions = attempt?.items || []
  const question = questions[position]
  const legacy = attempt?.assessment_mode === 'legacy'
  const stage = !attempt ? 'setup' : attempt.status === 'completed' ? 'result' : 'exam'
  const serverOffset = useRef(0)
  const seconds = attempt?.expires_at ? Math.max(0, Math.ceil((new Date(attempt.expires_at).getTime() - clock - serverOffset.current) / 1000)) : null
  const expired = seconds === 0
  useEffect(() => {
    if (attempt?.server_time) serverOffset.current = new Date(attempt.server_time).getTime() - Date.now()
    setClock(Date.now())
  }, [attempt?.server_time])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { setDraft(typeof question?.user_answer === 'string' ? question.user_answer : null) }, [question?.key, question?.user_answer])
  useEffect(() => { titleRef.current?.focus({ preventScroll: false }) }, [stage])
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || draft === null || draft === question?.user_answer) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [attempt?.status, draft, question?.user_answer])
  const run = async (action: () => Promise<{ data: PlacementAttempt }>, confirm = false) => {
    if (pending.current) return undefined
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await action()
      setAttempt(response.data)
      queryClient.invalidateQueries(['placement'])
      if (confirm) await refreshUser()
      return response.data
    } catch (err) { setError(getErrorMessage(err)); return undefined }
    finally { pending.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (attempt?.status === 'in_progress' && !legacy && expired && autoSubmitted.current !== attempt.id) {
      autoSubmitted.current = attempt.id
      void run(() => placementAPI.submit(attempt.id))
    }
  }, [attempt?.id, attempt?.status, expired, legacy])
  const start = async () => {
    if (active) {
      if (!await confirmDialog(t('replaceAttempt'), { title: t('startNew'), confirmLabel: t('startNew') })) return
      if (!await run(() => placementAPI.abandon(active.id))) return
    }
    const next = await run(() => placementAPI.start(language, mode, mode === 'confirmation' ? level : undefined))
    if (next) { setPosition(0); autoSubmitted.current = null }
  }
  const resume = async (id: number) => {
    const next = await run(() => placementAPI.get(id))
    if (next) { setPosition(Math.max(0, next.items?.findIndex(row => row.user_answer == null) || 0)); autoSubmitted.current = null }
  }
  const move = async (direction: number) => {
    if (!attempt || !question) return
    let current = attempt
    if (draft !== null && draft !== question.user_answer) {
      const saved = await run(() => placementAPI.answer(attempt.id, question.key, draft, question.revision))
      if (!saved) return
      current = saved
    }
    setPosition(Math.max(0, Math.min(position + direction, current.items.length - 1)))
  }
  const submit = async () => {
    if (!attempt) return
    let current = attempt
    if (question && draft !== null && draft !== question.user_answer) {
      const saved = await run(() => placementAPI.answer(attempt.id, question.key, draft, question.revision))
      if (!saved) return
      current = saved
    }
    if (current.status === 'completed') return
    const missing = current.items.filter(row => row.user_answer == null).length
    if (!await confirmDialog(t('submitConfirmation', { count: missing }), { title: t('submitAssessment'), confirmLabel: t('submitAssessment') })) return
    await run(() => placementAPI.submit(current.id))
  }
  const leave = async (signOut = false) => {
    if (pending.current) return
    if (attempt?.status === 'in_progress' && !legacy && !expired && question && draft !== null && draft !== question.user_answer) {
      if (!await run(() => placementAPI.answer(attempt.id, question.key, draft, question.revision))) return
    }
    if (signOut) logout()
    else setAttempt(null)
  }
  const levels = availability.data?.levels || []
  const available = Boolean(levels.find(row => row.level === (mode === 'adaptive' ? 'N5' : level))?.available) && !history.isLoading && !availability.isLoading
  return <section className="mx-auto max-w-4xl space-y-6 pb-8 text-[color:var(--text)]">
    <header className="space-y-3 py-2 text-center"><span className="mx-auto inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]"><BookOpenCheck aria-hidden="true" className="h-4 w-4" />{t('assessmentBadge')}</span>
      <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none sm:text-4xl">{t(stage === 'setup' ? 'setupTitle' : stage === 'result' ? 'resultTitle' : 'examTitle')}</h1>
      <p className="text-[color:var(--text-muted)]">{t(stage === 'setup' ? 'setupDescription' : 'disclaimer')}</p>
    </header>
    {requiredSetup && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm"><p className="flex-1 text-[color:var(--text-muted)]">{t('requiredSetupCompact')}</p><button type="button" className="font-semibold text-[color:var(--primary)] underline" disabled={busy} onClick={() => void leave(true)}>{t('signOut')}</button></div>}
    {(error || history.isError || availability.isError) && <div role="alert" className="theme-card motion-reduce:transition-none space-y-3 p-4"><p>{error || getErrorMessage(history.error || availability.error)}</p><button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); if (attempt) void run(() => placementAPI.get(attempt.id)); void history.refetch(); void availability.refetch() }}>{t('retry')}</button></div>}
    {stage === 'setup' && <>
      {active && <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)] p-5"><div><p className="font-semibold">{t('activeAttempt')}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('savedProgress', { count: active.answered_count })}</p></div><button type="button" className={buttonClass} disabled={busy} onClick={() => resume(active.id)}>{t('resume')}</button></aside>}
      <PlacementSetup mode={mode} level={level} levels={levels} busy={busy || availability.isLoading} available={available} onMode={setMode} onLevel={setLevel} onStart={() => void start()} />
      <p className="text-center text-sm text-[color:var(--text-muted)]">{t('disclaimer')}</p>
      {!requiredSetup && <Link to="/chat" className="block text-center text-sm underline">{t('continue')}</Link>}
      {(history.data || []).filter(row => row.status === 'completed').length > 0 && <section className="theme-card motion-reduce:transition-none p-5"><h2 className="mb-3 font-semibold">{t('history')}</h2><div className="space-y-2">{history.data?.filter(row => row.status === 'completed').map(row => <button key={row.id} type="button" className="block w-full rounded-xl border border-[color:var(--border)] p-3 text-left text-sm" disabled={busy} onClick={() => resume(row.id)}>{new Date(row.completed_at || row.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} · {row.result?.estimated_level || (row.assessment_mode === 'legacy' ? row.result?.recommended_level : t('insufficientEvidence'))}</button>)}</div></section>}
    </>}
    {stage === 'exam' && attempt && <>
      <div className="theme-card motion-reduce:transition-none space-y-3 p-5"><div className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{t(legacy ? 'legacySession' : attempt.assessment_mode === 'adaptive' ? 'modeAdaptiveShort' : 'modeConfirmationShort')}{attempt.selected_level ? ` · ${attempt.selected_level}` : ''}</span>{seconds !== null && <span className="inline-flex items-center gap-2 font-mono" aria-label={t('timeRemaining')}><Clock3 aria-hidden="true" className="h-4 w-4" />{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>}</div><p className="text-sm text-[color:var(--text-muted)]">{t('progress', { count: attempt.answered_count, max: attempt.max_questions })}</p><progress aria-label={t('progressLabel')} className="h-2 w-full accent-[color:var(--primary)]" value={attempt.answered_count} max={attempt.max_questions} /></div>
      {legacy && attempt.question ? <LegacyPlacementQuestion key={attempt.question.key} question={attempt.question} busy={busy} onAnswer={(value: PlacementAnswer) => { void run(() => placementAPI.answer(attempt.id, attempt.question!.key, value)) }} /> : question && <section className="theme-card motion-reduce:transition-none space-y-5 p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="rounded-full bg-[color:var(--accent)] px-3 py-1 font-semibold text-[color:var(--primary)]">{t(`skills.${question.skill}`)} · {question.level}</span><span className="text-[color:var(--text-muted)]">{t('questionNumber', { count: position + 1 })}</span></div>
        {question.passage && <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-5"><p className="mb-3 text-sm font-semibold text-[color:var(--text-muted)]">{t('passageTitle')}</p><p lang="ja" className="whitespace-pre-wrap text-lg leading-loose">{question.passage}</p></div>}
        {question.audio_url && <AudioClip key={question.key} question={question} />}
        <fieldset><legend lang="ja" className="mb-5 text-xl font-semibold leading-relaxed">{question.prompt}</legend><div className="grid gap-3 sm:grid-cols-2">{question.choices?.map((choice, index) => <label key={choice.id} className={`flex items-start gap-3 rounded-xl border-2 p-4 ${draft === choice.id ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)]'} ${busy || expired || (attempt.assessment_mode === 'adaptive' && question.user_answer != null) ? 'cursor-default' : 'cursor-pointer'}`}>
          <input type="radio" name={`answer-${question.key}`} value={choice.id} checked={draft === choice.id} onChange={() => setDraft(choice.id)} disabled={busy || expired || (attempt.assessment_mode === 'adaptive' && question.user_answer != null)} className="mt-1 shrink-0 accent-[color:var(--primary)]" /><span className="font-semibold text-[color:var(--primary)]">{'ABCD'[index]}</span><span className="break-words">{choice.text}</span>
        </label>)}</div></fieldset>
        {attempt.assessment_mode === 'adaptive' && question.user_answer != null && <p className="text-sm text-[color:var(--text-muted)]">{t('adaptiveLocked')}</p>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-[color:var(--border)] pt-5"><button type="button" className={buttonClass} disabled={busy || position === 0} onClick={() => void move(-1)}><ChevronLeft aria-hidden="true" className="h-4 w-4" />{t('previous')}</button><button type="button" className={buttonClass} disabled={busy || expired || (attempt.assessment_mode === 'adaptive' && draft === null) || (attempt.ready_to_submit && position === questions.length - 1 && draft === question.user_answer)} onClick={() => void move(1)}>{t('next')}<ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div>
      </section>}
      {!legacy && <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-sm text-[color:var(--text-muted)]">{t(attempt.ready_to_submit ? 'readyToSubmit' : 'autosaveNote')}</p><button type="button" className={`${buttonClass} bg-[color:var(--primary)] text-[color:var(--primary-contrast)]`} disabled={busy} onClick={() => void submit()}>{t('submitAssessment')}</button></div>}
      <button type="button" className="text-sm underline" disabled={busy} onClick={() => void leave()}>{t('backToSetup')}</button>
    </>}
    {stage === 'result' && attempt && <PlacementResults attempt={attempt} busy={busy} onConfirm={() => { void run(() => placementAPI.confirm(attempt.id), true) }} onRetake={() => setAttempt(null)} onAdjacent={value => { setMode('confirmation'); setLevel(value); setAttempt(null) }} />}
    {stage === 'result' && !requiredSetup && <Link to="/chat" className={buttonClass}><RotateCcw aria-hidden="true" className="h-4 w-4" />{t('continue')}</Link>}
  </section>
}
