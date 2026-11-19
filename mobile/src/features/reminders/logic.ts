import type { i18n } from 'i18next'
import type { AppNotification, MobileReminderSettings, ReminderSettings } from '../../api/reminders'
export const reminderTypes = ['daily_task', 'streak_risk', 'review_due'] as const

// An allowlist, never pass a server URL directly to the router or OS.
export const notificationRoutes = {
  '/daily': '/(tabs)/daily',
  '/': '/(tabs)/daily',
  '/library': '/(tabs)/library',
  '/grammar': '/grammar',
  '/kanji': '/kanji',
  '/settings/reminders': '/reminder-settings',
} as const
export function notificationTarget(url: string | null | undefined) {
  if (!url || !url.startsWith('/') || url.startsWith('//') || /[\\\s%]/.test(url)) return '/notifications'
  const path = url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
  return notificationRoutes[path as keyof typeof notificationRoutes] ?? '/notifications'
}
export function notificationCopy(item: AppNotification, translator: i18n) {
  const kind = reminderTypes.includes(item.type as typeof reminderTypes[number]) ? item.type : 'unknown'
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  const options = { ns: 'common', streak: number(item.data?.streak), count: number(item.data?.review_count) }
  return { title: translator.t(`notificationTypes.${kind}.title`, options), body: translator.t(`notificationTypes.${kind}.body`, options) }
}
export const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
export function validTimezone(value: string) {
  if (!value || value !== value.trim() || /^[+-]/.test(value)) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true } catch { return false }
}
export function validateReminderSettings(value: MobileReminderSettings): string | undefined {
  if (![value.reminder_time, value.quiet_start, value.quiet_end].every(validTime)) return 'timeError'
  if (!validTimezone(value.timezone)) return 'timezoneError'
  if (!Number.isInteger(value.max_per_day) || value.max_per_day < 1 || value.max_per_day > 20) return 'limitError'
  if (new Set(value.days_of_week).size !== value.days_of_week.length || value.days_of_week.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return 'daysError'
  if (value.types.some(type => !reminderTypes.includes(type))) return 'typesError'
  return undefined
}
export function mobileSettings(value: ReminderSettings): MobileReminderSettings {
  return { enabled: value.enabled, timezone: value.timezone, reminder_time: value.reminder_time,
    days_of_week: [...value.days_of_week], types: [...value.types], quiet_start: value.quiet_start,
    quiet_end: value.quiet_end, max_per_day: value.max_per_day }
}
// API has no cursor/offset; progressively fetch a larger newest-first window.
export function nextNotificationLimit(limit: number, received: number) {
  return received >= limit && limit < 100 ? Math.min(100, limit + 20) : null
}
export function relativeNotificationTime(value: string | null, now: number, translator: i18n) {
  if (!value) return translator.t('reminders.unknownTime', { ns: 'mobile' })
  // SQL timestamps can omit UTC offset. Server stores UTC, never interpret as device time.
  const timestamp = Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  if (!Number.isFinite(timestamp)) return translator.t('reminders.unknownTime', { ns: 'mobile' })
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  const unit = seconds < 60 ? 'now' : seconds < 3600 ? 'minutes' : seconds < 86400 ? 'hours' : 'days'
  const count = unit === 'minutes' ? Math.floor(seconds / 60) : unit === 'hours' ? Math.floor(seconds / 3600) : Math.floor(seconds / 86400)
  return translator.t(`reminders.relative.${unit}`, { ns: 'mobile', count })
}
