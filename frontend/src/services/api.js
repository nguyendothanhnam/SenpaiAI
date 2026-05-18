import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000',
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
  getDocuments: (documentType, jlptLevel, limit = 50, offset = 0) =>
    api.get(`/library/documents?document_type=${documentType || ''}&jlpt_level=${jlptLevel || ''}&limit=${limit}&offset=${offset}`),
  getDocument: (documentId) => api.get(`/library/documents/${documentId}`),
  searchDocuments: (query, documentType, jlptLevel, limit = 10) =>
    api.post('/library/search', { query, document_type: documentType, jlpt_level: jlptLevel, limit }),
  getCategories: () => api.get('/library/categories'),
  getStats: () => api.get('/library/stats'),
}

export const gameAPI = {
  getQuiz: () => api.get('/game/quiz'),
  uploadQuiz: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      return await api.post('/game/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    } catch (error) {
      return api.post('/game/quiz/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    }
  },
  createQuiz: (data) => api.post('/game/quiz/create', data),
  getFlashcard: () => api.get('/game/flashcard'),
  createFlashcard: (data) => api.post('/game/flashcard/create', data),
  getKanji: () => api.get('/game/kanji'),
}

export const kanjiRecognitionAPI = {
  recognize: (data) => api.post('/api/kanji/recognize', data),
}

export const getQuiz = () => gameAPI.getQuiz()
export const uploadQuiz = (file) => gameAPI.uploadQuiz(file)
export const createQuiz = (data) => gameAPI.createQuiz(data)
export const getFlashcard = () => gameAPI.getFlashcard()
export const createFlashcard = (data) => gameAPI.createFlashcard(data)

export default api

