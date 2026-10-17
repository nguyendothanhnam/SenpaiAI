import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: any) => api.put('/auth/me', data),
}

export interface RewardsMe {
  points_balance: number
  current_streak: number
  longest_streak: number
  last_completed_date: string | null
  active_theme_id: string
  active_background_id: string | null
  unlocked: { themes: string[]; backgrounds: string[] }
}

export interface ShopItem {
  id: string
  name: string
  price: number
  image?: string
  item_type: 'theme' | 'background'
  owned: boolean
  equipped: boolean
}

export const rewardsAPI = {
  getMe: () => api.get<RewardsMe>('/rewards/me'),
  getShop: () => api.get<{ themes: ShopItem[]; backgrounds: ShopItem[] }>('/rewards/shop'),
  getTransactions: (limit = 50) => api.get('/rewards/transactions', { params: { limit } }),
  purchase: (data: { item_type: 'theme' | 'background'; item_id: string; equip?: boolean }) =>
    api.post('/rewards/shop/purchase', { equip: true, ...data }),
  equip: (data: { theme_id?: string; background_id?: string | null }) => api.put('/rewards/equip', data),
}

export interface VoiceScenario { id: string; name: string; description: string; opening: string }
export interface VoiceFeedbackIssue { type: 'grammar' | 'vocab' | 'politeness'; original: string; suggestion: string; explanation_vi: string }
export interface VoiceFeedback { corrected_sentence: string; issues: VoiceFeedbackIssue[]; better_phrases: string[] }
export interface ListeningLessonSummary {
  id: number; title: string; jlpt_level: string; topic: string; description?: string | null
  duration_ms: number; source: string
}
export interface ListeningToken { text: string; reading?: string }
export interface ListeningSegment {
  idx: number; start_ms?: number; end_ms?: number; ja: string; tokens?: ListeningToken[]; vi: string
}
export interface ListeningLesson extends ListeningLessonSummary { segments: ListeningSegment[] }
export interface AppNotification {
  id: number; type: string; title: string; body: string; url: string; data: Record<string, unknown>
  created_at: string; read_at: string | null
}
export interface ReminderSettings {
  enabled: boolean; timezone: string; reminder_time: string; days_of_week: number[]
  types: Array<'daily_task' | 'streak_risk' | 'review_due'>; quiet_start: string; quiet_end: string
  push_enabled: boolean; max_per_day: number; snooze_until: string | null; updated_at?: string | null
}

export const voiceAPI = {
  getScenarios: () => api.get<VoiceScenario[]>('/voice/scenarios'),
  createConversation: (data: { scenario_id: string; jlpt_level: 'N5' | 'N4' | 'N3' }) =>
    api.post<{ id: string; opening_text: string; audio_url: string | null }>('/voice/conversations', data),
  transcribe: (audio: Blob) => {
    const form = new FormData()
    form.append('audio', audio, `recording.${audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'mp4' : audio.type.includes('wav') ? 'wav' : 'webm'}`)
    return api.post<{ text: string; confidence: number | null }>('/voice/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  sendTurn: (id: string, text: string, transcript_confidence?: number | null) =>
    api.post<{ chat_id: number; reply: string; audio_url: string | null }>(`/voice/conversations/${id}/turn`, { text, transcript_confidence }),
  feedback: (chatId: number) => api.post<VoiceFeedback>(`/voice/turns/${chatId}/feedback`),
  endConversation: (id: string) => api.post<{ summary: Record<string, unknown>; turn_count: number }>(`/voice/conversations/${id}/end`),
}

export const remindersAPI = {
  getSettings: () => api.get<ReminderSettings>('/reminders/settings'),
  updateSettings: (data: Partial<ReminderSettings>) => api.put<ReminderSettings>('/reminders/settings', data),
  getSuggestedTime: () => api.get<{ suggested_time: string | null; sample_count: number; hour_count: number; timezone: string }>('/reminders/suggested-time'),
}

export const notificationsAPI = {
  list: (limit = 20, unread_only = false) => api.get<AppNotification[]>('/notifications/', { params: { limit, unread_only } }),
  unreadCount: () => api.get<{ unread_count: number }>('/notifications/unread-count'),
  markRead: (id: number) => api.post<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>('/notifications/read-all'),
  remove: (id: number) => api.delete(`/notifications/${id}`),
}

export const pushAPI = {
  getPublicKey: () => api.get<{ enabled: boolean; public_key: string | null }>('/push/vapid-public-key'),
  subscribe: (subscription: PushSubscriptionJSON) => api.post('/push/subscribe', subscription),
  unsubscribe: (endpoint: string) => api.delete('/push/subscribe', { data: { endpoint } }),
  test: () => api.post('/push/test'),
}

export const listeningAPI = {
  getLessons: (params: { jlpt_level?: string; topic?: string; search?: string; limit?: number; offset?: number } = {}) =>
    api.get<{ items: ListeningLessonSummary[]; total: number; limit: number; offset: number }>('/listening/lessons', { params }),
  getLesson: (id: number) => api.get<ListeningLesson>(`/listening/lessons/${id}`),
  getAudio: (id: number) => api.get<Blob>(`/listening/lessons/${id}/audio`, { responseType: 'blob' }),
}

export type DailyItemType = 'grammar' | 'kanji' | 'vocab' | 'flashcard'
export interface DailyTaskItem {
  id: number
  position: number
  item_type: DailyItemType
  question_type: string
  payload: Record<string, any>
  answered: boolean
  user_answer?: unknown
  is_correct?: boolean | null
  correct_answer?: unknown
  explanation?: string
  examples?: GrammarPracticeExample[]
}
export interface DailyTask {
  task_id: number
  date: string
  status: 'in_progress' | 'completed'
  items: DailyTaskItem[]
  progress: { total_items: number; answered_items: number; correct_count: number; all_answered: boolean }
  reward?: { points_awarded: number; breakdown: DailyRewardBreakdown; streak: number }
}
export interface DailyRewardBreakdown {
  base_points: number
  correct_points: number
  perfect_bonus: number
  streak_bonus: number
  streak_milestone_bonus: number
  total_points: number
}
export interface DailyAnswerResult {
  is_correct: boolean
  correct_answer: unknown
  explanation: string
  examples?: GrammarPracticeExample[]
  all_answered: boolean
}
export interface DailyCompletionResult {
  points_awarded: number
  breakdown: DailyRewardBreakdown
  streak: number
  balance: number
}
export interface DailyHistoryEntry {
  date: string
  points_awarded: number
  streak: number
  correct_count: number
  total_items: number
}
export const dailyAPI = {
  getToday: () => api.get<DailyTask>('/daily/today'),
  answer: (itemId: number, data: { answer: unknown; time_spent_ms: number }) =>
    api.post<DailyAnswerResult>(`/daily/items/${itemId}/answer`, data),
  complete: () => api.post<DailyCompletionResult>('/daily/complete'),
  getHistory: (days = 30) => api.get<DailyHistoryEntry[]>('/daily/history', { params: { days } }),
}

export const chatAPI = {
  sendMessage: (message: string, context?: string, jlpt_level?: string) =>
    api.post('/chat/message', { message, context, jlpt_level }),
  getHistory: (limit = 50, offset = 0) =>
    api.get(`/chat/history?limit=${limit}&offset=${offset}`),
  searchHistory: (query: string, limit = 20) =>
    api.get(`/chat/search?query=${query}&limit=${limit}`),
  deleteEntry: (chatId: number) => api.delete(`/chat/history/${chatId}`),
  clearHistory: () => api.delete('/chat/history'),
}

export const analysisAPI = {
  analyzeGrammar: (text: string, includeTranslation = false) =>
    api.post('/analysis/grammar', { text, include_translation: includeTranslation }),
  translate: (text: string, sourceLang: string, targetLang: string) =>
    api.post('/analysis/translate', { text, source_lang: sourceLang, target_lang: targetLang }),
  predictJLPT: (text: string) => api.post('/analysis/jlpt-level', text),
}

export type GrammarQuestionType = 'fill_blank' | 'reorder' | 'true_false' | 'conjugation'
export type GrammarPracticeMode = 'bank' | 'ai' | 'mixed'
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface GrammarPattern {
  id: number
  rule_name: string
  japanese_pattern: string
  meaning: string
  usage_notes?: string | null
  question_counts: Record<GrammarQuestionType, number>
}

export interface GrammarPracticeQuestion {
  id: number
  question_type: GrammarQuestionType
  jlpt_level: JlptLevel
  grammar_rule: { id: number; rule_name: string } | null
  prompt: string
  options?: string[]
  tokens?: string[]
  statement?: string
  base_form?: string
  target_form?: string
}

export interface GrammarPracticeExample {
  ja: string
  vi: string
}

export interface GrammarAnswerResult {
  is_correct: boolean
  correct_answer: unknown
  accepted_answers?: unknown[]
  explanation_vi: string
  examples: GrammarPracticeExample[]
}

export interface GrammarSessionResult {
  score: number
  total: number
  duration_seconds: number
  by_rule: Array<{ grammar_rule_id: number | null; rule_name?: string | null; questions: number; correct: number }>
  wrong_question_ids: number[]
}

export const grammarPracticeAPI = {
  getPatterns: (jlpt_level: JlptLevel) =>
    api.get<{ jlpt_level: JlptLevel; patterns: GrammarPattern[] }>('/grammar-practice/patterns', { params: { jlpt_level } }),
  createSession: (data: {
    jlpt_level: JlptLevel
    grammar_rule_id?: number
    question_types: GrammarQuestionType[]
    count: number
    mode: GrammarPracticeMode
    question_ids?: number[]
  }) => api.post<{ session_id: number; questions: GrammarPracticeQuestion[]; message?: string | null }>('/grammar-practice/sessions', data),
  answer: (sessionId: number, data: { question_id: number; answer: string | string[] | boolean; time_spent_ms: number }) =>
    api.post<GrammarAnswerResult>(`/grammar-practice/sessions/${sessionId}/answer`, data),
  finish: (sessionId: number) => api.post<GrammarSessionResult>(`/grammar-practice/sessions/${sessionId}/finish`),
  generate: (data: { jlpt_level: JlptLevel; grammar_rule_id: number; question_type: GrammarQuestionType; count: number }) =>
    api.post<{ requested: number; saved: number; rejected: number }>('/grammar-practice/generate', data),
}

export const libraryAPI = {
  getDocuments: (params: { document_type?: string; jlpt_level?: string; tag?: string; sort?: string; scope?: 'all' | 'mine' | 'system'; limit?: number; offset?: number } = {}) =>
    api.get('/library/documents', { params }),
  getDocument: (documentId: number) => api.get(`/library/documents/${documentId}`),
  createDocument: (data: any) => api.post('/library/documents', data),
  updateDocument: (documentId: number, data: any) => api.put(`/library/documents/${documentId}`, data),
  deleteDocument: (documentId: number) => api.delete(`/library/documents/${documentId}`),
  fetchUrl: (url: string) => api.post('/library/fetch-url', { url }),
  searchDocuments: (data: { query: string; document_type?: string | null; jlpt_level?: string | null; scope?: 'all' | 'mine' | 'system'; limit?: number; offset?: number }) =>
    api.post('/library/search', data),
  getCategories: () => api.get('/library/categories'),
  getStats: () => api.get('/library/stats'),
  quiz: (params: { mode?: string; jlpt?: string; count?: number } = {}) =>
    api.get('/library/quiz', { params }),
}

export const kanjiRecognitionAPI = {
  recognize: (data: { image_data: string; strokes?: any[]; target_kanji?: string | null; jlpt_level?: string | null }) =>
    api.post('/kanji/recognize', data),
  correct: (data: { image_data: string; strokes?: any[]; predicted_kanji?: string | null; correct_kanji: string; jlpt_level?: string | null }) =>
    api.post('/kanji/correction', data),
  getModelInfo: () => api.get('/kanji/model-info'),
}

export const kanjiDataAPI = {
  list: (params: { jlpt?: string; limit?: number; offset?: number; search?: string } = {}) =>
    api.get('/kanji/list', { params }),
  get: (kanji: string) => api.get(`/kanji/${encodeURIComponent(kanji)}`),
  quiz: (params: { mode?: string; jlpt?: string; count?: number } = {}) =>
    api.get('/kanji/quiz', { params }),
  matchingGrid: (params: { jlpt?: string; count?: number } = {}) =>
    api.get('/kanji/matching-grid', { params }),
  wordMatchingGrid: (params: { jlpt?: string; count?: number } = {}) =>
    api.get('/kanji/word-matching-grid', { params }),
  getDictionaryStatus: () => api.get('/kanji/dictionary-status'),
  getSupported: () => api.get('/kanji/supported'),
  getStrokeOrder: (kanji: string) => api.get(`/kanji/${encodeURIComponent(kanji)}/stroke-order`),
  getStrokes: (kanji: string) => api.get(`/kanji/${encodeURIComponent(kanji)}/strokes`),
  getMetadata: (kanji: string) => api.get(`/kanji/${encodeURIComponent(kanji)}/metadata`),
  getHandwritingSamples: (kanji: string, limit = 5) =>
    api.get(`/kanji/${encodeURIComponent(kanji)}/handwriting-samples`, { params: { limit } }),
}

