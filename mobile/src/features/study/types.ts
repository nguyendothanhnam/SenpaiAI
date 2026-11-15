export type StudyKind = 'quiz' | 'flashcard'
export type StudySource = 'manual' | 'imported'
export interface QuizQuestion {
  question: string
  options: string[]
  answer: string
  correct_answer?: string
  explanation?: string
  jlpt_level?: string
  category?: string
  /** Transient shuffled session data; stripped by normalization before storage. */
  choice_correct?: boolean[]
}
export interface FlashCard { front: string; back: string; jlpt_level?: string; category?: string }
export interface StudyStats { correct: number; wrong: number; streak: number; accuracy: number }
export interface StudySet {
  id: string
  kind: StudyKind
  name: string
  jlpt_level: string
  category: string
  source: StudySource
  file_name: string
  created_at: string
  updated_at: string
  questions: QuizQuestion[]
  cards: FlashCard[]
  stats: StudyStats
  last_studied_at: string | null
  last_accuracy: number | null
}
export const emptyStats = (): StudyStats => ({ correct: 0, wrong: 0, streak: 0, accuracy: 0 })
export function newSet(kind: StudyKind): StudySet {
  const now = new Date().toISOString()
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`, kind, name: '', jlpt_level: '', category: '', source: 'manual', file_name: '', created_at: now, updated_at: now, questions: [], cards: [], stats: emptyStats(), last_studied_at: null, last_accuracy: null }
}
