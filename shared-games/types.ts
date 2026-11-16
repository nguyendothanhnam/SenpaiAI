export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type Level = typeof LEVELS[number]
export const WAVE1_GAMES = ['falling', 'shiritori', 'cipher', 'memory'] as const
export const WAVE2_GAMES = ['battle', 'workshop', 'wordsearch', 'ninja', 'missing'] as const
export const GAMES = [...WAVE1_GAMES, ...WAVE2_GAMES] as const
export type Game = typeof GAMES[number]
export type Difficulty = 'easy' | 'normal' | 'hard'
export type Alphabet = 'hiragana' | 'katakana'
export type AnswerMode = 'reading' | 'meaning'
export interface KanjiItem { id: string; level: Level; readings: string[]; meaning: string }
export interface WordItem { id: string; word: string; reading: string; level: Level; meaning?: string }
export interface PairItem extends WordItem { meaning: string }
export interface StrokeGlyph { id: string; level: Level; viewBox: string; paths: string[] }
export type Status = 'playing' | 'paused' | 'finished'
export type EndReason = 'lives' | 'completed' | 'exhausted' | 'endsN' | 'quit'
export interface Session {
  id: string; game: Game; level: Level; difficulty: Difficulty; status: Status
  score: number; lives: number; elapsedMs: number; correct: number; mistakes: number
  chain: number; longestChain: number; reason?: EndReason
}
export const DIFFICULTY = {
  easy: { lives: 4, speed: .8, memoryMs: 900, cipherReveal: 2 },
  normal: { lives: 3, speed: 1, memoryMs: 700, cipherReveal: 1 },
  hard: { lives: 2, speed: 1.3, memoryMs: 500, cipherReveal: 0 },
} as const
