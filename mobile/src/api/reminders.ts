import { api } from './services'
import { reminderTypes } from '../features/reminders/logic'

export { reminderTypes }
export type ReminderType = typeof reminderTypes[number]
export interface ReminderSettings {
  enabled: boolean
  timezone: string
  reminder_time: string
  days_of_week: number[]
  types: ReminderType[]
  quiet_start: string
  quiet_end: string
  push_enabled: boolean
  max_per_day: number
  snooze_until: string | null
}
export interface SuggestedTime {
  suggested_time: string | null
  sample_count: number
  hour_count: number
  timezone: string
}
export interface AppNotification {
  id: number
  type: string
  title: string
  body: string
  url: string | null
  data: Record<string, unknown>
  created_at: string | null
  read_at: string | null
}
// Preserve browser push and server snooze: mobile does not own these fields.
export type MobileReminderSettings = Omit<ReminderSettings, 'push_enabled' | 'snooze_until'>
export const remindersAPI = {
  settings: (signal?: AbortSignal) => api.get<ReminderSettings>('/reminders/settings', { signal }).then(r => r.data),
  save: (settings: MobileReminderSettings) => api.put<ReminderSettings>('/reminders/settings', settings).then(r => r.data),
  suggested: (signal?: AbortSignal) => api.get<SuggestedTime>('/reminders/suggested-time', { signal }).then(r => r.data),
}
export const notificationsAPI = {
  list: (limit: number, signal?: AbortSignal) => api.get<AppNotification[]>('/notifications/', { params: { limit }, signal }).then(r => r.data),
  count: (signal?: AbortSignal) => api.get<{ unread_count: number }>('/notifications/unread-count', { signal }).then(r => r.data),
  read: (id: number) => api.post<AppNotification>(`/notifications/${id}/read`).then(r => r.data),
  readAll: () => api.post<{ updated: number }>('/notifications/read-all'),
  remove: (id: number) => api.delete(`/notifications/${id}`),
}
