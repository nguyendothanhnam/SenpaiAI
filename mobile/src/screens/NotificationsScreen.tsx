import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { notificationsAPI, type AppNotification } from '../api/reminders'
import { queryClient } from '../api/services'
import { notificationKey, useNotifications } from '../features/reminders/NotificationProvider'
import { nextNotificationLimit, notificationCopy, notificationTarget, relativeNotificationTime } from '../features/reminders/logic'
import { AppText, Button, Card, ErrorNotice, Loading, Muted, Screen, Title, styles } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'

export function NotificationsScreen() {
  const { t, i18n } = useTranslation('mobile')
  const { t: common } = useTranslation('common')
  const { user } = useAuth()
  const { active, count } = useNotifications()
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  useFocusEffect(useCallback(() => {
    setFocused(true)
    void queryClient.invalidateQueries([...notificationKey, user?.id, 'count'])
    return () => setFocused(false)
  }, [user?.id]))
  const [limit, setLimit] = useState(20)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>()
  const lock = useRef(false)
  const enabled = active && focused
  const list = useQuery([...notificationKey, user?.id, 'list', limit], ({ signal }) => notificationsAPI.list(limit, signal), {
    enabled, keepPreviousData: true, staleTime: 0, refetchInterval: enabled ? 60_000 : false, refetchIntervalInBackground: false,
  })
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [enabled])
  async function run(action: () => Promise<unknown>, item?: AppNotification) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFailure(undefined)
    try {
      await action()
      await queryClient.invalidateQueries(notificationKey)
      if (item) {
        const target = notificationTarget(item.url)
        if (target !== '/notifications') router.push(target)
      }
    } catch (error) { setFailure(error) }
    finally { lock.current = false; setBusy(false) }
  }
  if (list.isLoading) return <Loading />
  const items = list.data ?? []
  const next = nextNotificationLimit(limit, items.length)
  return <Screen pullToRefresh refreshing={list.isFetching} onRefresh={() => { if (!busy) void list.refetch() }}>
    <Title>{common('notifications.title')}</Title>
    <Button secondary title={t('reminders.title')} onPress={() => router.push('/reminder-settings')} />
    <Button title={common('notifications.markAll')} disabled={busy || !count || !active} onPress={() => void run(notificationsAPI.readAll)} />
    {!!failure && <ErrorNotice message={getErrorMessage(failure, i18n)} />}
    {list.isError && <ErrorNotice message={getErrorMessage(list.error, i18n)} retry={() => void list.refetch()} />}
    {!list.isError && !items.length && <Muted>{common('notifications.empty')}</Muted>}
    {items.map(item => {
      const copy = notificationCopy(item, i18n)
      return <Card key={item.id} style={{ borderColor: item.read_at ? colors.border : colors.primary }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${copy.title}. ${t(item.read_at ? 'reminders.read' : 'reminders.unread')}`} disabled={busy || !active} onPress={() => void run(() => item.read_at ? Promise.resolve() : notificationsAPI.read(item.id), item)} style={{ gap: 8, minHeight: 48 }}>
          <AppText style={{ fontWeight: item.read_at ? '400' : '700' }}>{copy.title}</AppText>
          <AppText>{copy.body}</AppText>
          <Muted>{t(item.read_at ? 'reminders.read' : 'reminders.unread')}</Muted>
          <Muted>{relativeNotificationTime(item.created_at, now, i18n)}</Muted>
        </Pressable>
        <View style={styles.row}>
          {!item.read_at && <Button secondary title={t('reminders.markRead')} disabled={busy || !active} onPress={() => void run(() => notificationsAPI.read(item.id))} />}
          <Button secondary title={t('reminders.remove')} disabled={busy || !active} onPress={() => void run(() => notificationsAPI.remove(item.id))} />
        </View>
      </Card>
    })}
    {next !== null && !list.isError && <Button secondary title={t('reminders.loadMore')} disabled={list.isFetching || busy} onPress={() => setLimit(next)} />}
    {limit === 100 && items.length >= 100 && <Muted>{t('reminders.listLimit')}</Muted>}
  </Screen>
}
