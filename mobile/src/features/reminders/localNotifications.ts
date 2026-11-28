import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { i18n } from '../../i18n'
import { LOCAL_OWNER, type LocalPlanItem, type ReminderSnapshot } from './planner'
import { parseLedger, type LocalReminderIO } from './LocalReminderController'

export const LOCAL_CHANNEL = 'senpaiai-study'
export type LocalPermission = 'undetermined' | 'denied' | 'granted' | 'provisional' | 'unsupported'
export const consentKey = (userId: number) => `${LOCAL_OWNER}.consent.${userId}`
const ledgerKey = (userId: number) => `${LOCAL_OWNER}.ledger.${userId}`
export function permissionFrom(value: Notifications.NotificationPermissionsStatus): LocalPermission {
  if (value.ios) {
    switch (value.ios.status) {
      case Notifications.IosAuthorizationStatus.AUTHORIZED: return 'granted'
      case Notifications.IosAuthorizationStatus.PROVISIONAL:
      case Notifications.IosAuthorizationStatus.EPHEMERAL: return 'provisional'
      case Notifications.IosAuthorizationStatus.DENIED: return 'denied'
      default: return 'undetermined'
    }
  }
  return value.granted ? 'granted' : value.status === 'denied' ? 'denied' : 'undetermined'
}
export const permitted = (permission: LocalPermission) => permission === 'granted' || permission === 'provisional'
export async function readPermission(): Promise<LocalPermission> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unsupported'
  const permission = permissionFrom(await Notifications.getPermissionsAsync())
  if (Platform.OS === 'android' && permitted(permission)) {
    const channel = await Notifications.getNotificationChannelAsync(LOCAL_CHANNEL)
    if (channel?.importance === Notifications.AndroidImportance.NONE) return 'denied'
  }
  return permission
}
export const hasLocalConsent = async (userId: number) => await AsyncStorage.getItem(consentKey(userId)) === '1'
export async function ensureLocalChannel(language: 'vi' | 'en') {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(LOCAL_CHANNEL, {
    name: i18n.t('localReminders.channel', { ns: 'mobile', lng: language }),
    description: i18n.t('localReminders.channelDescription', { ns: 'mobile', lng: language }),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null, enableVibrate: false,
  })
}
export async function requestLocalPermission(userId: number, language: 'vi' | 'en') {
  await AsyncStorage.setItem(consentKey(userId), '1')
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unsupported' as const
  // Android 13+ needs a channel before showing its notification permission prompt.
  await ensureLocalChannel(language)
  const current = await Notifications.getPermissionsAsync()
  if (permitted(permissionFrom(current)) || !current.canAskAgain) return permissionFrom(current)
  return permissionFrom(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } }))
}
export async function cancelLocalNotifications() {
  const pending = await Notifications.getAllScheduledNotificationsAsync()
  for (const item of pending) if (item.identifier.startsWith(`${LOCAL_OWNER}.`)) await Notifications.cancelScheduledNotificationAsync(item.identifier)
  const displayed = await Notifications.getPresentedNotificationsAsync()
  for (const item of displayed) if (item.request.identifier.startsWith(`${LOCAL_OWNER}.`)) await Notifications.dismissNotificationAsync(item.request.identifier)
}
export function localNotificationCopy(kind: 'daily_task' | 'streak_risk', language: 'vi' | 'en') {
  return { title: i18n.t(`localReminders.copy.${kind}.title`, { ns: 'mobile', lng: language }), body: i18n.t(`localReminders.copy.${kind}.body`, { ns: 'mobile', lng: language }) }
}
export function createLocalIO(state: LocalReminderIO['state']): LocalReminderIO {
  return {
    now: Date.now,
    read: async userId => parseLedger(await AsyncStorage.getItem(ledgerKey(userId))),
    write: async (userId, value) => { await AsyncStorage.setItem(ledgerKey(userId), JSON.stringify(value)) },
    cancel: cancelLocalNotifications,
    schedule: async (item: LocalPlanItem, snapshot: ReminderSnapshot) => {
      await Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: { ...localNotificationCopy(item.kind, snapshot.language), sound: false, data: { owner: LOCAL_OWNER, userId: snapshot.userId, date: item.date, kind: item.kind, at: item.at } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: LOCAL_CHANNEL },
      })
    },
    state,
  }
}

// Foreground uses a compact, translated in-app card, with no sound or system banner.
// Background/terminated presentation is handled by the OS from the one-off schedule.
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false }) })
