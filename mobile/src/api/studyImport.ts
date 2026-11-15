import type { StudyKind } from '../features/study/types'
import { normalizeCards, normalizeQuizQuestions, validateFile } from '../features/study/validation'
import { api } from './services'

export interface ImportFile { uri: string; name: string; mimeType?: string; size: number }
// Deliberately the ONLY game API calls in phase 4. No create/list/submit calls.
export async function importStudyFile(kind: StudyKind, file: ImportFile, signal: AbortSignal) {
  validateFile(file.name, file.size, kind)
  const body = new FormData()
  body.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob)
  const { data } = await api.post(kind === 'quiz' ? '/game/quiz/upload' : '/game/flashcard/import', body, { signal, timeout: 45000, headers: { 'Content-Type': 'multipart/form-data' } })
  return kind === 'quiz' ? { questions: normalizeQuizQuestions(data), cards: [] } : { questions: [], cards: normalizeCards(data) }
}
