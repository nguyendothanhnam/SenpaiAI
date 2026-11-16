import raw from './catalog.json'
import type { KanjiItem, Level, WordItem } from './types'
export const kanji = raw.kanji as KanjiItem[]
export const words = raw.words as WordItem[]
export const kanjiFor = (level: Level) => kanji.filter(item => item.level === level)
export const wordsFor = (level: Level) => words.filter(item => item.level === level)
export const strokeMetadata = raw.strokeMetadata
