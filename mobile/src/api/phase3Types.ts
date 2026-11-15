export interface KanjiEntry {
  kanji: string; meaning: string; meaning_vi: string; onyomi: string[]; kunyomi: string[]
  jlpt: string; strokes: number; stroke_count: number
  examples: { word: string; reading: string; meaning: string }[]
}
export interface KanjiPage { items: KanjiEntry[]; total: number; limit: number; offset: number }
export interface StrokeData { kanji: string; available: boolean; viewBox?: string; strokes?: { index: number; path: string }[]; source?: string; license?: string; source_url?: string }
export interface KanjiQuestion { question: string; correct_answer: string; options: string[]; kanji: KanjiEntry }
export interface ShopTheme { id: string; name: string; price: number; owned: boolean; equipped: boolean }
