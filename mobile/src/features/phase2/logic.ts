import type { Conversation, Level, Pattern, Source } from '../../api/phase2Types'
import { levels } from '../../api/phase2Types'

export function nearestLevel(preferred: string, patterns: Partial<Record<Level, Pattern[]>>): Level | undefined {
  const index = Math.max(0, levels.indexOf(preferred as Level))
  return levels.filter(level => patterns[level]?.some(p => Object.values(p.question_counts).some(n => n > 0)))
    .sort((a, b) => Math.abs(levels.indexOf(a) - index) - Math.abs(levels.indexOf(b) - index))[0]
}
export function publicSources(sources: Source[] = []) {
  return sources.filter(s => !/deterministic_chat|internal|system_rule/i.test(s.type || '') && !/intent rules|internal rules|system rules/i.test(s.title || ''))
}
export function timeGroup(value: string, now = new Date()): string {
  const date = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  const days = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? 'week' : days < 30 ? 'month' : 'older'
}
export function relativeTime(value: string, t: (key: string, values?: { count: number }) => string, now = Date.now()) {
  const time = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  // Avoid Intl.RelativeTimeFormat: it is absent in some Expo Go Hermes runtimes.
  if (minutes < 1) return t('phase2.justNow')
  const n = minutes < 60 ? minutes : minutes < 1440 ? Math.floor(minutes / 60) : Math.floor(minutes / 1440)
  return t(minutes < 60 ? 'phase2.minutesAgo' : minutes < 1440 ? 'phase2.hoursAgo' : 'phase2.daysAgo', { count: n })
}
export function unique<T extends { id: number | string }>(items: T[]): T[] { return [...new Map(items.map(item => [item.id, item])).values()] }
export function groupConversations(items: Conversation[], now = new Date()) {
  return items.map(item => ({ ...item, group: item.is_pinned ? 'pinned' : item.folder_id ? `folder:${item.folder_id}` : timeGroup(item.last_activity_at, now) }))
}
