import { BASE_KANA, kanaWord } from './cipher'
import { shuffle, pick } from './random'
import type { Alphabet, Difficulty, WordItem } from './types'
export interface Cell { row: number; col: number }
export interface HiddenWord { item: WordItem; text: string; cells: Cell[] }
export interface WordSearch { size: number; grid: string[][]; words: HiddenWord[]; found: string[]; reverse: boolean }
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]] as const
const cellKey = (cell: Cell) => `${cell.row},${cell.col}`
export function lineCells(start: Cell, end: Cell): Cell[] {
  if (![start.row, start.col, end.row, end.col].every(Number.isInteger)) return []
  const dr = end.row - start.row, dc = end.col - start.col
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return []
  const length = Math.max(Math.abs(dr), Math.abs(dc))
  if (length > 20) return []
  return Array.from({ length: length + 1 }, (_, i) => ({ row: start.row + Math.sign(dr) * i, col: start.col + Math.sign(dc) * i }))
}
function samePath(a: Cell[], b: Cell[]) { return a.length === b.length && a.every((cell, i) => cell.row === b[i].row && cell.col === b[i].col) }
export function occurrences(grid: string[][], text: string): Cell[][] {
  const found = new Map<string, Cell[]>(), chars = [...text], size = grid.length
  if (!chars.length) return []
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) for (const [dr, dc] of DIRECTIONS) {
    const cells = chars.map((_, i) => ({ row: row + i * dr, col: col + i * dc }))
    if (!cells.every((cell, i) => grid[cell.row]?.[cell.col] === chars[i])) continue
    const forward = cells.map(cellKey).join(';'), backward = [...cells].reverse().map(cellKey).join(';')
    found.set(forward < backward ? forward : backward, cells)
  }
  return [...found.values()]
}
export function searchRules(difficulty: Difficulty) {
  return { size: difficulty === 'easy' ? 8 : difficulty === 'normal' ? 9 : 10, count: difficulty === 'easy' ? 4 : difficulty === 'normal' ? 5 : 6, maxLength: difficulty === 'easy' ? 4 : difficulty === 'normal' ? 6 : 7, reverse: difficulty === 'hard' }
}
export function createWordSearch(pool: WordItem[], alphabet: Alphabet, difficulty: Difficulty, random: () => number): WordSearch {
  const rules = searchRules(difficulty)
  const candidates = pool.filter(word => kanaWord(word, alphabet).length >= 3 && kanaWord(word, alphabet).length <= rules.maxLength)
  for (let attempt = 0; attempt < 24; attempt++) {
    const selected: { item: WordItem; text: string }[] = []
    for (const item of shuffle(candidates, random)) {
      const text = kanaWord(item, alphabet), reversed = [...text].reverse().join('')
      if (text === reversed || selected.some(word => word.text.includes(text) || text.includes(word.text) || word.text.includes(reversed) || reversed.includes(word.text))) continue
      selected.push({ item, text })
      if (selected.length === rules.count) break
    }
    if (selected.length !== rules.count) continue
    let grid = Array.from({ length: rules.size }, () => Array<string>(rules.size).fill(''))
    const words: HiddenWord[] = []
    for (let i = 0; i < selected.length; i++) {
      const chosen = selected[i], chars = [...chosen.text]
      // Each board includes a horizontal, vertical and diagonal placement.
      const base = DIRECTIONS[i % 3], sign = rules.reverse && random() < .5 ? -1 : 1
      const [dr, dc] = [base[0] * sign, base[1] * sign]
      const starts = shuffle(Array.from({ length: rules.size * rules.size }, (_, n) => ({ row: Math.floor(n / rules.size), col: n % rules.size })), random)
      let placed = false
      for (const start of starts) {
        const cells = chars.map((_, n) => ({ row: start.row + n * dr, col: start.col + n * dc }))
        if (!cells.every((cell, n) => cell.row >= 0 && cell.row < rules.size && cell.col >= 0 && cell.col < rules.size && (!grid[cell.row][cell.col] || grid[cell.row][cell.col] === chars[n]))) continue
        const next = grid.map(row => [...row])
        cells.forEach((cell, n) => { next[cell.row][cell.col] = chars[n] })
        if ([...words.map(word => word.text), chosen.text].some(text => occurrences(next, text).length !== 1)) continue
        grid = next; words.push({ ...chosen, cells }); placed = true; break
      }
      if (!placed) break
    }
    if (words.length !== rules.count) continue
    const letters = new Set(words.flatMap(word => [...word.text]))
    const source = [...new Set(pool.flatMap(word => [...kanaWord(word, alphabet)]))].filter(char => !letters.has(char))
    const fallback = BASE_KANA.map(char => alphabet === 'hiragana' ? char : String.fromCharCode(char.charCodeAt(0) + 0x60)).filter(char => !letters.has(char))
    const filler = source.length ? source : fallback
    if (!filler.length) continue
    grid = grid.map(row => row.map(char => char || pick(filler, random)))
    // Filler characters are absent from all targets, so they cannot create extra target occurrences.
    if (words.every(word => occurrences(grid, word.text).length === 1)) return { size: rules.size, grid, words, found: [], reverse: rules.reverse }
  }
  throw new Error('search_generation_failed')
}
export function checkSearchPath(board: WordSearch, cells: Cell[]): { kind: 'ignored' | 'wrong' | 'found'; id?: string } {
  if (cells.length < 2) return { kind: 'ignored' }
  if (!samePath(cells, lineCells(cells[0], cells[cells.length - 1])) || cells.some(cell => !board.grid[cell.row]?.[cell.col])) return { kind: 'wrong' }
  const word = board.words.find(word => samePath(cells, word.cells) || (board.reverse && samePath(cells, [...word.cells].reverse())))
  if (!word) return { kind: 'wrong' }
  return board.found.includes(word.item.id) ? { kind: 'ignored' } : { kind: 'found', id: word.item.id }
}
