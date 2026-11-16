import { api } from './services'
import type { recognitionPayload } from '../features/kanji/handwriting'
export type ModelInfo = { available: boolean; model_loaded: boolean; supported_jlpt: string[]; supported_kanji: string[]; classes_count: number; dictionary_classes?: number; message?: string }
export type Prediction = { kanji: string; confidence: number; meaning: string; onyomi: string[]; kunyomi: string[]; stroke_count?: number; jlpt?: string }
export type Recognition = { success: boolean; predictions: Prediction[]; engine: string; low_confidence: boolean; message?: string }
export const writingAPI = {
  model: async () => (await api.get<ModelInfo>('/kanji/model-info')).data,
  supported: async () => (await api.get<{ kanji: string[] }>('/kanji/supported')).data,
  samples: async (kanji: string) => (await api.get<{ items: { filename: string; image_data: string }[]; total: number }>(`/kanji/${encodeURIComponent(kanji)}/handwriting-samples`, { params: { limit: 3 } })).data,
  recognize: async (payload: ReturnType<typeof recognitionPayload>, signal: AbortSignal) => (await api.post<Recognition>('/kanji/recognize', payload, { signal, timeout: 20000 })).data,
}
