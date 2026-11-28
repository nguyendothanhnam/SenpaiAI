import { api } from './api'

export interface WritingPoint { x: number; y: number }
export interface WritingStroke { index: number; status: 'correct' | 'wrong_order' | 'wrong_direction' | 'wrong_shape' | 'extra' | 'missing'; expected_index: number | null; matched_index: number | null; message_key: string; direction_error?: boolean; order_error?: boolean; criterion_scores?: { order: number | null; direction: number | null; shape: number | null }; metrics?: { distance: number; length_ratio: number; matches?: boolean } | null }
export interface WritingHistory { kanji: string; attempts: number; passed_count: number; last_passed: boolean; last_score: number; last_practiced: string }
export interface WritingDictionaryEntry { kanji: string; meaning_vi?: string; meaning_en?: string; onyomi?: string[]; kunyomi?: string[]; examples?: { word: string; reading?: string; meaning?: string }[] }
export interface Confusion { kanji: string; review_status: string; distinguishing_strokes: { target_stroke: number | null; other_stroke: number | null; reason: string }[] }
export interface WritingTemplate { kanji: string; level: string; strokes: WritingPoint[][]; stroke_count: number; rules: { key: string }[]; confusions: Confusion[]; source: string; source_url: string; license: string }
export interface WritingResult { kanji: string; provisional: boolean; saved: boolean; passed: boolean; overall_score: number; scores: Record<string, number>; evidence_counts?: { order: number; direction: number; matched: number }; strokes: WritingStroke[]; confusion: Confusion | null; recognizer_warning: string | null; actual_count: number; expected_count: number; summary_key: string; strictness?: WritingStrictness; score_weights?: Record<string, number>; pass_score?: number; thresholds?: { distance: number; endpoint: number; length_ratio: number; order_margin: number } }
export type WritingStrictness = 'very_easy' | 'easy' | 'standard' | 'strict' | 'very_strict'
export const WRITING_STRICTNESS: WritingStrictness[] = ['easy', 'standard', 'strict']
export interface WritingRules { version: string; weights: Record<string, number>; pass_score: number; profiles: Record<string, { distance: number; endpoint: number; length_ratio: number; order_margin: number }> }
export interface WritingRequest { kanji: string; strokes: WritingPoint[][]; final: boolean; mode: 'practice' | 'test'; strictness?: WritingStrictness; attempt_id?: string; elapsed_seconds?: number; include_recognizer_warning?: boolean }
export const kanjiWritingAPI = {
  rules: () => api.get<WritingRules>('/kanji-writing/rules').then(r => r.data),
  progress: () => api.get<{ items: WritingHistory[] }>('/kanji-writing/progress').then(r => r.data),
  dictionary: async () => {
    const first=await api.get<{items:WritingDictionaryEntry[];total:number}>('/kanji/list',{params:{limit:500,offset:0}})
    if(first.data.total<=500)return first.data.items
    const rest=await api.get<{items:WritingDictionaryEntry[]}>('/kanji/list',{params:{limit:500,offset:500}})
    return [...first.data.items,...rest.data.items]
  },
  supported: () => api.get<{ items: { kanji: string; level: string; stroke_count: number }[] }>('/kanji-writing/supported').then(r => r.data),
  template: (kanji: string) => api.get<WritingTemplate>(`/kanji-writing/template/${encodeURIComponent(kanji)}`).then(r => r.data),
  evaluate: (body: WritingRequest) => api.post<WritingResult>('/kanji-writing/evaluate', body).then(r => r.data),
  report: (body: { attempt_id: string; report_id: string; strokes: WritingPoint[][]; comment: string; confirmed: boolean }) => api.post<{ id: string; saved: boolean }>('/kanji-writing/reports', body).then(r => r.data),
}
