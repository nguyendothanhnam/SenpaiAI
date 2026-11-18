import type { Alphabet, Difficulty, WordItem } from './types'
import { DIFFICULTY, LEVELS } from './types'
import { BASE_KANA, kanaWord } from './cipher'
import { pick, shuffle } from './random'
export interface Memory { grid: string[]; sequence: string[]; entered: number; phase: 'showing' | 'input'; showingMs: number; durationMs: number }
export function createMemory(pool: WordItem[], alphabet: Alphabet, difficulty: Difficulty, random: () => number): Memory {
  const available = new Set(pool.flatMap(word => [...kanaWord(word, alphabet)]))
  const grid = shuffle([...available].filter(char => char !== 'ー'), random).slice(0, 9)
  if (grid.length < 4) throw new Error('insufficient_kana')
  return { grid, sequence: [pick(grid, random), pick(grid, random)], entered: 0, phase: 'showing', showingMs: 0, durationMs: Math.max(320, DIFFICULTY[difficulty].memoryMs - LEVELS.indexOf(pool[0]?.level || 'N5') * 40) }
}
export function memoryInput(memory: Memory, kana: string): 'ignored' | 'wrong' | 'correct' | 'complete' {
  if (memory.phase !== 'input' || !memory.grid.includes(kana)) return 'ignored'
  if (memory.sequence[memory.entered] !== kana) return 'wrong'
  return memory.entered + 1 === memory.sequence.length ? 'complete' : 'correct'
}
export function extendMemory(memory: Memory, random: () => number): Memory {
  return { ...memory, sequence: [...memory.sequence, pick(memory.grid, random)], entered: 0, phase: 'showing', showingMs: 0 }
}
export const memoryPoints = (length: number) => length * length * 10
export const fallbackKanaCount = BASE_KANA.length
