import type { KanjiItem, Level, WordItem, StrokeGlyph } from './types'
import { kanjiFor, wordsFor } from './data'

/** A round owns its prepared data. Reducers never fetch or change its source. */
export interface RoundPool { kanji: KanjiItem[]; words: WordItem[]; strokes?: StrokeGlyph[] }
export function poolFor(level: Level, source?: RoundPool | number): RoundPool {
  return source && typeof source !== 'number' ? { strokes: source.strokes?.filter(item => item.level === level), kanji: source.kanji.filter(item => item.level === level), words: source.words.filter(item => item.level === level) } : { kanji: kanjiFor(level), words: wordsFor(level) }
}
