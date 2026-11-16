import { pick, shuffle } from './random'
import type { Difficulty, Level, PairItem } from './types'
import { LEVELS } from './types'
export interface Battle {
  stage: number; boss: boolean; hp: number; maxHp: number; combo: number; comboMs: number
  attackInMs: number; pairs: PairItem[]; rightOrder: string[]; matched: string[]; boardId: number; lastDamage: number
}
export function battleRules(level: Level, difficulty: Difficulty, stage: number) {
  const boss = stage === 3 || stage === 5
  const hp = (60 + stage * 20 + LEVELS.indexOf(level) * 10) * (boss ? 2 : 1)
  return { boss, hp, pairs: difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : 5, attackMs: Math.max(6000, (difficulty === 'easy' ? 19000 : difficulty === 'normal' ? 15000 : 11500) - stage * 600) }
}
export function createBattle(pool: PairItem[], level: Level, difficulty: Difficulty, stage: number, random: () => number, boardId = 1): Battle {
  const rules = battleRules(level, difficulty, stage), pairs = shuffle(pool, random).slice(0, rules.pairs)
  if (pairs.length < rules.pairs || new Set(pairs.map(pair => pair.meaning)).size !== pairs.length) throw new Error('insufficient_pairs')
  return { stage, boss: rules.boss, hp: rules.hp, maxHp: rules.hp, combo: 0, comboMs: 0, attackInMs: rules.attackMs, pairs, rightOrder: shuffle(pairs.map(pair => pair.id), random), matched: [], boardId, lastDamage: 0 }
}
export function battleDamage(combo: number): number { return 25 + Math.min(25, Math.max(0, combo - 1) * 5) }
export function battleMatch(board: Battle, wordId: string, meaningId: string): 'ignored' | 'wrong' | 'correct' {
  if (board.matched.includes(wordId) || board.matched.includes(meaningId) || !board.pairs.some(pair => pair.id === wordId) || !board.pairs.some(pair => pair.id === meaningId)) return 'ignored'
  return wordId === meaningId ? 'correct' : 'wrong'
}
// Useful to portable clients which want a suggestion without exposing identities in a view.
export function battleUnmatched(board: Battle, random: () => number): PairItem | undefined {
  const remaining = board.pairs.filter(pair => !board.matched.includes(pair.id))
  return remaining.length ? pick(remaining, random) : undefined
}
