import { useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import { router, usePreventRemove } from 'expo-router'
import { useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { dailyAPI, queryClient, rewardsAPI } from '../api/services'
import type { DailyAnswerResult, DailyOverview, Rewards } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { DailySubmission } from '../features/daily/submission'
import { detailCode, mixedLevels, nextUnanswered } from '../features/daily/logic'
import { getErrorMessage } from '../utils/getErrorMessage'
import { AppText, Button, ErrorNotice, Loading, Muted, Progress, Screen, Title } from '../components/ui'
import { DailyQuestion } from '../components/daily/DailyQuestion'
import { RewardSummary } from '../components/daily/RewardSummary'

export function DailyExerciseScreen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const task = useQuery(['daily-overview', user?.id], dailyAPI.today, { enabled: !!user, staleTime: 0 })
  const rewards = useQuery(['rewards', user?.id], rewardsAPI.me, { enabled: !!user })
  const [feedback, setFeedback] = useState<{ itemId: number; result: DailyAnswerResult } | null>(null)
  const [allowLeave, setAllowLeave] = useState(false)
  const coordinator = useRef(new DailySubmission(dailyAPI))
  const attemptedCompletion = useRef<number | null>(null)
  const answerLock = useRef(false)
  const previousTask = useRef<number | null>(null)
  const current = task.data
  const activeItem = current?.items.find((item) => item.id === feedback?.itemId) ?? (current ? nextUnanswered(current) : undefined)
  const completion = useMutation(dailyAPI.complete, {
    retry: false,
    onSuccess: (result) => {
      const key = ['rewards', user?.id]
      const existing = queryClient.getQueryData<Rewards>(key)
      if (existing) queryClient.setQueryData(key, { ...existing, points_balance: result.balance, current_streak: result.streak })
      for (const prefix of ['daily-overview', 'daily-history', 'rewards', 'profile']) void queryClient.invalidateQueries([prefix, user?.id])
    },
    onError: (error) => { if (['task_expired', 'items_incomplete'].includes(detailCode(error) ?? '')) { setFeedback(null); void task.refetch() } },
  })
  const answering = useMutation(({ snapshot, itemId, answer, time }: { snapshot: DailyOverview; itemId: number; answer: unknown; time: number }) => {
    return coordinator.current.submit(snapshot, itemId, answer, time)
  }, {
    retry: false,
    onSuccess: (result, variables) => {
      const latest = queryClient.getQueryData<DailyOverview>(['daily-overview', user?.id])
      if (latest?.task_id !== variables.snapshot.task_id) return
      setFeedback({ itemId: variables.itemId, result }); void task.refetch()
    },
    onError: (error) => { if (detailCode(error) === 'task_expired') { setFeedback(null); setAllowLeave(true); disablePrevention(); void task.refetch(); router.replace('/(tabs)/daily') } },
    onSettled: () => { answerLock.current = false },
  })
  const resetAnswer = answering.reset
  const resetCompletion = completion.reset
  useEffect(() => {
    if (!current) return
    if (previousTask.current !== null && previousTask.current !== current.task_id) {
      setFeedback(null); resetAnswer(); resetCompletion(); setAllowLeave(false); attemptedCompletion.current = null
    }
    previousTask.current = current.task_id
  }, [current, resetAnswer, resetCompletion])
  const finish = completion.mutate
  useEffect(() => {
    if (!current || current.status === 'completed' || !current.progress.all_answered || feedback || attemptedCompletion.current === current.task_id) return
    attemptedCompletion.current = current.task_id
    finish()
  }, [current, feedback, finish])
  const refetchTask = task.refetch
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refetchTask() })
    return () => subscription.remove()
  }, [refetchTask])
  const disablePrevention = usePreventRemove(!!user && !!current && current.status !== 'completed' && !allowLeave, ({ repeat }) => {
    Alert.alert(mobile('phase1.daily.exitTitle'), mobile('phase1.daily.exitHint'), [{ text: mobile('phase1.daily.stay'), style: 'cancel' }, { text: mobile('phase1.daily.leave'), onPress: () => { setAllowLeave(true); repeat() } }])
  })
  if (task.isLoading) return <Loading />
  if (!current) return <Screen><ErrorNotice message={getErrorMessage(task.error, i18n)} retry={() => void task.refetch()} /></Screen>
  const activeFeedback = feedback?.itemId === activeItem?.id ? feedback?.result : undefined
  const reward = completion.data ?? current.reward
  return <Screen>
    <Button secondary title={t('daily.overview')} onPress={() => router.back()} />
    {task.isError && <ErrorNotice message={getErrorMessage(task.error, i18n)} retry={() => void task.refetch()} />}
    {mixedLevels(current, user?.current_jlpt_level) && <Muted>{i18n.t('mixedLevels', { ns: 'dailyStatus', level: user?.current_jlpt_level })}</Muted>}
    <Progress current={current.progress.answered_items} total={current.progress.total_items} />
    {activeItem && current.status !== 'completed' && <DailyQuestion key={`${current.task_id}:${activeItem.id}`} item={activeItem} index={current.items.findIndex((item) => item.id === activeItem.id)} total={current.items.length} busy={answering.isLoading || answering.isError} result={activeFeedback} onAnswer={(answer, time) => {
      if (answerLock.current) return
      answerLock.current = true
      answering.mutate({ snapshot: current, itemId: activeItem.id, answer, time })
    }} onNext={() => { void task.refetch().then((fresh) => { if (!fresh.isError) { setFeedback(null); answering.reset() } }) }} />}
    {answering.isError && <><ErrorNotice message={getErrorMessage(answering.error, i18n)} retry={() => { if (answering.variables && !answerLock.current) { answerLock.current = true; answering.mutate(answering.variables) } }} /><Muted>{mobile('phase1.daily.answerRetryHint')}</Muted></>}
    {!activeItem || current.status === 'completed' ? <>
      <Title>{t(current.status === 'completed' ? 'daily.alreadyCompleted' : 'daily.completed')}</Title>
      {completion.isLoading && <AppText>{mobile('phase1.daily.completionPending')}</AppText>}
      {reward && <RewardSummary reward={reward} balance={completion.data?.balance ?? rewards.data?.points_balance} />}
      {completion.isError && <ErrorNotice message={getErrorMessage(completion.error, i18n)} retry={() => completion.mutate()} />}
      {!reward && !completion.isLoading && <Button title={mobile('phase1.daily.finish')} onPress={() => completion.mutate()} />}
    </> : null}
  </Screen>
}
