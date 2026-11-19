import type { ReminderSettings } from '../../api/reminders'
import { validateReminderSettings } from './logic'

export const LOCAL_OWNER = 'senpaiai.study.v1'
export type LocalKind = 'daily_task' | 'streak_risk'
export interface Reservation { id: string; at: number; kind: LocalKind; spent: boolean }
export interface ReminderSnapshot {
  userId: number
  settings: ReminderSettings
  streak: number
  completedToday: boolean
  observedAt?: number
  language: 'vi' | 'en'
  allowed: boolean
}
export interface LocalPlanItem { id: string; at: number; kind: LocalKind; date: string }
const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(zone: string) {
  let value = formatters.get(zone)
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    formatters.set(zone, value)
  }
  return value
}
function parts(at: number, zone: string) {
  const result: Record<string, number> = {}
  for (const part of formatter(zone).formatToParts(at)) if (part.type !== 'literal') result[part.type] = Number(part.value)
  return result
}
export function localDate(at: number, zone: string) {
  const p = parts(at, zone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
export function localTime(at: number, zone: string) {
  const p = parts(at, zone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}
export function addCalendarDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
/** Resolve a wall time independently of the device zone. Gaps are skipped; folds use
 * the first occurrence only, even when that occurrence has already passed. */
export function wallTimeToInstant(date: string, time: string, zone: string): number | null {
  const target = Date.parse(`${date}T${time}:00Z`)
  const offsets = new Set<number>()
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = target + hours * 3600000
    const p = parts(probe, zone)
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - probe)
  }
  const matches = [...offsets].map(offset => target - offset).filter(at => localDate(at, zone) === date && localTime(at, zone) === time)
  return matches.length ? Math.min(...matches) : null
}
export function isQuiet(time: string, start: string, end: string) {
  if (start === end) return true
  return start < end ? time >= start && time < end : time >= start || time < end
}
export function timestampUTC(value: string) {
  return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}
export function buildLocalPlan(snapshot: ReminderSnapshot, now: number, spent: Reservation[] = [], completedAt: number[] = []): LocalPlanItem[] {
  const { settings: s } = snapshot
  if (!snapshot.allowed || !s.enabled || validateReminderSettings(s)) return []
  const today = localDate(now, s.timezone)
  const completed = new Set(completedAt.map(at => localDate(at, s.timezone)))
  if (snapshot.completedToday && localDate(snapshot.observedAt ?? now, s.timezone) === today) completed.add(today)
  const snooze = s.snooze_until ? timestampUTC(s.snooze_until) : 0
  // A malformed server snooze must not silently enable alerts.
  if (!Number.isFinite(snooze)) return []
  const result: LocalPlanItem[] = []
  for (let day = 0; day < 7; day++) {
    const date = addCalendarDays(today, day)
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
    if (!s.days_of_week.includes(weekday) || completed.has(date)) continue
    const used = spent.filter(entry => localDate(entry.at, s.timezone) === date)
    let count = used.length
    const candidates: { kind: LocalKind; time: string }[] = []
    if (s.types.includes('daily_task')) candidates.push({ kind: 'daily_task', time: s.reminder_time })
    if (s.types.includes('streak_risk') && snapshot.streak >= 2) candidates.push({ kind: 'streak_risk', time: s.reminder_time > '21:00' ? s.reminder_time : '21:00' })
    const instants = new Set<number>()
    for (const candidate of candidates) {
      if (count >= s.max_per_day || isQuiet(candidate.time, s.quiet_start, s.quiet_end) || used.some(entry => entry.kind === candidate.kind)) continue
      const at = wallTimeToInstant(date, candidate.time, s.timezone)
      if (at === null || at <= now || at < snooze || instants.has(at)) continue
      const id = `${LOCAL_OWNER}.${snapshot.userId}.${date}.${candidate.kind}`
      // Also prevent reusing a previously spent identifier after a clock/zone change.
      if (spent.some(entry => entry.id === id)) continue
      result.push({ id, at, kind: candidate.kind, date }); count++; instants.add(at)
    }
  }
  return result.sort((a, b) => a.at - b.at)
}

export interface LocalReminderData {
  owner: typeof LOCAL_OWNER
  userId: number
  date: string
  kind: LocalKind
  at: number
}
export function localReminderData(value: unknown): LocalReminderData | null {
  if (!value || typeof value !== 'object') return null
  const d = value as Record<string, unknown>
  return d.owner === LOCAL_OWNER && Number.isInteger(d.userId) && Number(d.userId) > 0 && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && (d.kind === 'daily_task' || d.kind === 'streak_risk') && typeof d.at === 'number' && Number.isFinite(d.at) ? d as unknown as LocalReminderData : null
}
export function localResponseTarget(data: unknown, userId: number | null) {
  const parsed = localReminderData(data)
  return parsed && parsed.userId === userId ? '/(tabs)/daily' as const : null
}
