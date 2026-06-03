import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

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

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, username, password) => api.post('/auth/register', { email, username, password }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
}

export const chatAPI = {
  sendMessage: (message, context, jlpt_level) => api.post('/chat/message', { message, context, jlpt_level }),
  getHistory: (limit = 50, offset = 0) => api.get(`/chat/history?limit=${limit}&offset=${offset}`),
  searchHistory: (query, limit = 20) => api.get(`/chat/search?query=${query}&limit=${limit}`),
  deleteEntry: (chatId) => api.delete(`/chat/history/${chatId}`),
  clearHistory: () => api.delete('/chat/history'),
}

export const analysisAPI = {
  analyzeGrammar: (text, includeTranslation = false) =>
    api.post('/analysis/grammar', { text, include_translation: includeTranslation }),
  translate: (text, sourceLang, targetLang) =>
    api.post('/analysis/translate', { text, source_lang: sourceLang, target_lang: targetLang }),
  predictJLPT: (text) => api.post('/analysis/jlpt-level', text),
}

export const libraryAPI = {
  getDocuments: (params = {}) => api.get('/library/documents', { params }),
  getDocument: (documentId) => api.get(`/library/documents/${documentId}`),
  createDocument: (data) => api.post('/library/documents', data),
  updateDocument: (documentId, data) => api.put(`/library/documents/${documentId}`, data),
  deleteDocument: (documentId) => api.delete(`/library/documents/${documentId}`),
  fetchUrl: (url) => api.post('/library/fetch-url', { url }),
  searchDocuments: (data) => api.post('/library/search', data),
  getCategories: () => api.get('/library/categories'),
  getStats: () => api.get('/library/stats'),
  quiz: (params = {}) => api.get('/library/quiz', { params }),
}

export const gameAPI = {
  getQuiz: () => api.get('/game/quiz'),
  uploadQuiz: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/game/quiz/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  createQuiz: (data) => api.post('/game/quiz/create', data),
  getFlashcard: () => api.get('/game/flashcard'),
  createFlashcard: (data) => api.post('/game/flashcard/create', data),
  importFlashcard: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/game/flashcard/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getKanji: () => api.get('/game/kanji'),
}

export const kanjiRecognitionAPI = {
  recognize: (data) => api.post('/kanji/recognize', data),
  correct: (data) => api.post('/kanji/correction', data),
  getModelInfo: () => api.get('/kanji/model-info'),
}

export const kanjiDataAPI = {
  list: (params = {}) => api.get('/kanji/list', { params }),
  get: (kanji) => api.get(`/kanji/${encodeURIComponent(kanji)}`),
  quiz: (params = {}) => api.get('/kanji/quiz', { params }),
  matchingGrid: (params = {}) => api.get('/kanji/matching-grid', { params }),
  wordMatchingGrid: (params = {}) => api.get('/kanji/word-matching-grid', { params }),
  getDictionaryStatus: () => api.get('/kanji/dictionary-status'),
  getSupported: () => api.get('/kanji/supported'),
  getStrokeOrder: (kanji) => api.get(`/kanji/${encodeURIComponent(kanji)}/stroke-order`),
  getStrokes: (kanji) => api.get(`/kanji/${encodeURIComponent(kanji)}/strokes`),
  getMetadata: (kanji) => api.get(`/kanji/${encodeURIComponent(kanji)}/metadata`),
  getHandwritingSamples: (kanji, limit = 5) => api.get(`/kanji/${encodeURIComponent(kanji)}/handwriting-samples`, { params: { limit } }),
}

export const getQuiz = () => gameAPI.getQuiz()
export const uploadQuiz = (file) => gameAPI.uploadQuiz(file)
export const createQuiz = (data) => gameAPI.createQuiz(data)
export const getFlashcard = () => gameAPI.getFlashcard()
export const createFlashcard = (data) => gameAPI.createFlashcard(data)
export const importFlashcard = (file) => gameAPI.importFlashcard(file)

export default api

