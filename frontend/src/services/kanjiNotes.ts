import { api } from './api'
export interface KanjiNote { sino_vietnamese: string; meaning_vi: string; mnemonic: string }
export interface KanjiNoteData { kanji: string; dictionary: { jlpt: string; stroke_count: number; onyomi: string[]; kunyomi: string[] } | null; defaults: Omit<KanjiNote, 'mnemonic'>; note: (KanjiNote & { updated_at: string }) | null; reading_source: { title: string; url: string } }
export const kanjiNotesAPI = {
  get: (kanji: string) => api.get<KanjiNoteData>(`/kanji-notes/${encodeURIComponent(kanji)}`).then(r => r.data),
  save: (kanji: string, body: KanjiNote) => api.put<KanjiNoteData>(`/kanji-notes/${encodeURIComponent(kanji)}`, body).then(r => r.data),
}
