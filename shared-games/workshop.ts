import { shuffle } from './random'
import type { Difficulty, KanjiItem, PairItem } from './types'
export interface KanjiCard { id: string; kanji: string }
export interface Workshop { target: PairItem; cards: KanjiCard[]; selected: string[]; discovered: string[]; used: string[]; questionId: number }
export function createWorkshop(pool: PairItem[], kanji: KanjiItem[], difficulty: Difficulty, random: () => number, used: string[] = [], discovered: string[] = [], questionId = 1): Workshop | null {
  const target = shuffle(pool.filter(word => !used.includes(word.id)), random)[0]
  if (!target) return null
  const letters = [...target.word], available = kanji.filter(item => item.level === target.level && !letters.includes(item.id))
  const noise = shuffle(available, random).slice(0, difficulty === 'easy' ? 2 : difficulty === 'normal' ? 4 : 6).map(item => item.id)
  if (noise.length < 2) throw new Error('insufficient_kanji_cards')
  const cards = shuffle([...letters, ...noise].map((char, index) => ({ id: `${questionId}:${index}`, kanji: char })), random)
  return { target, cards, selected: [], discovered: [...discovered], used: [...used], questionId }
}
export function selectWorkshopCard(board: Workshop, id: string): Workshop {
  if (board.selected.length >= board.target.word.length || board.selected.includes(id) || !board.cards.some(card => card.id === id)) return board
  return { ...board, selected: [...board.selected, id] }
}
export function assembledWord(board: Workshop): string { return board.selected.map(id => board.cards.find(card => card.id === id)?.kanji || '').join('') }
export function validRecipe(board: Workshop, pool: PairItem[]): boolean {
  const value = assembledWord(board)
  return value === board.target.word && pool.some(word => word.level === board.target.level && word.word === value)
}
export function mergeRecipes(existing: string[], added: string[], pool: PairItem[]): string[] {
  const known = new Set(pool.map(word => word.id))
  return [...new Set([...existing, ...added].filter(id => known.has(id)))].sort()
}
