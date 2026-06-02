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

export const libraryAPI = {
  getDocuments: (params: { document_type?: string; jlpt_level?: string; tag?: string; sort?: string; limit?: number; offset?: number } = {}) =>
    api.get('/library/documents', { params }),
  getDocument: (documentId: number) => api.get(`/library/documents/${documentId}`),
  createDocument: (data: any) => api.post('/library/documents', data),
  updateDocument: (documentId: number, data: any) => api.put(`/library/documents/${documentId}`, data),
  deleteDocument: (documentId: number) => api.delete(`/library/documents/${documentId}`),
  fetchUrl: (url: string) => api.post('/library/fetch-url', { url }),
  searchDocuments: (data: { query: string; document_type?: string | null; jlpt_level?: string | null; limit?: number; offset?: number }) =>
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

