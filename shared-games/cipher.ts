import { hiragana, katakana } from './shiritori'
import { shuffle } from './random'
import type { Alphabet, Difficulty, WordItem } from './types'
import { DIFFICULTY, LEVELS } from './types'
export const BASE_KANA = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん']
export function kanaWord(word: WordItem, alphabet: Alphabet) { return alphabet === 'hiragana' ? hiragana(word.reading) : katakana(word.reading) }
export interface Cipher { word: WordItem; plain: string[]; encoded: string[]; table: { plain: string; code: string }[]; revealed: number[]; hints: number }
export function cipherCandidates(pool: WordItem[], difficulty: Difficulty): WordItem[] {
  const [min, max] = difficulty === 'easy' ? [2, 4] : difficulty === 'normal' ? [3, 6] : [4, 10]
  return pool.filter(word => word.reading.length >= min && word.reading.length <= max)
}
export function cipherPoolForProgress(pool: WordItem[], difficulty: Difficulty, correct: number): WordItem[] {
  const candidates = cipherCandidates(pool, difficulty)
  const start = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 3 : 4
  const target = start + Math.floor(correct / 3)
  const band = candidates.filter(word => word.reading.length >= target && word.reading.length <= target + 1)
  return band.length ? band : candidates
}
export function createCipher(word: WordItem, alphabet: Alphabet, difficulty: Difficulty, random: () => number): Cipher {
  const plain = [...kanaWord(word, alphabet)]
  const symbols = [...new Set([...BASE_KANA.map(char => alphabet === 'katakana' ? katakana(char) : char), ...plain])]
  // A non-zero cyclic shift of a random order is a bijection with no fixed points.
  const order = shuffle(symbols, random), shift = 1 + Math.floor(random() * (order.length - 1))
  const table = order.map((char, index) => ({ plain: char, code: order[(index + shift) % order.length] }))
  const encoded = plain.map(char => table.find(pair => pair.plain === char)!.code)
  const revealCount = Math.max(0, DIFFICULTY[difficulty].cipherReveal - Math.floor(LEVELS.indexOf(word.level) / 2))
  const revealed = shuffle(plain.map((_, index) => index), random).slice(0, Math.min(plain.length - 1, revealCount))
  return { word, plain, encoded, table, revealed, hints: 0 }
}
export function revealCipher(cipher: Cipher): Cipher {
  const index = cipher.plain.findIndex((_, i) => !cipher.revealed.includes(i))
  return index < 0 ? cipher : { ...cipher, revealed: [...cipher.revealed, index], hints: cipher.hints + 1 }
}
export function solveCipher(cipher: Cipher, answer: string): boolean { return hiragana(answer.trim()) === hiragana(cipher.plain.join('')) }
export const cipherPoints = (cipher: Cipher) => Math.max(10, cipher.plain.length * 40 - cipher.hints * 25)
