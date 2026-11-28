import type { AxiosInstance } from 'axios'
import type { PlacementAnswer, PlacementAttempt, PlacementMode, PlacementLevel, PlacementSummary } from '../features/placement/model'
import { answerBody } from '../features/placement/model'

export interface PlacementStatus { has_completed: boolean; has_confirmed: boolean; has_estimated_level: boolean; has_manual_level: boolean; active_attempt_id: number | null }
export interface PlacementLevels { levels: PlacementLevel[]; time_limit_seconds: number }
export function createPlacementAPI(api: AxiosInstance) {
  // Capture receipt using a monotonic clock; device wall time never drives deadlines.
  const timed = async (request: Promise<{ data: PlacementAttempt }>) => {
    const { data } = await request
    return { ...data, receivedAt: performance.now() }
  }
  return {
    status: () => api.get<PlacementStatus>('/placement/status').then(r => r.data),
    levels: (language: 'vi' | 'en') => api.get<PlacementLevels>('/placement/levels', { params: { language } }).then(r => r.data),
    summary: () => api.get<PlacementSummary>('/placement/profile/summary').then(r => r.data),
    history: () => api.get<PlacementAttempt[]>('/placement/attempts').then(r => r.data),
    get: (id: number) => timed(api.get<PlacementAttempt>(`/placement/attempts/${id}`)),
    start: (language: 'vi' | 'en', mode: PlacementMode, selected_level?: string) => timed(api.post<PlacementAttempt>('/placement/attempts', { language, mode, ...(mode === 'confirmation' ? { selected_level } : {}) })),
    answer: (attempt: PlacementAttempt, answer: PlacementAnswer) => timed(api.post<PlacementAttempt>(`/placement/attempts/${attempt.id}/answers`, answerBody(attempt, answer))),
    submit: (id: number) => timed(api.post<PlacementAttempt>(`/placement/attempts/${id}/submit`)),
    result: (id: number) => api.get<NonNullable<PlacementAttempt['result']>>(`/placement/attempts/${id}/result`).then(r => r.data),
    abandon: (id: number) => timed(api.post<PlacementAttempt>(`/placement/attempts/${id}/abandon`)),
    confirm: (id: number) => timed(api.post<PlacementAttempt>(`/placement/attempts/${id}/confirm`)),
  }
}
