import { poolFor, type RoundPool } from './pool'
import { hiragana } from './shiritori'
import type { Difficulty, Level, PairItem } from './types'
export function missingEligible(count: number, difficulty: Difficulty): boolean {
  return count >= (difficulty === 'hard' ? 6 : 2) && count <= (difficulty === 'easy' ? 8 : difficulty === 'normal' ? 14 : 40)
}
export function pairsFor(level: Level, source?: RoundPool | number): PairItem[] {
  const seen = new Set<string>()
  return poolFor(level, source).words.filter((word): word is PairItem => {
    const meaning = word.meaning?.trim()
    if (!meaning || seen.has(meaning)) return false
    seen.add(meaning); return true
  })
}
export function compoundsFor(level: Level, source?: RoundPool | number): PairItem[] {
  const chars = new Set(poolFor(level, source).kanji.map(item => item.id))
  return poolFor(level, source).words.filter((word): word is PairItem => !!word.meaning && /^[\u3400-\u9fff々]{2,}$/.test(word.word) && [...word.word].every(char => chars.has(char)))
}
export function searchWordsFor(level: Level, source?: RoundPool | number) {
  const readings = new Set<string>()
  return poolFor(level, source).words.filter(word => {
    const reading = hiragana(word.reading)
    if (reading.length < 3 || reading.length > 7 || readings.has(reading) || [...reading].reverse().join('') === reading) return false
    readings.add(reading); return true
  })
}
