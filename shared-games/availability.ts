import { poolFor, type RoundPool } from './pool'
import { strokeMetadata } from './data'
import { compoundsFor, pairsFor, searchWordsFor, missingEligible } from './phase2-data'
import { searchRules } from './wordsearch'
import { ninjaValue } from './ninja'
import { answerOf } from './falling'
import { cipherCandidates, kanaWord } from './cipher'
import { shiritoriStart } from './shiritori'
import { Random } from './random'
import type { Alphabet, AnswerMode, Difficulty, Game, Level } from './types'
export const MIN_DATA = { falling: 12, shiritori: 12, cipher: 12, memory: 12, battle: 12, workshop: 12, wordsearch: 12, ninja: 12, missing: 12, cipherQuestions: 8, memoryKana: 4 }
export function availability(game: Game, level: Level, difficulty: Difficulty = 'normal', mode: AnswerMode = 'reading', alphabet: Alphabet = 'hiragana', source?: RoundPool) {
  const prepared = poolFor(level, source), pool = prepared.words
  let count = game === 'falling' ? prepared.kanji.filter(item => answerOf(item, mode)).length : pool.length
  if (game === 'battle') count = pairsFor(level, source).length
  if (game === 'workshop') count = compoundsFor(level, source).length
  if (game === 'wordsearch') count = searchWordsFor(level, source).filter(word => word.reading.length <= searchRules(difficulty).maxLength).length
  if (game === 'ninja') count = pool.filter(word => ninjaValue(word, mode)).length
  if (game === 'missing') count = (source ? (prepared.strokes || []).map(glyph => ({ level: glyph.level, count: glyph.paths.length })) : strokeMetadata).filter(item => item.level === level && missingEligible(item.count, difficulty)).length
  let usable = count >= MIN_DATA[game]
  if (game === 'falling') usable &&= new Set(prepared.kanji.map(item => answerOf(item, mode)).filter(Boolean)).size >= 4
  if (game === 'shiritori') usable &&= !!shiritoriStart(pool, new Random(1).next)
  if (game === 'cipher') usable &&= cipherCandidates(pool, difficulty).length >= MIN_DATA.cipherQuestions
  if (game === 'memory') usable &&= new Set(pool.flatMap(word => [...kanaWord(word, alphabet)]).filter(char => char !== 'ー')).size >= MIN_DATA.memoryKana
  if (game === 'ninja') usable &&= new Set(pool.map(word => ninjaValue(word, mode)).filter(Boolean)).size >= 4
  return { enabled: usable, count, minimum: MIN_DATA[game] }
}
