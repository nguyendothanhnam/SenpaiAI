export type PlacementSkill = 'grammar' | 'vocab' | 'kanji' | 'reading' | 'listening'
export type PlacementMode = 'adaptive' | 'confirmation'
export type PlacementAnswer = string | boolean | string[]
export interface PlacementQuestion {
  key: string; skill: PlacementSkill; level: string; question_type: string; prompt: string
  prompt_key?: string | null; statement?: string | null; options?: string[] | null; tokens?: string[] | null
  base_form?: string | null; target_form?: string | null; lesson_id?: number | null
  start_ms?: number | null; end_ms?: number | null; choices?: { id: string; text: string }[] | null
  item_id?: number | null; revision?: number; user_answer?: PlacementAnswer | null
  passage?: string | null; stimulus_key?: string | null; audio_url?: string | null
}
export interface SkillScore { total: number; correct: number; score: number | null }
export interface PlacementResult {
  recommended_level: string; estimated_up_to: string; data_ceiling: string
  skill_scores: Record<PlacementSkill, SkillScore>; strengths: PlacementSkill[]; weaknesses: PlacementSkill[]; focus_skills: PlacementSkill[]
  foundation_needed: boolean; stop_reason: string; estimated_level?: string | null; selected_level?: string | null
  suggested_level?: string | null; total_score?: number | null; is_demo?: boolean; evidence_status?: string
  outcome?: string | null; next_level?: string | null; scoring_version?: string | null
}
export interface PlacementAttempt {
  id: number; status: 'in_progress' | 'completed' | 'abandoned'; assessment_mode: PlacementMode | 'legacy'
  selected_level?: string | null; items: PlacementQuestion[]; ready_to_submit: boolean; is_demo: boolean
  expires_at?: string | null; server_time?: string | null; revision: number; language: 'vi' | 'en'
  answered_count: number; min_questions: number; max_questions: number; available_levels: string[]
  question: PlacementQuestion | null; created_at: string; completed_at: string | null; confirmed_at: string | null
  result: PlacementResult | null; receivedAt?: number
}
export interface PlacementLevel { level: string; available: boolean; counts: Record<PlacementSkill, number>; missing_skills: PlacementSkill[]; is_demo: boolean }
export interface PlacementSummary {
  manual_level?: string | null; current_estimated_level: string | null; source: string; last_assessed_at: string | null
  last_confirmed_at: string | null; skill_scores: Record<string, SkillScore>; focus_skills: PlacementSkill[]
  history: { id: number; mode: string; selected_level: string | null; estimated_level: string | null; total_score: number | null; skill_scores: Record<string, SkillScore>; completed_at: string; confirmed_at: string | null; scoring_version: string; is_demo: boolean; evidence_status: string }[]
}
export interface ServerClock { server: number; received: number; deadline: number }
export function anchorClock(attempt: PlacementAttempt, received = performance.now()): ServerClock | null {
  const server = Date.parse(attempt.server_time || ''), deadline = Date.parse(attempt.expires_at || '')
  return Number.isFinite(server) && Number.isFinite(deadline) ? { server, deadline, received: attempt.receivedAt ?? received } : null
}
export function remainingSeconds(clock: ServerClock | null, now = performance.now()): number | null {
  if (!clock) return null
  return Math.max(0, Math.ceil((clock.deadline - clock.server - Math.max(0, now - clock.received)) / 1000))
}
export function currentQuestion(attempt: PlacementAttempt): PlacementQuestion | null {
  if (attempt.status !== 'in_progress') return null
  return attempt.assessment_mode === 'legacy' ? attempt.question : attempt.items.find(item => item.user_answer == null) ?? null
}
export function answerBody(attempt: PlacementAttempt, answer: PlacementAnswer) {
  const question = currentQuestion(attempt)
  if (!question) throw new Error('No pending question')
  if (attempt.assessment_mode !== 'legacy' && (typeof answer !== 'string' || !question.choices?.some(choice => choice.id === answer))) throw new Error('Invalid choice ID')
  return { question_key: question.key, answer, ...(attempt.assessment_mode === 'legacy' ? {} : { revision: question.revision }) }
}
export function estimatedLevel(attempt: PlacementAttempt): string | null {
  if (attempt.is_demo || attempt.result?.is_demo) return null
  return (attempt.assessment_mode === 'legacy' ? attempt.result?.recommended_level : attempt.result?.estimated_level) || null
}
// Never trust an arbitrary URL with the bearer token. These are the only media contracts.
export function placementMediaPath(attemptId: number, question: PlacementQuestion): string | null {
  const expected = `/placement/attempts/${attemptId}/media/${question.item_id}`
  if (question.audio_url) return question.audio_url === expected ? expected : null
  return question.question_type === 'listening' && Number.isInteger(question.lesson_id) ? `/listening/lessons/${question.lesson_id}/audio` : null
}
