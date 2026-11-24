import { api } from './api'

export type LearningSkill = 'vocab' | 'grammar' | 'kanji' | 'listening' | 'conversation' | 'interview'
export interface Competence {
  score: number | null; samples: number; sample_days: number; evidence: 'sufficient' | 'insufficient'
  accuracy: number | null; graded_answers: number; correct_answers: number; proxy_only: boolean; mastered: boolean
}
export interface LearningCoverage { partial: boolean; truncated_sources: string[]; window_start: string; window_end: string; contains_proxy_scores: boolean; contains_undated_aggregates: boolean }
export interface WeeklyGoal { study_days: number; lessons: number; completed_days: number; completed_lessons: number; days_percent: number; lessons_percent: number; week_start: string; week_end_exclusive: string }
export interface LearningAction { id: string; reason: string; skill?: LearningSkill; href: string; params: Record<string, string | number> }
export interface Milestone { id: LearningSkill | 'assessment'; current: number | null; target: number; percent: number | null; available: boolean; complete: boolean; proxy?: boolean; level_unattributed?: boolean }
export interface LevelRoadmap { level: string; completion_percent: number; milestones: Milestone[]; current_milestone: string | null; next_milestone: string | null; ready_for_level_review: boolean; automatic_promotion: false; catalog_complete: boolean }
export interface LearningRoadmap { current_level: string; levels: LevelRoadmap[]; actions: LearningAction[]; coverage: LearningCoverage; official_jlpt: false }
export interface TrendPoint { start: string; lessons: number; study_days: number; accuracy: number | null }
export interface LearningOverview {
  as_of: string; current_level: string; skills: Record<LearningSkill, Competence>; weekly_goal: WeeklyGoal
  trend: TrendPoint[]; actions: LearningAction[]; has_activity: boolean; coverage: LearningCoverage; roadmap: LearningRoadmap
  legacy_wrong_items: { skill: LearningSkill; item_id: string; wrong_count: number; attempts: number; dated: false }[]
}
export interface MasteryItem extends Competence { skill: LearningSkill; item_id: string; item_type: string; level: string | null; label: string; wrong_count: number }
export interface LearningReport {
  period: 'week' | 'month'; start: string; end_exclusive: string; is_partial_period: boolean
  study_days: number; lessons: number; recorded_minutes: number; contains_estimated_time: boolean
  answered: number; correct: number; accuracy: number | null; skills: Record<LearningSkill, Competence>
  strengths: LearningSkill[]; weaknesses: LearningSkill[]; frequent_wrong_items: { skill: LearningSkill; item_id: string; label: string; wrong_count: number; answers: number }[]
  common_errors: { code: string; count: number }[]; narrative: { key: string; params: Record<string, string | number | null> }
  recommendations: { key: string; params: Record<string, string | number> }[]
  comparison: { accuracy_delta: number | null; skill_deltas: Record<LearningSkill, number | null>; lessons_delta: number | null; same_elapsed_days: boolean; available: boolean }
  coverage: LearningCoverage
}
export interface LearningPage<T> { items: T[]; total: number; offset: number; limit: number; has_more: boolean; coverage: LearningCoverage }
export const learningAPI = {
  overview: () => api.get<LearningOverview>('/learning/overview').then(res => res.data),
  roadmap: () => api.get<LearningRoadmap>('/learning/roadmap').then(res => res.data),
  mastery: (skill: LearningSkill, offset = 0) => api.get<LearningPage<MasteryItem>>('/learning/mastery', { params: { skill, offset, limit: 10 } }).then(res => res.data),
  reports: (period: 'week' | 'month', offset = 0) => api.get<LearningPage<LearningReport>>('/learning/reports', { params: { period, offset, limit: 1 } }).then(res => res.data),
  saveGoals: (data: { study_days: number; lessons: number }) => api.put('/learning/goals', data).then(res => res.data),
}
