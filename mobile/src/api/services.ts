import { QueryClient, setLogger } from 'react-query'
import { createApiClient } from './client'
import { apiConfiguration } from '../config/env'
import { secureToken } from '../storage/secureToken'
import { Session } from '../auth/session'
import type { DailyAnswerResult, DailyCompletion, DailyHistory, DailyOverview, DocumentPayload, Language, LibraryCategories, LibraryDocument, LibraryFilters, LibraryPage, LibraryStats, Rewards, User } from './types'

// React Query's default logger dumps Axios config, which may contain a bearer token.
setLogger({ log: () => undefined, warn: () => console.warn('SenpaiAI: query warning.'), error: () => console.warn('SenpaiAI: API request failed; see the translated message in the app.') })

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (attempt, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        return status !== 401 && status !== 403 && attempt < 1
      },
      staleTime: 30000,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})

export const api = createApiClient({
  baseURL: apiConfiguration.url,
  storage: secureToken,
  onUnauthorized: (token) => session.expire(token),
})

export const session = new Session(api, secureToken, async () => {
  await queryClient.cancelQueries()
  queryClient.clear()
})

export const authAPI = {
  me: () => api.get<User>('/auth/me').then(({ data }) => data),
  language: (ui_language: Language) => api.put<User>('/auth/me', { ui_language }).then(({ data }) => data),
}
export const rewardsAPI = { me: () => api.get<Rewards>('/rewards/me').then(({ data }) => data) }
export const dailyAPI = {
  today: async () => {
    const response = await api.get<DailyOverview>('/daily/today')
    const serverTime = Date.parse(String(response.headers.date ?? ''))
    return { ...response.data, server_now_ms: Number.isFinite(serverTime) ? serverTime : undefined, received_at_ms: performance.now() }
  },
  answer: (itemId: number, answer: unknown, time_spent_ms: number) => api.post<DailyAnswerResult>(`/daily/items/${itemId}/answer`, { answer, time_spent_ms }).then(({ data }) => data),
  complete: () => api.post<DailyCompletion>('/daily/complete').then(({ data }) => data),
  history: (days = 7) => api.get<DailyHistory[]>('/daily/history', { params: { days } }).then(({ data }) => data),
}

export const libraryAPI = {
  list: async (filters: LibraryFilters, offset = 0, limit = 12): Promise<LibraryPage> => {
    const params = { document_type: filters.document_type || undefined, jlpt_level: filters.jlpt_level || undefined, scope: filters.scope, limit, offset }
    if (filters.query.trim()) {
      const { data } = await api.post<{ results: LibraryDocument[] }>('/library/search', { ...params, query: filters.query.trim() }, { params: { language: filters.language } })
      return { items: data.results, limit, offset }
    }
    return api.get<LibraryPage>('/library/documents', { params: { ...params, language: filters.language } }).then(({ data }) => data)
  },
  document: (id: number, language?: Language) => api.get<LibraryDocument>(`/library/documents/${id}`, { params: { language } }).then(({ data }) => data),
  stats: () => api.get<LibraryStats>('/library/stats').then(({ data }) => data),
  categories: () => api.get<LibraryCategories>('/library/categories').then(({ data }) => data),
  create: (payload: DocumentPayload) => api.post<LibraryDocument>('/library/documents', payload).then(({ data }) => data),
  update: (id: number, payload: DocumentPayload) => api.put<LibraryDocument>(`/library/documents/${id}`, payload).then(({ data }) => data),
  remove: (id: number) => api.delete(`/library/documents/${id}`),
  fetchUrl: (url: string) => api.post<{ title: string; content: string; source_url: string }>('/library/fetch-url', { url }).then(({ data }) => data),
}

export async function checkBackend() {
  if (!apiConfiguration.valid) throw new Error('Invalid API configuration')
  const { data } = await api.get<{ status: string }>('/health', { baseURL: apiConfiguration.origin, timeout: 6000 })
  if (data.status !== 'healthy') throw new Error('Unexpected health response')
  return data
}
