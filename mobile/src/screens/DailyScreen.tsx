import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { dailyAPI, rewardsAPI } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
import { formatCountdown, formatServerDate, recentServerDates, remainingToServerMidnight } from '../utils/date'
import { mixedLevels } from '../features/daily/logic'
import { AppText, Badge, Button, Card, ErrorNotice, Muted, Progress, Screen, Title, styles } from '../components/ui'
import { RewardSummary } from '../components/daily/RewardSummary'

export function DailyScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const task = useQuery(['daily-overview', user?.id], dailyAPI.today, { enabled: !!user, refetchInterval: 60000, staleTime: 0 })
  const rewards = useQuery(['rewards', user?.id], rewardsAPI.me, { enabled: !!user })
  const history = useQuery(['daily-history', user?.id, 7], () => dailyAPI.history(7), { enabled: !!user })
  const [now, setNow] = useState(() => performance.now())
  const current = task.data
  const remaining = current ? remainingToServerMidnight(current.date, current.server_now_ms, current.received_at_ms, now) : null
  useEffect(() => {
    if (current?.status !== 'completed') return
    const timer = setInterval(() => setNow(performance.now()), 1000)
    return () => clearInterval(timer)
  }, [current?.status])
  const refetchTask = task.refetch
  useEffect(() => { if (remaining === 0) void refetchTask() }, [remaining, refetchTask])
  const refresh = () => { void task.refetch(); void rewards.refetch(); void history.refetch(); setNow(performance.now()) }
  return <Screen pullToRefresh refreshing={task.isFetching || rewards.isFetching || history.isFetching} onRefresh={refresh}>
    <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}><View><Muted>{t('daily.practiceEveryDay')}</Muted><Title>{t('daily.title')}</Title></View><Ionicons name="flame-outline" size={36} color={colors.primary} /></View>
    {task.isLoading && <AppText>{t('daily.loading')}</AppText>}
    {task.isError && <ErrorNotice message={getErrorMessage(task.error, i18n)} retry={refresh} />}
    {current && <>
      <Muted>{formatServerDate(current.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Muted>
      <View style={styles.row}><Badge>{t('daily.streak', { count: rewards.data?.current_streak ?? current.reward?.streak ?? 0 })}</Badge><Badge>{t('daily.balance')}: {rewards.data?.points_balance ?? '—'}</Badge></View>
      {rewards.isError && <ErrorNotice message={getErrorMessage(rewards.error, i18n)} retry={() => void rewards.refetch()} />}
      {mixedLevels(current, user?.current_jlpt_level) && <Muted>{i18n.t('mixedLevels', { ns: 'dailyStatus', level: user?.current_jlpt_level })}</Muted>}
      <Card><Title>{t(current.status === 'completed' ? 'daily.alreadyCompleted' : 'daily.todayProgress')}</Title><AppText>{t('daily.answeredProgress', { progress: current.progress.answered_items, total: current.progress.total_items })}</AppText><Progress current={current.progress.answered_items} total={current.progress.total_items} /><Muted>{t('daily.progressHint')}</Muted><Button title={t(current.status === 'completed' || current.progress.all_answered ? 'daily.viewSummary' : current.progress.answered_items ? 'daily.continue' : 'daily.start')} disabled={task.isFetching} onPress={() => router.push('/daily-exercise')} /></Card>
      {current.reward && <RewardSummary reward={current.reward} balance={rewards.data?.points_balance} />}
      {current.status === 'completed' && <Card><AppText>{t('daily.nextTaskIn')}</AppText><Title>{remaining === null ? '—' : formatCountdown(remaining)}</Title><Muted>{remaining === null ? mobile('phase1.daily.noServerTime') : t('daily.midnightHint')}</Muted></Card>}
      <Card>
        <Title>{t('daily.lastSevenDays')}</Title>
        {history.isError && <ErrorNotice message={getErrorMessage(history.error, i18n)} retry={() => void history.refetch()} />}
        <View style={[styles.row, { justifyContent: 'space-between', gap: 4 }]}>{recentServerDates(current.date, 7).map((date) => {
          const record = history.data?.find((entry) => entry.date === date)
          return <View key={date} accessibilityLabel={mobile(record ? 'phase1.daily.historyDone' : 'phase1.daily.historyPending', { date: formatServerDate(date, i18n.language), points: record?.points_awarded ?? 0 })} style={{ flex: 1, alignItems: 'center', gap: 7, borderRadius: 12, paddingVertical: 10, borderWidth: date === current.date ? 1 : 0, borderColor: colors.primary, backgroundColor: record ? colors.accent : colors.bgElevated }}><AppText style={{ fontSize: 11 }}>{formatServerDate(date, i18n.language, { weekday: 'short' })}</AppText><Ionicons name={record ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={record ? colors.primary : colors.textMuted} /><AppText style={{ fontSize: 12 }}>{formatServerDate(date, i18n.language, { day: 'numeric' })}</AppText></View>
        })}</View>
        {history.isSuccess && !history.data.length && <Muted>{mobile('phase1.daily.historyEmpty')}</Muted>}
      </Card>
    </>}
  </Screen>
}
