import type { DailyPayload, Example } from './types'

export const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const questionTypes = ['fill_blank', 'reorder', 'true_false', 'conjugation'] as const
export type Level = typeof levels[number]
export type QuestionType = typeof questionTypes[number]
export interface Pattern { id: number; rule_name: string; japanese_pattern: string; meaning: string; question_counts: Record<QuestionType, number> }
export interface GrammarQuestion extends DailyPayload { id: number; question_type: QuestionType; jlpt_level: Level; prompt: string; grammar_rule: { id: number; rule_name: string } | null }
export interface GrammarSession { session_id: number; questions: GrammarQuestion[]; message?: string | null }
export interface GrammarAnswer { is_correct: boolean; correct_answer: unknown; explanation_vi: string; examples: Example[] }
export interface RuleScore { grammar_rule_id: number | null; rule_name?: string | null; questions: number; correct: number }
export interface GrammarResult { score: number; total: number; duration_seconds: number; by_rule: RuleScore[]; wrong_question_ids: number[] }
export interface Stat { total: number; correct: number; accuracy: number; rule_name?: string; grammar_rule_id?: number }
export interface GrammarStats { by_jlpt: Record<string, Stat>; weak_patterns: Stat[]; activity_7_days: { date: string; total: number; correct: number }[] }
export interface SessionOptions { jlpt_level: Level; grammar_rule_id?: number; question_types: QuestionType[]; count: number; mode: 'bank' | 'ai' | 'mixed'; question_ids?: number[] }
export interface Analysis { jlpt_level: string; difficulty_score: number; analysis_note?: string; sentence_meaning?: string; translation?: string; vocabulary: { term: string; meaning: string; jlpt_level?: string }[]; grammar_patterns?: { pattern: string; explanation: string; example?: string }[]; grammar_points: { pattern: string; explanation: string; example?: string }[]; suggestions: string[] }
export interface Source { type?: string; title?: string; url?: string; document_id?: number; id?: number }
export interface ChatEntry { id: number; question: string; answer: string; created_at: string; jlpt_level?: string; translation?: string; grammar_points?: { pattern?: string; explanation?: string; example?: string }[]; sources?: Source[] }
export interface Conversation { id: string; title: string; folder_id: string | null; is_pinned: boolean; mode: 'text' | 'voice'; last_activity_at: string; snippet?: string }
export interface Folder { id: string; name: string; conversation_count: number }
export interface Page<T> { items: T[]; total: number; limit: number; offset: number; has_more?: boolean }
