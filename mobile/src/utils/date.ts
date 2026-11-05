import type { Language } from '../api/types'

export const localeFor = (language: string) => language === 'en' ? 'en-US' : 'vi-VN'
export function formatTimestamp(value: string, language: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'
}
export function formatServerDate(value: string, language: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(localeFor(language), { ...options, timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
export function recentServerDates(serverDate: string, count: number) {
  const end = Date.parse(`${serverDate}T00:00:00Z`)
  return Array.from({ length: count }, (_, index) => new Date(end - (count - 1 - index) * 86400000).toISOString().slice(0, 10))
}
// Existing server APP_TIMEZONE defaults to Asia/Ho_Chi_Minh (UTC+07).
// Neither the date nor the countdown falls back to the device wall clock.
export function remainingToServerMidnight(serverDate: string, serverNowMs: number | undefined, receivedAtMs: number | undefined, monotonicNow: number) {
  if (serverNowMs === undefined || receivedAtMs === undefined) return null
  const nextMidnight = Date.parse(`${serverDate}T00:00:00+07:00`) + 86400000
  return Math.max(0, nextMidnight - serverNowMs - Math.max(0, monotonicNow - receivedAtMs))
}
export function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')
}
export const numberLabel = (value: number, language: Language) => new Intl.NumberFormat(localeFor(language)).format(value)
