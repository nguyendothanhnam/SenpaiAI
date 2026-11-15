import { api } from './services'
import type { Language } from './types'
import type { Analysis, ChatEntry, Conversation, Folder, GrammarAnswer, GrammarResult, GrammarSession, GrammarStats, Level, Page, Pattern, SessionOptions } from './phase2Types'
export * from './phase2Types'

export const grammarAPI = {
  patterns: (jlpt_level: Level) => api.get<{ patterns: Pattern[] }>('/grammar-practice/patterns', { params: { jlpt_level } }).then(r => r.data.patterns),
  start: (options: SessionOptions, signal?: AbortSignal) => api.post<GrammarSession>('/grammar-practice/sessions', options, { signal, timeout: 120000 }).then(r => r.data),
  answer: (id: number, question_id: number, answer: unknown, time_spent_ms: number) => api.post<GrammarAnswer>(`/grammar-practice/sessions/${id}/answer`, { question_id, answer, time_spent_ms }).then(r => r.data),
  finish: (id: number) => api.post<GrammarResult>(`/grammar-practice/sessions/${id}/finish`).then(r => r.data),
  stats: () => api.get<GrammarStats>('/grammar-practice/stats').then(r => r.data),
  analyze: (text: string, response_language: Language) => api.post<Analysis>('/analysis/grammar', { text, response_language }, { timeout: 90000 }).then(r => r.data),
}
// Keep the chat transport separate from presentation and future voice support.
export const chatAPI = {
  create: () => api.post<Conversation>('/chat/conversations', { mode: 'text' }).then(r => r.data),
  list: (search: string, offset = 0) => api.get<Page<Conversation>>('/chat/conversations', { params: { search: search || undefined, offset, limit: 30 } }).then(r => r.data),
  conversation: (id: string) => api.get<Conversation>(`/chat/conversations/${id}`).then(r => r.data),
  messages: (id: string, offset = 0) => api.get<Page<ChatEntry>>(`/chat/conversations/${id}/messages`, { params: { offset, limit: 30 } }).then(r => r.data),
  rename: (id: string, title: string) => api.patch(`/chat/conversations/${id}`, { title }),
  pin: (id: string, is_pinned: boolean) => api.put(`/chat/conversations/${id}/pin`, { is_pinned }),
  move: (id: string, folder_id: string | null) => api.put(`/chat/conversations/${id}/folder`, { folder_id }),
  remove: (id: string) => api.delete(`/chat/conversations/${id}`),
  folders: () => api.get<Folder[]>('/chat/folders').then(r => r.data),
  createFolder: (name: string) => api.post('/chat/folders', { name }),
  renameFolder: (id: string, name: string) => api.patch(`/chat/folders/${id}`, { name }),
  removeFolder: (id: string, delete_conversations: boolean) => api.delete(`/chat/folders/${id}`, { params: { delete_conversations } }),
  send: (message: string, conversation_id: string, response_language: Language, jlpt_level?: string) => api.post('/chat/message', { message, conversation_id, response_language, jlpt_level }, { timeout: 90000 }),
}
