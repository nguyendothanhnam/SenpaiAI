import { api } from './api'

export type PlacementSkill = 'grammar' | 'vocab' | 'kanji' | 'reading' | 'listening'
export type PlacementMode = 'adaptive' | 'confirmation'
export type PlacementAnswer = string | boolean | string[]
export interface PlacementQuestion {
  key: string
  skill: PlacementSkill
  level: string
  question_type: string
  prompt: string
  prompt_key?: string
  statement?: string
  options?: string[]
  tokens?: string[]
  base_form?: string
  target_form?: string
  lesson_id?: number
  start_ms?: number
  end_ms?: number
  choices?: { id: string; text: string }[] | null
  item_id?: number
  revision?: number
  user_answer?: PlacementAnswer | null
  passage?: string | null
  stimulus_key?: string | null
  audio_url?: string | null
}
export interface PlacementAttempt {
  id: number
  status: 'in_progress' | 'completed' | 'abandoned'
  assessment_mode: PlacementMode | 'legacy'
  selected_level?: string | null
  items: PlacementQuestion[]
  ready_to_submit: boolean
  is_demo: boolean
  expires_at?: string | null
  server_time?: string | null
  revision: number
  language: 'vi' | 'en'
  answered_count: number
  min_questions: number
  max_questions: number
  available_levels: string[]
  question: PlacementQuestion | null
  created_at: string
  completed_at: string | null
  confirmed_at: string | null
  result: null | {
    recommended_level: string
    estimated_up_to: string
    data_ceiling: string
    skill_scores: Record<PlacementSkill, { total: number; correct: number; score: number | null }>
    strengths: PlacementSkill[]
    weaknesses: PlacementSkill[]
    focus_skills: PlacementSkill[]
    foundation_needed: boolean
    stop_reason: string
    estimated_level?: string | null
    selected_level?: string | null
    suggested_level?: string | null
    total_score?: number | null
    is_demo?: boolean
    evidence_status?: string
    outcome?: string | null
    next_level?: string | null
    scoring_version?: string | null
  }
}
export interface PlacementLevel {
  level: string
  available: boolean
  counts: Record<PlacementSkill, number>
  missing_skills: PlacementSkill[]
  is_demo: boolean
}
export interface PlacementSummary {
  manual_level?: string | null
  current_estimated_level: string | null
  source: string
  last_assessed_at: string | null
  last_confirmed_at: string | null
  skill_scores: Record<string, { score: number | null; total: number; correct: number }>
  focus_skills: PlacementSkill[]
  history: { id: number; mode: string; selected_level: string | null; estimated_level: string | null; total_score: number | null; skill_scores: PlacementSummary['skill_scores']; completed_at: string; confirmed_at: string | null; scoring_version: string; is_demo: boolean; evidence_status: string }[]
}
export const placementAPI = {
  status: () => api.get<{ has_completed: boolean; has_confirmed: boolean; has_estimated_level?: boolean; has_manual_level?: boolean; active_attempt_id: number | null }>('/placement/status'),
  levels: (language: 'vi' | 'en') => api.get<{ levels: PlacementLevel[]; time_limit_seconds: number }>('/placement/levels', { params: { language } }),
  summary: () => api.get<PlacementSummary>('/placement/profile/summary'),
  get: (id: number) => api.get<PlacementAttempt>(`/placement/attempts/${id}`),
  history: () => api.get<PlacementAttempt[]>('/placement/attempts'),
  start: (language: 'vi' | 'en', mode?: PlacementMode, selected_level?: string) => api.post<PlacementAttempt>('/placement/attempts', { language, mode, selected_level }),
  answer: (id: number, question_key: string, answer: PlacementAnswer, revision?: number) =>
    api.post<PlacementAttempt>(`/placement/attempts/${id}/answers`, { question_key, answer, revision }),
  submit: (id: number) => api.post<PlacementAttempt>(`/placement/attempts/${id}/submit`),
  abandon: (id: number) => api.post<PlacementAttempt>(`/placement/attempts/${id}/abandon`),
  confirm: (id: number) => api.post<PlacementAttempt>(`/placement/attempts/${id}/confirm`),
}
