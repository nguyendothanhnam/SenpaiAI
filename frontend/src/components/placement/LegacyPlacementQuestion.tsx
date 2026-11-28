import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../services/api'
import type { PlacementQuestion, PlacementAnswer } from '../../services/placement'
import { getErrorMessage } from '../../utils/getErrorMessage'
const buttonClass = 'rounded-xl border border-[color:var(--border)] px-5 py-3 font-semibold focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] disabled:opacity-50'

function ListeningAudio({ question }: { question: PlacementQuestion }) {
  const { t } = useTranslation('placement')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    api.get(`/listening/lessons/${question.lesson_id}/audio`, { responseType: 'blob', signal: controller.signal })
      .then(res => { objectUrl = URL.createObjectURL(res.data); setUrl(objectUrl) })
      .catch(err => { if (!controller.signal.aborted) setError(getErrorMessage(err)) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [question.lesson_id])
  if (error) return <p role="alert">{error}</p>
  if (!url) return <p role="status">{t('loadingAudio')}</p>
  const start = (question.start_ms || 0) / 1000
  const end = (question.end_ms || 0) / 1000
  return <audio controls src={url} aria-label={t('listeningPrompt')} onLoadedMetadata={event => { event.currentTarget.currentTime = start }}
    onPlay={event => { if (event.currentTarget.currentTime >= end) event.currentTarget.currentTime = start }}
    onTimeUpdate={event => { const audio = event.currentTarget; if (audio.currentTime >= end) audio.pause(); if (audio.currentTime < start) audio.currentTime = start }} />
}

export function LegacyPlacementQuestion({ question, busy, onAnswer }: { question: PlacementQuestion; busy: boolean; onAnswer: (value: PlacementAnswer) => void }) {
  const { t } = useTranslation('placement')
  const [answer, setAnswer] = useState('')
  const [order, setOrder] = useState<number[]>([])
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const tokens = question.tokens || []
  const options: { label: string; value: PlacementAnswer }[] = question.question_type === 'true_false'
    ? [{ label: t('true'), value: true }, { label: t('false'), value: false }]
    : (question.options || []).map(option => ({ label: option, value: option }))
  return <section className="theme-card motion-reduce:transition-none space-y-5 p-6">
    <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{question.prompt_key && <span className="mb-2 block">{t(question.prompt_key)}</span>}{question.statement || question.prompt}</h2>
    {question.base_form && <p>{question.base_form} · {question.target_form}</p>}
    {question.question_type === 'listening' && <ListeningAudio question={question} />}
    {options.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{options.map((option, index) =>
      <button key={index} type="button" className={`${buttonClass} text-left`} disabled={busy} onClick={() => onAnswer(option.value)}>{option.label}</button>)}</div>
      : question.question_type === 'reorder' ? <div className="space-y-4">
        <p>{t('reorder')}</p><p aria-live="polite" className="min-h-12 rounded-xl border border-[color:var(--border)] p-3">{order.map(index => tokens[index]).join('')}</p>
        <div className="flex flex-wrap gap-2">{tokens.map((token, index) => <button type="button" key={index} className={buttonClass} disabled={busy || order.includes(index)} onClick={() => setOrder([...order, index])}>{token}</button>)}</div>
        <button type="button" className={buttonClass} disabled={busy || !order.length} onClick={() => setOrder([])}>{t('reset')}</button>{' '}
        <button type="button" className={buttonClass} disabled={busy || order.length !== tokens.length} onClick={() => onAnswer(order.map(index => tokens[index]))}>{t('submit')}</button>
      </div> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (answer.trim()) onAnswer(answer) }}>
        <label className="block">{t('answer')}<input value={answer} onChange={event => setAnswer(event.target.value)} maxLength={1000} required disabled={busy} className="mt-2 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3" /></label>
        <button className={buttonClass} disabled={busy || !answer.trim()}>{t('submit')}</button>
      </form>}
  </section>
}
