import { hiragana } from './shiritori'
import { pick, shuffle } from './random'
import type { AnswerMode, Difficulty, KanjiItem, Level } from './types'
import { DIFFICULTY, LEVELS } from './types'
export interface FallingQuestion { id: number; item: KanjiItem; answer: string; options: string[]; ageMs: number; durationMs: number }
export const answerOf = (item: KanjiItem, mode: AnswerMode) => mode === 'meaning' ? item.meaning.trim() : hiragana(item.readings[0] || '')
export function question(pool: KanjiItem[], mode: AnswerMode, random: () => number, id: number, durationMs: number): FallingQuestion {
  const playable = pool.filter(item => answerOf(item, mode))
  const item = pick(playable, random), answer = answerOf(item, mode)
  // Exclude every accepted reading, not just the displayed canonical answer.
  const accepted = new Set(mode === 'reading' ? item.readings.map(hiragana) : [answer])
  const distractors = shuffle([...new Set(playable.filter(other => other.level === item.level).map(other => answerOf(other, mode)))].filter(value => value && !accepted.has(value)), random).slice(0, 3)
  if (distractors.length < 3) throw new Error('insufficient_answers')
  return { id, item, answer, options: shuffle([answer, ...distractors], random), ageMs: 0, durationMs }
}
export function fallingRules(level: Level, difficulty: Difficulty, correct: number) {
  const stage = Math.floor(correct / 5), rank = LEVELS.indexOf(level)
  return { durationMs: Math.max(2800, (12500 - rank * 600 - stage * 650) / DIFFICULTY[difficulty].speed), maxActive: Math.min(3, 1 + Math.floor(stage / 2)), spawnMs: Math.max(1800, 4200 - stage * 180) }
}
export function fallingPoints(ageMs: number, durationMs: number): number { return 50 + Math.round(100 * Math.max(0, Math.min(1, 1 - ageMs / durationMs))) }
