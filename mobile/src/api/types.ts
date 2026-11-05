export type Language = 'vi' | 'en'

export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  current_jlpt_level: string
  learning_goals: string[]
  exercise_points: number
  created_at: string
  ui_language?: Language | null
}

export interface Rewards {
  points_balance: number
  current_streak: number
  longest_streak: number
  last_completed_date: string | null
}

export interface DailyOverview {
  task_id: number
  date: string
  status: 'in_progress' | 'completed'
  progress: { total_items: number; answered_items: number; correct_count: number; all_answered: boolean }
  items: DailyItem[]
  reward?: { points_awarded: number; streak: number; breakdown: RewardBreakdown }
  server_now_ms?: number
  received_at_ms?: number
}

export interface Example { ja: string; vi?: string; en?: string }
export interface DailyPayload {
  prompt?: string; statement?: string; options?: string[]; tokens?: string[]
  base_form?: string; target_form?: string; kanji?: string; word?: string; reading?: string
  level?: string; jlpt_level?: string; meaning?: string
}
export interface DailyItem {
  id: number; position: number; item_type: 'grammar' | 'kanji' | 'vocab' | 'flashcard'
  question_type: string; payload: DailyPayload; answered: boolean
  user_answer?: unknown; is_correct?: boolean | null; correct_answer?: unknown; explanation?: string; examples?: Example[]
}
export interface RewardBreakdown {
  base_points: number; correct_points: number; perfect_bonus: number
  streak_bonus: number; streak_milestone_bonus: number; total_points: number
}
export interface DailyAnswerResult { is_correct: boolean; correct_answer: unknown; explanation: string; examples?: Example[]; all_answered: boolean }
export interface DailyCompletion { points_awarded: number; breakdown: RewardBreakdown; streak: number; balance: number }
export interface DailyHistory { date: string; points_awarded: number; streak: number; correct_count: number; total_items: number }

export type DocumentType = 'vocabulary' | 'grammar' | 'lesson' | 'culture' | 'example'
export type DocumentScope = 'all' | 'mine' | 'system'
export interface LibraryDocument {
  id: number; title: string; content: string; document_type: string; jlpt_level?: string | null
  tags: string[]; source_url?: string | null; created_at: string; updated_at?: string | null
  content_preview?: string; indexing_warning?: string | null
  scope?: 'system' | 'personal'; is_mine?: boolean; can_edit?: boolean; can_delete?: boolean
}
export interface LibraryPage { items: LibraryDocument[]; total?: number; limit: number; offset: number }
export interface LibraryStats { total_documents: number; document_types: Record<string, number> | number; jlpt_levels: Record<string, number> | number; vector_chunks: number }
export interface LibraryCategories { document_types: string[]; jlpt_levels: string[] }
export interface DocumentPayload { title: string; content: string; document_type: string; jlpt_level: string | null; tags: string[]; source_url: string | null }
export interface LibraryFilters { query: string; document_type: string; jlpt_level: string; scope: DocumentScope; language: Language }
