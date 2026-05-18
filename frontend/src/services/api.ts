import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  getDocuments: (documentType?: string, jlptLevel?: string, limit = 50, offset = 0) =>
    api.get(`/library/documents?document_type=${documentType || ''}&jlpt_level=${jlptLevel || ''}&limit=${limit}&offset=${offset}`),
  getDocument: (documentId: number) => api.get(`/library/documents/${documentId}`),
  searchDocuments: (query: string, documentType?: string, jlptLevel?: string, limit = 10) =>
    api.post('/library/search', { query, document_type: documentType, jlpt_level: jlptLevel, limit }),
  getCategories: () => api.get('/library/categories'),
  getStats: () => api.get('/library/stats'),
}

export const kanjiRecognitionAPI = {
  recognize: (data: { image_base64: string; strokes: any[]; width: number; height: number }) =>
    api.post('/api/kanji/recognize', data),
}

