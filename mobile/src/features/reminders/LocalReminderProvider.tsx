import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router, useRootNavigationState } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import { remindersAPI, type ReminderSettings } from '../../api/reminders'
import { dailyAPI, rewardsAPI } from '../../api/services'
import { AppText, Button, Card } from '../../components/ui'
import { LocalReminderController, localReminderLifecycle, type LocalScheduleState } from './LocalReminderController'
import { localReminderData, localResponseTarget, type LocalKind, type ReminderSnapshot } from './planner'
import { createLocalIO, ensureLocalChannel, hasLocalConsent, localNotificationCopy, permitted, readPermission, requestLocalPermission, type LocalPermission } from './localNotifications'

interface LocalContext {
  permission: LocalPermission
  optedIn: boolean
  requesting: boolean
  failed: boolean
  state: LocalScheduleState
  enable: () => Promise<void>
  refresh: (settings?: ReminderSettings) => Promise<void>
}
const Context = createContext<LocalContext | null>(null)
export function LocalReminderProvider({ children }: PropsWithChildren) {
  const { status, user } = useAuth()
  const { language, ready } = useLanguage()
  const nav = useRootNavigationState()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('mobile')
  const [state, setState] = useState<LocalScheduleState>({ status: 'idle', count: 0 })
  const [permission, setPermission] = useState<LocalPermission>('undetermined')
  const [optedIn, setOptedIn] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [banner, setBanner] = useState<{ kind: LocalKind; userId: number } | null>(null)
  const mounted = useRef(true)
  const controller = useRef<LocalReminderController | null>(null)
  if (!controller.current) controller.current = new LocalReminderController(createLocalIO(next => { if (mounted.current) setState(next) }))
  const current = useRef({ userId: user?.id, status, language, ready })
  current.current = { userId: user?.id, status, language, ready }
  const revision = useRef(0)
  const permissionLock = useRef(false)
  const lastSnapshot = useRef<ReminderSnapshot | null>(null)
  const handledResponses = useRef(new Set<string>())
  const invalidateRefresh = useCallback(() => { revision.current++; controller.current!.invalidate() }, [])
  const refresh = useCallback(async (settings?: ReminderSettings) => {
    const context = current.current
    if (!context.userId || context.status !== 'authenticated' || !context.ready) return
    const version = ++revision.current
    controller.current!.invalidate()
    setFailed(false)
    let allowed = false
    let networkLoaded = false
    let verifiedSettings = settings
    try {
      // Disabling must cancel immediately, even when the other APIs are unreachable.
      if (settings && !settings.enabled) { lastSnapshot.current = null; await controller.current!.replace(null) }
      const [access, consent] = await Promise.all([readPermission(), hasLocalConsent(context.userId)])
      if (version !== revision.current) return
      setPermission(access); setOptedIn(consent)
      if (!permitted(access) || !consent) { await controller.current!.replace(null); return }
      allowed = true
      const cached = lastSnapshot.current
      if (cached?.userId === context.userId && (settings || cached.language !== context.language)) {
        const next = { ...cached, settings: settings ?? cached.settings, language: context.language }
        lastSnapshot.current = next
        await controller.current!.replace(next)
        if (version !== revision.current) return
      } else if (settings && !cached) {
        // No trusted task snapshot yet: remove old settings before network I/O.
        await controller.current!.replace(null)
      }
      const saved = settings ?? await remindersAPI.settings()
      verifiedSettings = saved
      if (version !== revision.current) return
      if (!saved.enabled) { lastSnapshot.current = null; await controller.current!.replace(null); return }
      const previous = lastSnapshot.current
      if (previous?.userId === context.userId && JSON.stringify(previous.settings) !== JSON.stringify(saved)) {
        const next = { ...previous, settings: saved, language: context.language }
        lastSnapshot.current = next
        await controller.current!.replace(next)
        if (version !== revision.current) return
      } else if (!previous) {
        await controller.current!.replace(null)
        if (version !== revision.current) return
      }
      const [daily, rewards] = await Promise.all([dailyAPI.today(), rewardsAPI.me()])
      networkLoaded = true
      if (version !== revision.current || context.userId !== current.current.userId || current.current.status !== 'authenticated') return
      await ensureLocalChannel(context.language)
      if (version !== revision.current) return
      const snapshot: ReminderSnapshot = { userId: context.userId, settings: saved, language: context.language, streak: rewards.current_streak, completedToday: daily.status === 'completed', observedAt: Date.now(), allowed: true }
      lastSnapshot.current = snapshot
      await controller.current!.replace(snapshot)
    } catch {
      if (mounted.current && version === revision.current) {
        // Network loss must not keep the previous language/settings in an already
        // verified account snapshot. Never borrow data from a different account.
        const cached = lastSnapshot.current
        if (allowed && !networkLoaded && cached?.userId === context.userId) {
          const next = { ...cached, settings: verifiedSettings ?? cached.settings, language: context.language }
          lastSnapshot.current = next
          await controller.current!.replace(next).catch(() => undefined)
        }
        setFailed(true)
      }
    }
  }, [])
  const enable = useCallback(async () => {
    const context = current.current
    if (!context.userId || permissionLock.current) return
    permissionLock.current = true; setRequesting(true); setFailed(false)
    try {
      await requestLocalPermission(context.userId, context.language)
      if (context.userId === current.current.userId) await refresh()
    } catch { if (mounted.current) setFailed(true) }
    finally { permissionLock.current = false; if (mounted.current) setRequesting(false) }
  }, [refresh])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; invalidateRefresh() }
  }, [invalidateRefresh])
  useEffect(() => localReminderLifecycle.attach({
    clear: async () => { revision.current++; lastSnapshot.current = null; setBanner(null); await controller.current!.replace(null) },
    complete: async (userId, streak) => {
      if (current.current.userId !== userId) return
      revision.current++; setBanner(null)
      if (lastSnapshot.current?.userId === userId) lastSnapshot.current = { ...lastSnapshot.current, completedToday: true, observedAt: Date.now(), streak }
      await controller.current!.complete(userId, streak)
      void refresh()
    },
  }), [refresh])
  useEffect(() => {
    if (status === 'anonymous' || status === 'storage-error') {
      revision.current++; lastSnapshot.current = null; setBanner(null); setOptedIn(false)
      void controller.current!.replace(null).catch(() => setFailed(true))
    } else if (status === 'authenticated' && ready) void refresh()
    return invalidateRefresh
  }, [user?.id, status, language, ready, refresh, invalidateRefresh])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void refresh()
      else setBanner(null)
    })
    // Extend the 7-day window and catch server-side changes while the app stays open.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh() }, 15 * 60_000)
    return () => { subscription.remove(); clearInterval(timer) }
  }, [refresh])
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      if (AppState.currentState !== 'active') return
      void controller.current!.present(notification.request.content.data, notification.request.identifier).then(show => {
        const data = localReminderData(notification.request.content.data)
        if (show && data && mounted.current && current.current.userId === data.userId && AppState.currentState === 'active') setBanner({ kind: data.kind, userId: data.userId })
      }).catch(() => setFailed(true))
    })
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), 7000)
    return () => clearTimeout(timer)
  }, [banner])
  useEffect(() => {
    // Retain a cold-start response while token restoration waits for connectivity.
    if (!nav?.key || (status !== 'authenticated' && status !== 'anonymous')) return
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`
      if (handledResponses.current.has(responseKey)) return
      handledResponses.current.add(responseKey)
      const target = localResponseTarget(response.notification.request.content.data, status === 'authenticated' ? user?.id ?? null : null)
      if (target) { setBanner(null); router.push(target) }
      Notifications.clearLastNotificationResponse()
    }
    handle(Notifications.getLastNotificationResponse())
    const subscription = Notifications.addNotificationResponseReceivedListener(handle)
    return () => subscription.remove()
  }, [nav?.key, status, user?.id])
  const copy = banner ? localNotificationCopy(banner.kind, language) : null
  return <Context.Provider value={{ permission, optedIn, requesting, failed, state, enable, refresh }}>
    {children}
    {banner && banner.userId === user?.id && copy && <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: insets.left + 12, right: insets.right + 12, zIndex: 100 }}><Card accessibilityLiveRegion="polite"><AppText style={{ fontWeight: '700' }}>{copy.title}</AppText><AppText>{copy.body}</AppText><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Button title={t('localReminders.openDaily')} onPress={() => { setBanner(null); router.push('/(tabs)/daily') }} /><Button secondary title={t('localReminders.dismiss')} onPress={() => setBanner(null)} /></View></Card></View>}
  </Context.Provider>
}
export function useLocalReminders() {
  const value = useContext(Context)
  if (!value) throw new Error('LocalReminderProvider is missing')
  return value
}
