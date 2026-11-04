import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Headphones, ListChecks, Loader2, PenLine, Play, RotateCcw, Trophy, XCircle } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { listeningAPI, type ListeningAttemptResult, type ListeningExerciseMode } from '../../services/api'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { formatRelativeTime } from '../../utils/helpers'

const modes: Array<{ id: ListeningExerciseMode; icon: typeof PenLine }> = [
  { id: 'dictation', icon: PenLine }, { id: 'cloze', icon: ListChecks }, { id: 'comprehension', icon: CheckCircle2 },
]
type Drafts = Partial<Record<ListeningExerciseMode, Record<string, string>>>

export default function ListeningExercises({ lessonId, audioReady, onPlaySegment, active = true }: {
  lessonId: number
  audioReady: boolean
  onPlaySegment: (index: number) => void
  active?: boolean
}) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const [mode, setMode] = useState<ListeningExerciseMode>('dictation')
  const [drafts, setDrafts] = useState<Drafts>({})
  const [results, setResults] = useState<Partial<Record<ListeningExerciseMode, ListeningAttemptResult>>>({})
  const started = useRef<Partial<Record<ListeningExerciseMode, number>>>({})
  const queryClient = useQueryClient()
  const query = useQuery(['listening-exercises', lessonId], () => listeningAPI.getExercises(lessonId).then(({ data }) => data), { enabled: active, retry: 1, refetchOnWindowFocus: false })
  const history = useQuery(['listening-attempts', lessonId], () => listeningAPI.getAttempts(lessonId).then(({ data }) => data), { enabled: active, retry: 1, refetchOnWindowFocus: false })

  useEffect(() => { setDrafts({}); setResults({}); started.current = {} }, [query.data?.revision])
  const questions = (query.data?.questions || []).filter(question => question.mode === mode)
  const answers = drafts[mode] || {}
  const result = results[mode]
  const answered = questions.filter(question => (answers[question.id] || '').trim()).length
  const resultById = new Map((result?.results || []).map(item => [item.question_id, item]))
  const submit = useMutation(
    () => listeningAPI.submitAttempt(lessonId, {
      mode, revision: query.data!.revision,
      answers: questions.map(question => ({ question_id: question.id, answer: answers[question.id] || '' })),
      duration_ms: Math.min(86400000, Math.max(0, Date.now() - (started.current[mode] || Date.now()))),
    }).then(({ data }) => data),
    {
      onSuccess: data => {
        setResults(current => ({ ...current, [data.mode]: data }))
        void queryClient.invalidateQueries(['listening-attempts', lessonId])
        toast.success(t('listening.exercises.saved'))
      },
      onError: (error: unknown) => {
        toast.error(getErrorMessage(error))
        if ((error as { response?: { status?: number } }).response?.status === 409) void query.refetch()
      },
    },
  )
  const begin = () => { if (!started.current[mode]) started.current[mode] = Date.now() }
  const answer = (id: string, value: string) => {
    begin()
    setDrafts(current => ({ ...current, [mode]: { ...current[mode], [id]: value } }))
  }
  const retry = () => {
    setDrafts(current => ({ ...current, [mode]: {} }))
    setResults(current => ({ ...current, [mode]: undefined }))
    started.current[mode] = Date.now()
  }

  return <section className="space-y-5" aria-label={t('listening.exercises.title')}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">{t('listening.exercises.eyebrow')}</p><h2 className="mt-1 text-2xl font-bold">{t('listening.exercises.title')}</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('listening.exercises.subtitle')}</p></div>
      <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-[color:var(--primary)]"><Headphones className="h-4 w-4" />{t('listening.exercises.transcriptHidden')}</span>
    </header>
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label={t('listening.exercises.chooseMode')}>
      {modes.map(({ id, icon: Icon }) => {
        const available = query.data?.questions.some(question => question.mode === id) ?? true
        return <button key={id} type="button" disabled={submit.isLoading || !available} onClick={() => setMode(id)} aria-pressed={mode === id} className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${mode === id ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]'}`}><Icon className="mb-3 h-5 w-5 text-[color:var(--primary)]" /><span className="block text-sm font-bold">{t(`listening.exercises.modes.${id}`)}</span><span className="mt-1 block text-xs leading-5 text-[color:var(--text-muted)]">{t(available ? `listening.exercises.descriptions.${id}` : 'listening.exercises.notEnoughChoices')}</span></button>
      })}
    </div>
    {query.isLoading ? <p role="status" className="theme-card flex items-center gap-3 p-6"><Loader2 className="h-5 w-5 animate-spin" />{t('listening.exercises.loading')}</p> : query.isError ? <div role="alert" className="theme-card space-y-3 p-5"><p>{getErrorMessage(query.error)}</p><button type="button" onClick={() => void query.refetch()} className="btn btn-outline btn-md">{t('listening.retry')}</button></div> : !questions.length ? <p className="theme-card p-6">{t('listening.exercises.empty')}</p> : <>
      {!audioReady && <p role="status" className="rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm text-[color:var(--primary)]">{t('listening.exercises.audioRequired')}</p>}
      <div className="theme-card space-y-2 p-4"><div className="flex justify-between gap-3 text-xs font-semibold"><span>{t('listening.exercises.progress', { count: answered, total: questions.length })}</span><span>{t('listening.exercises.markingHint')}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--accent)]"><div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${100 * answered / questions.length}%` }} /></div></div>
      {result && <div role="status" className="theme-card flex flex-wrap items-center justify-between gap-4 border-[color:var(--primary)] p-5"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Trophy className="h-6 w-6" /></span><div><p className="text-2xl font-bold text-[color:var(--primary)]">{t('listening.exercises.score', { score: result.score })}</p><p className="text-sm text-[color:var(--text-muted)]">{t('listening.exercises.correctCount', { correct: result.correct_count, total: result.total })}</p></div></div><button type="button" onClick={retry} className="btn btn-outline btn-md gap-2"><RotateCcw className="h-4 w-4" />{t('listening.exercises.retry')}</button></div>}
      <form onSubmit={event => { event.preventDefault(); if (!submit.isLoading && !result && answered === questions.length) submit.mutate() }} className="space-y-4">
        {questions.map((question, index) => {
          const feedback = resultById.get(question.id)
          return <article key={question.id} className="theme-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--accent)] text-xs font-bold text-[color:var(--primary)]">{index + 1}</span><h3 className="text-sm font-semibold">{t(`listening.exercises.prompts.${mode}`)}</h3></div><button type="button" disabled={!audioReady} onClick={() => { begin(); onPlaySegment(question.segment_index) }} className="btn btn-outline btn-sm shrink-0 gap-1.5 rounded-xl text-[color:var(--primary)]" aria-label={t('listening.exercises.playQuestion', { number: index + 1 })}><Play className="h-3.5 w-3.5" />{t('listening.exercises.listenAgain')}</button></div>
            <div className="space-y-3 p-4 sm:p-5">
              {mode === 'cloze' && <p lang="ja" className="listening-japanese break-words text-xl leading-10">{question.prefix}<span aria-label={t('listening.exercises.blank')} className="mx-1 inline-block min-w-20 rounded-lg bg-[color:var(--accent)] px-3 text-center font-bold tracking-wider text-[color:var(--primary)]">＿＿＿</span>{question.suffix}</p>}
              {mode === 'comprehension' ? <fieldset disabled={Boolean(result) || submit.isLoading} className="grid gap-2"><legend className="sr-only">{t('listening.exercises.prompts.comprehension')}</legend>{question.options?.map((option, choice) => <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${answers[question.id] === option.id ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]'}`}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => answer(question.id, option.id)} className="accent-[color:var(--primary)]" /><span className="text-xs font-semibold text-[color:var(--text-muted)]">{String.fromCharCode(65 + choice)}.</span><span lang="ja" className="listening-japanese leading-7">{option.text}</span></label>)}</fieldset> : <>
                <label className="block space-y-2"><span className="text-xs font-semibold text-[color:var(--text-muted)]">{t('listening.exercises.yourAnswer')}</span>{mode === 'dictation' ? <textarea lang="ja" value={answers[question.id] || ''} onChange={event => answer(question.id, event.target.value)} disabled={Boolean(result) || submit.isLoading} maxLength={1000} rows={2} spellCheck={false} autoComplete="off" placeholder={t('listening.exercises.dictationPlaceholder')} className="input !h-auto w-full resize-y rounded-xl py-3 font-japanese leading-7" /> : <input lang="ja" value={answers[question.id] || ''} onChange={event => answer(question.id, event.target.value)} disabled={Boolean(result) || submit.isLoading} maxLength={1000} spellCheck={false} autoComplete="off" placeholder={t('listening.exercises.clozePlaceholder')} className="input h-12 w-full rounded-xl font-japanese" />}</label>
                {question.accepts_kana && <p className="text-xs text-[color:var(--text-muted)]">{t('listening.exercises.kanaHint')}</p>}
              </>}
              {feedback && <div className={`rounded-xl border p-4 ${feedback.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'}`}><p className="mb-2 flex items-center gap-2 text-xs font-bold">{feedback.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{t(feedback.correct ? 'listening.exercises.correct' : 'listening.exercises.incorrect')}</p><p className="text-xs font-semibold">{t('listening.exercises.expected')}</p><p lang="ja" className="listening-japanese mt-1 whitespace-pre-wrap break-words text-base">{feedback.expected}</p>{mode === 'cloze' && <p lang="ja" className="listening-japanese mt-2 break-words text-sm">{feedback.transcript}</p>}</div>}
            </div>
          </article>
        })}
        {!result && <footer className="theme-card flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-xs text-[color:var(--text-muted)]">{answered < questions.length ? t('listening.exercises.answerAll') : t('listening.exercises.ready')}</p><button type="submit" disabled={submit.isLoading || answered < questions.length} className="btn btn-primary btn-lg gap-2 rounded-xl">{submit.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t(submit.isLoading ? 'listening.exercises.submitting' : 'listening.exercises.submit')}</button></footer>}
      </form>
    </>}
    {Boolean(history.data?.items.length) && <details className="theme-card p-4"><summary className="cursor-pointer text-sm font-semibold">{t('listening.exercises.history')}</summary><ul className="mt-3 divide-y divide-[color:var(--border)]">{history.data?.items.map(attempt => <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><span>{t(`listening.exercises.modes.${attempt.mode}`)} <span className="ml-2 text-[color:var(--text-muted)]">{formatRelativeTime(attempt.created_at, language)}</span></span><span className="font-bold text-[color:var(--primary)]">{t('listening.exercises.score', { score: attempt.score })} · {attempt.correct_count}/{attempt.total}</span></li>)}</ul></details>}
    {history.isError && <p className="text-xs text-[color:var(--text-muted)]">{t('listening.exercises.historyError')}</p>}
  </section>
}
