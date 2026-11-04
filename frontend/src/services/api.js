// Keep legacy .js imports working while using the shared typed API client.
export * from './api.ts'
import { api } from './api.ts'

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

export const getQuiz = () => gameAPI.getQuiz()
export const uploadQuiz = (file) => gameAPI.uploadQuiz(file)
export const createQuiz = (data) => gameAPI.createQuiz(data)
export const getFlashcard = () => gameAPI.getFlashcard()
export const createFlashcard = (data) => gameAPI.createFlashcard(data)
export const importFlashcard = (file) => gameAPI.importFlashcard(file)

export default api

