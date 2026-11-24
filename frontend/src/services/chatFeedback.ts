import { api } from './api'
export type AnswerRating = 'helpful' | 'incorrect'
export interface AnswerFeedback { rating: AnswerRating; comment: string; updated_at: string }
export const chatFeedbackAPI = {
  get: (messageId: number) => api.get<AnswerFeedback | null>(`/chat/answers/${messageId}/feedback`).then(r => r.data),
  save: (messageId: number, body: { rating: AnswerRating; comment: string }) => api.put<AnswerFeedback>(`/chat/answers/${messageId}/feedback`, body).then(r => r.data),
}
