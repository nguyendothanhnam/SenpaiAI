import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, CalendarDays, HelpCircle, Clock3, Flame, Loader2, RotateCw, Sparkles, Trophy } from 'lucide-react'
import { dailyAPI, DailyAnswerResult, DailyCompletionResult, DailyHistoryEntry, DailyTask, rewardsAPI } from '../services/api'
import { rewardsMeKey, useRewardsMe } from '../services/rewards'
import { useAuth } from '../services/auth'
import DailyQuestion from '../components/daily/DailyQuestion'
import { getErrorMessage } from '../utils/getErrorMessage'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

type Screen = 'overview' | 'doing' | 'complete'
const todayKey = (userId?: number) => ['daily', 'today', userId]
const historyKey = (userId?: number, days = 30) => ['daily', 'history', userId, days]
const panel = 'theme-card rounded-3xl p-5 shadow-[var(--shadow-card)] sm:p-7'
const actionButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:opacity-50'

function messageFor(error: any) {
  return getErrorMessage(error)
}

function fromISO(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
function isoDate(value: Date) { return value.toISOString().slice(0, 10) }
function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN', { ...options, timeZone: 'UTC' }).format(fromISO(value))
}
function recentDates(serverDate: string, count: number) {
  const end = fromISO(serverDate)
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(end)
    value.setUTCDate(end.getUTCDate() - count + index + 1)
    return isoDate(value)
  })
}
type DailyTaskView = DailyTask & { _server_now_ms?: number; _fetched_at_ms?: number }
function useServerMidnightCountdown(serverDate?: string, serverNowMs?: number, fetchedAtMs?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!serverDate) return '—'
  // The date itself always comes from the API; this only renders a countdown in the configured default app timezone.
  const currentServerTime = serverNowMs && fetchedAtMs ? serverNowMs + (now - fetchedAtMs) : now
  const nextDay = fromISO(serverDate)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  // The default application timezone is UTC+07:00, so its next midnight is 17:00 UTC.
  const nextMidnight = new Date(`${isoDate(nextDay)}T17:00:00.000Z`).getTime()
  const remaining = Math.max(0, nextMidnight - currentServerTime)
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function DailyChallenge() {
  const { t } = useTranslation('common')
  const { t: tDailyStatus } = useTranslation('dailyStatus')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const uid = user?.id
  const { data: rewards } = useRewardsMe(uid)
  const [screen, setScreen] = useState<Screen>('overview')
  const [feedback, setFeedback] = useState<{ itemId: number; result: DailyAnswerResult } | null>(null)
  const { data: task, isLoading, isError, error, refetch, isFetching } = useQuery<DailyTaskView>(todayKey(uid), async () => {
    const response = await dailyAPI.getToday()
    const serverNow = Date.parse(response.headers.date || '')
    return { ...response.data, _server_now_ms: Number.isFinite(serverNow) ? serverNow : undefined, _fetched_at_ms: Date.now() }
  }, {
    enabled: Boolean(uid), retry: 1, refetchOnWindowFocus: true, staleTime: 0,
    onError: (queryError: any) => { if (queryError?.response?.data?.detail?.code !== 'not_enough_content') toast.error(messageFor(queryError)) },
  })
  const { data: history = [] } = useQuery<DailyHistoryEntry[]>(historyKey(uid, 7), () => dailyAPI.getHistory(7).then((response) => response.data), { enabled: Boolean(uid), retry: 1 })
  const completed = task?.status === 'completed'
  const unanswered = task?.items?.find((item) => !item.answered)
  const feedbackItem = feedback ? task?.items.find((item) => item.id === feedback.itemId) : undefined
  const activeItem = feedbackItem || unanswered
  const hasMixedLevels = Boolean(task?.items?.some((item) => item.payload?.level && item.payload.level !== user?.current_jlpt_level))
  const activeFeedback = feedback && activeItem?.id === feedback.itemId ? feedback.result : undefined
  const countdown = useServerMidnightCountdown(task?.date, task?._server_now_ms, task?._fetched_at_ms)
  const historyByDate = useMemo(() => new Map(history.map((entry) => [entry.date, entry])), [history])
  const answerMutation = useMutation(({ itemId, answer, time }: { itemId: number; answer: unknown; time: number }) => dailyAPI.answer(itemId, { answer, time_spent_ms: time }).then((response) => response.data), {
    onSuccess: (result, variables) => {
      setFeedback({ itemId: variables.itemId, result })
      void queryClient.invalidateQueries(todayKey(uid))
    },
    onError: (answerError: any) => {
      toast.error(messageFor(answerError))
      if (answerError?.response?.data?.detail?.code === 'task_expired') {
        setFeedback(null)
        setScreen('overview')
        void queryClient.invalidateQueries(todayKey(uid))
      }
    },
  })
  const completeMutation = useMutation(() => dailyAPI.complete().then((response) => response.data), {
    onSuccess: async (result: DailyCompletionResult) => {
      setScreen('complete')
      await Promise.all([
        queryClient.invalidateQueries(todayKey(uid)),
        queryClient.invalidateQueries(historyKey(uid, 7)),
        queryClient.invalidateQueries(historyKey(uid, 30)),
        queryClient.invalidateQueries(rewardsMeKey(uid)),
      ])
      // Update the rewards chip immediately with the completion response, then refresh server truth.
      const cached = queryClient.getQueryData<any>(rewardsMeKey(uid))
      if (cached) queryClient.setQueryData(rewardsMeKey(uid), { ...cached, points_balance: result.balance, current_streak: result.streak })
      void rewardsAPI.getMe().then(({ data }) => queryClient.setQueryData(rewardsMeKey(uid), data))
    },
    onError: (completeError: any) => {
      toast.error(messageFor(completeError))
      if (completeError?.response?.data?.detail?.code === 'task_expired') {
        setScreen('overview')
        void queryClient.invalidateQueries(todayKey(uid))
      }
    },
  })

  useEffect(() => {
    if (completed) setScreen('complete')
  }, [completed])

  useEffect(() => {
    if (!completed || countdown !== '00:00:00') return
    void refetch()
    const timer = window.setInterval(() => void refetch(), 60000)
    return () => window.clearInterval(timer)
  }, [completed, countdown, refetch])

  const currentIndex = task?.items.findIndex((item) => item.id === activeItem?.id) ?? 0
  const days = task ? recentDates(task.date, 7) : []
  const progress = task?.progress.answered_items || 0
  const completedReward = task?.reward
  const completion = completeMutation.data
  const breakdown = completion?.breakdown || completedReward?.breakdown
  const pointsAwarded = completion?.points_awarded ?? completedReward?.points_awarded ?? 0

  if (isLoading && !task) return <div className={`${panel} flex min-h-64 items-center justify-center`}><Loader2 className="h-7 w-7 animate-spin text-[color:var(--primary)]" /><span className="ml-3 text-[color:var(--text-muted)]">{t('daily.loading')}</span></div>

  if (isError && !task) {
    const code = (error as any)?.response?.data?.detail?.code
    return <section className={`${panel} mx-auto max-w-3xl text-center`}><HelpCircle className="mx-auto h-10 w-10 text-[color:var(--primary)]" /><h1 className="mt-3 text-2xl font-bold text-[color:var(--text)]">{code === 'not_enough_content' ? t('daily.notEnoughContent') : t('daily.loadError')}</h1><p className="mt-2 text-[color:var(--text-muted)]">{messageFor(error)}</p><button onClick={() => void refetch()} className={`${actionButton} mt-5`}><RotateCw className="h-4 w-4" />{t('shared.retry')}</button></section>
  }
  if (!task) return null

  if (screen === 'doing' && activeItem) return <div className="space-y-5">
    {hasMixedLevels && <p className={`${panel} mx-auto max-w-3xl !py-3 text-sm text-[color:var(--text-muted)]`}>{tDailyStatus('mixedLevels', { level: user?.current_jlpt_level })}</p>}
    <button type="button" onClick={() => setScreen('overview')} className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--primary)]"><ArrowLeft className="h-4 w-4" />{t('daily.overview')}</button>
    <div className={`${panel} mx-auto max-w-3xl !p-4 sm:!p-6`}>
      <div className="mb-2 flex justify-between text-sm font-semibold text-[color:var(--text-muted)]"><span>{t('daily.progress')}</span><span>{progress}/{task.progress.total_items}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:var(--accent)]"><div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${Math.min(100, progress / task.progress.total_items * 100)}%` }} /></div>
    </div>
    <DailyQuestion item={activeItem} index={currentIndex} total={task.items.length} busy={answerMutation.isLoading} result={activeFeedback} onAnswer={(answer, time) => answerMutation.mutate({ itemId: activeItem.id, answer, time })} onNext={() => {
      setFeedback(null)
      if (task.progress.answered_items + (activeFeedback ? 1 : 0) >= task.progress.total_items || activeFeedback?.all_answered) {
        setScreen('complete')
        completeMutation.mutate()
      }
    }} />
    {answerMutation.isError && <div className="mx-auto flex max-w-3xl justify-end"><button className={actionButton} onClick={() => answerMutation.mutate({ itemId: activeItem.id, answer: answerMutation.variables?.answer, time: answerMutation.variables?.time || 0 })} disabled={!answerMutation.variables || answerMutation.isLoading}><RotateCw className="h-4 w-4" />{t('daily.retryAnswer')}</button></div>}
    {task.progress.all_answered && !activeItem && <div className="text-center"><button className={actionButton} onClick={() => setScreen('complete')}>{t('daily.viewSummary')}<ArrowRight className="h-4 w-4" /></button></div>}
  </div>

  if (screen === 'complete' || completed) return <div className="mx-auto max-w-3xl space-y-5">
    <section className={`${panel} overflow-hidden text-center`}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--accent)]"><Trophy className="h-8 w-8 text-[color:var(--primary)]" /></div>
      <p className="mt-4 text-sm font-bold uppercase tracking-wider text-[color:var(--primary)]">{completed ? t('daily.alreadyCompleted') : t('daily.completed')}</p>
      <h1 className="mt-2 text-3xl font-extrabold text-[color:var(--text)]">{t('daily.pointsAwarded', { count: pointsAwarded })}</h1>
      <p className="mt-2 text-[color:var(--text-muted)]">{t('daily.streakLabel')}: <strong className="text-[color:var(--text)]">{t('daily.days', { count: completion?.streak ?? completedReward?.streak ?? 0 })}</strong></p>
      {breakdown && <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
        {[[t('daily.basePoints'), breakdown.base_points], [t('daily.correctPoints'), breakdown.correct_points], [t('daily.perfectBonus'), breakdown.perfect_bonus], [t('daily.streakBonus'), breakdown.streak_bonus + breakdown.streak_milestone_bonus]].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><span className="text-sm text-[color:var(--text-muted)]">{label}</span><strong className="text-[color:var(--text)]">+{value}</strong></div>)}
      </div>}
      <div className="mt-6 rounded-2xl bg-[color:var(--accent)] p-4 text-sm text-[color:var(--text-muted)]"><span className="font-semibold text-[color:var(--text)]">{t('daily.balance')}: {completeMutation.isLoading ? t('daily.updating') : completion?.balance ?? rewards?.points_balance ?? '—'} {t('daily.pointsUnit')}</span><p className="mt-1">{t('daily.nextTaskIn')} <span className="font-mono font-bold text-[color:var(--primary)]">{countdown}</span> ({t('daily.midnightHint')}).</p></div>
      {completeMutation.isLoading && <p className="mt-3 inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />{t('daily.finalizing')}</p>}
      {completeMutation.isError && !completed && <button type="button" onClick={() => completeMutation.mutate()} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--primary)]"><RotateCw className="h-4 w-4" />{t('daily.retryComplete')}</button>}
      <Link to="/shop" className={`${actionButton} mt-5`}><Sparkles className="h-4 w-4" />{t('daily.openShop')}</Link>
    </section>
  </div>

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[color:var(--primary)]">{t('daily.practiceEveryDay')}</p><h1 className="mt-1 text-3xl font-extrabold text-[color:var(--text)]">{t('daily.title')}</h1><p className="mt-2 flex items-center gap-2 text-[color:var(--text-muted)]"><CalendarDays className="h-4 w-4" />{formatDate(task.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {t('daily.serverDate')}</p></div>
      <div className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 py-3 font-bold text-[color:var(--primary)]"><Flame className="h-5 w-5" />{t('daily.streak', { count: task.reward?.streak ?? rewards?.current_streak ?? 0 })}</div>
    </header>
    {hasMixedLevels && <p className={`${panel} !py-3 text-sm text-[color:var(--text-muted)]`}>{tDailyStatus('mixedLevels', { level: user?.current_jlpt_level })}</p>}
    <section className={`${panel} grid gap-6 md:grid-cols-[1fr_auto] md:items-center`}>
      <div><div className="mb-2 flex justify-between"><h2 className="font-bold text-[color:var(--text)]">{t('daily.todayProgress')}</h2><span className="font-bold text-[color:var(--primary)]">{progress}/{task.progress.total_items}</span></div><div className="grid grid-cols-10 gap-1.5" aria-label={t('daily.answeredProgress', { progress, total: task.progress.total_items })}>
        {task.items.map((item) => <span key={item.id} className={`h-2.5 rounded-full ${item.answered ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--accent)]'}`} />)}
      </div><p className="mt-3 text-sm text-[color:var(--text-muted)]">{t('daily.progressHint')}</p></div>
      <button type="button" className={actionButton} onClick={() => {
        setFeedback(null)
        if (task.progress.all_answered) { setScreen('complete'); completeMutation.mutate() }
        else setScreen('doing')
      }} disabled={isFetching || completeMutation.isLoading}>{task.progress.all_answered ? t('daily.viewSummary') : task.progress.answered_items ? t('daily.continue') : t('daily.start')}<ArrowRight className="h-4 w-4" /></button>
    </section>
    <section className={panel}>
      <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[color:var(--primary)]" /><h2 className="font-bold text-[color:var(--text)]">{t('daily.lastSevenDays')}</h2></div>
      <div className="grid grid-cols-7 gap-2">{days.map((day) => {
        const record = historyByDate.get(day)
        const isToday = day === task.date
        return <div key={day} className={`rounded-2xl border p-2 text-center sm:p-3 ${isToday ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)]'}`}>
          <p className="text-[10px] font-semibold text-[color:var(--text-muted)] sm:text-xs">{formatDate(day, { weekday: 'short' })}</p>
          <div className="my-2 flex justify-center">{record ? <Flame className="h-5 w-5 text-[color:var(--primary)]" /> : <span className="h-5 w-5 rounded-full border border-[color:var(--border)]" />}</div>
          <p className="text-xs font-bold text-[color:var(--text)]">{record ? t('daily.days', { count: record.streak }) : isToday ? t('daily.today') : '—'}</p>
        </div>
      })}</div>
    </section>
    <p className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]"><Clock3 className="h-4 w-4" />{t('daily.serverTaskNote')} {isFetching ? t('daily.syncing') : ''}</p>
  </div>
}
