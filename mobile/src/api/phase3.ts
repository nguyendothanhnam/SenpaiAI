import { api } from './services'
import type { User } from './types'
import type { KanjiEntry, KanjiPage, KanjiQuestion, StrokeData } from './phase3Types'
import { shopAPI } from './shop'
export const kanjiAPI = {
  list: (jlpt: string, search = '', offset = 0, limit = 24) => api.get<KanjiPage>('/kanji/list', { params: { jlpt, search: search || undefined, offset, limit } }).then(r => r.data),
  levels: async () => {
    const levels = await Promise.all(['N5', 'N4', 'N3'].map(async jlpt => ({ level: jlpt, total: (await kanjiAPI.list(jlpt, '', 0, 1)).total })))
    return levels.filter(l => l.total > 0)
  },
  detail: (kanji: string) => api.get<KanjiEntry>(`/kanji/${encodeURIComponent(kanji)}`).then(r => r.data),
  strokes: (kanji: string) => api.get<StrokeData>(`/kanji/${encodeURIComponent(kanji)}/stroke-order`).then(r => r.data),
  quiz: (jlpt: string, count: number, mode = 'meaning_match') => api.get<{ items: KanjiQuestion[] }>('/kanji/quiz', { params: { jlpt, count, mode } }).then(r => r.data.items),
}
export const personalAPI = {
  update: (payload: { username: string; current_jlpt_level?: string; learning_goals: string[] }) => api.put<User>('/auth/me', payload).then(r => r.data),
  export: () => api.get<Record<string, unknown>>('/auth/me/export').then(r => r.data),
  reset: () => api.post('/auth/me/reset-progress'),
  remove: () => api.delete('/auth/me'),
  shop: shopAPI.catalog,
  equip: (theme_id: string) => shopAPI.equip({ theme_id }),
}
