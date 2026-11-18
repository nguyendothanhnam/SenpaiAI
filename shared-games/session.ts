import type { Alphabet, AnswerMode, Difficulty, Game, Level, Session, WordItem } from './types'
import { DIFFICULTY } from './types'
import { Random, pick } from './random'
import { poolFor, type RoundPool } from './pool'
import { availability } from './availability'
import { fallingPoints, fallingRules, question, type FallingQuestion } from './falling'
import { firstKana, lastKana, shiritoriChoices, shiritoriStart } from './shiritori'
import { cipherCandidates, cipherPoolForProgress, cipherPoints, createCipher, revealCipher, solveCipher, type Cipher } from './cipher'
import { createMemory, extendMemory, memoryInput, memoryPoints, type Memory } from './memory'
import { award, finish, loseLife } from './lifecycle'
export { award, finish, loseLife } from './lifecycle'
import { setupWave2, stepWave2 } from './wave2'
import type { Battle } from './battle'
import type { Workshop } from './workshop'
import type { Cell, WordSearch } from './wordsearch'
import type { Ninja } from './ninja'
import type { MissingStroke } from './missing-stroke'
import type { SwipePoint } from './geometry'

export interface Round {
  pool?: RoundPool
  session: Session; seed: number; mode: AnswerMode; alphabet: Alphabet; feedback: 'correct' | 'wrong' | 'hint' | null
  falling: { questions: FallingQuestion[]; spawnIn: number; nextId: number }
  shiritori: { current: WordItem; choices: WordItem[]; used: string[] } | null
  cipher: Cipher | null; cipherUsed: string[]; memory: Memory | null
  battle: Battle | null; workshop: Workshop | null; wordsearch: WordSearch | null; ninja: Ninja | null; missing: MissingStroke | null
}
export type Action = { type: 'tick'; ms: number } | { type: 'answer'; value: string; id?: number; questionId?: string } | { type: 'pause' | 'resume' | 'quit' | 'hint' | 'undo' | 'clear' } | { type: 'match'; wordId: string; meaningId: string; boardId: number } | { type: 'tile'; id: string } | { type: 'selectPath'; cells: Cell[] } | { type: 'slash'; points: SwipePoint[] }
export function createRound(game: Game, level: Level, difficulty: Difficulty, seed: number, mode: AnswerMode = 'reading', alphabet: Alphabet = 'hiragana', id = String(seed), source?: RoundPool): Round {
  if (!availability(game, level, difficulty, mode, alphabet, source).enabled) throw new Error('insufficient_data')
  const prepared = poolFor(level, source)
  const random = new Random(seed)
  const round: Round = {
    session: { id, game, level, difficulty, status: 'playing', score: 0, lives: DIFFICULTY[difficulty].lives, elapsedMs: 0, correct: 0, mistakes: 0, chain: 0, longestChain: 0 },
    pool: source ? prepared : undefined, seed, mode, alphabet, feedback: null, falling: { questions: [], spawnIn: 0, nextId: 1 }, shiritori: null, cipher: null, cipherUsed: [], memory: null,
    battle: null, workshop: null, wordsearch: null, ninja: null, missing: null,
  }
  if (game === 'falling') {
    const rules = fallingRules(level, difficulty, 0)
    round.falling = { questions: [question(poolFor(level, round.pool).kanji, mode, random.next, 1, rules.durationMs)], spawnIn: rules.spawnMs, nextId: 2 }
  }
  if (game === 'shiritori') {
    const pool = poolFor(level, round.pool).words, current = shiritoriStart(pool, random.next)!
    round.shiritori = { current, choices: shiritoriChoices(current, pool, [current.id], random.next), used: [current.id] }
  }
  if (game === 'cipher') { round.cipher = createCipher(pick(cipherPoolForProgress(poolFor(level, round.pool).words, difficulty, 0), random.next), alphabet, difficulty, random.next); round.cipherUsed = [round.cipher.word.id] }
  if (game === 'memory') round.memory = createMemory(poolFor(level, round.pool).words, alphabet, difficulty, random.next)
  setupWave2(round, random)
  round.seed = random.seed
  return round
}
export function reduceRound(state: Round, action: Action): Round {
  if (state.session.status === 'finished') return state
  if (action.type === 'quit') return { ...state, session: finish(state.session, 'quit') }
  if (action.type === 'pause') return state.session.status === 'playing' ? { ...state, session: { ...state.session, status: 'paused' } } : state
  if (action.type === 'resume') return state.session.status === 'paused' ? { ...state, session: { ...state.session, status: 'playing' } } : state
  if (state.session.status !== 'playing') return state
  const round: Round = { ...state, session: { ...state.session }, falling: { ...state.falling }, cipherUsed: [...state.cipherUsed] }
  const random = new Random(state.seed), { game, level, difficulty } = round.session
  if (action.type === 'tick') {
    if (!Number.isFinite(action.ms) || action.ms <= 0) return state
    const ms = Math.min(action.ms, 250)
    round.session.elapsedMs += ms
    if (game === 'falling') {
      round.falling.questions = state.falling.questions.map(q => ({ ...q, ageMs: q.ageMs + ms }))
      const expired = round.falling.questions.filter(q => q.ageMs >= q.durationMs)
      for (let i = 0; i < expired.length; i++) { round.session = loseLife(round.session); round.feedback = 'wrong' }
      round.falling.questions = round.falling.questions.filter(q => q.ageMs < q.durationMs)
      const rules = fallingRules(level, difficulty, round.session.correct)
      round.falling.spawnIn -= ms
      if (round.session.status === 'playing' && (round.falling.spawnIn <= 0 || !round.falling.questions.length) && round.falling.questions.length < rules.maxActive) {
        round.falling.questions.push(question(poolFor(level, round.pool).kanji, round.mode, random.next, round.falling.nextId++, rules.durationMs))
        round.falling.spawnIn = rules.spawnMs
      }
    }
    if (game === 'memory' && round.memory?.phase === 'showing') {
      const memory = { ...round.memory, showingMs: round.memory.showingMs + ms }
      if (memory.showingMs >= (memory.sequence.length + 1) * memory.durationMs) memory.phase = 'input'
      round.memory = memory
    }
  }
  if (action.type === 'hint' && round.cipher) {
    const next = revealCipher(round.cipher)
    if (next !== round.cipher) { round.cipher = next; round.feedback = 'hint' }
  }
  if (action.type === 'answer') {
    if (game === 'falling') {
      const active = round.falling.questions.find(q => q.id === action.id)
      if (!active || !active.options.includes(action.value)) return state
      const correct = active.answer === action.value
      round.session = correct ? award(round.session, fallingPoints(active.ageMs, active.durationMs)) : loseLife(round.session)
      round.feedback = correct ? 'correct' : 'wrong'
      round.falling.questions = round.falling.questions.filter(q => q.id !== active.id)
    }
    if (game === 'shiritori' && round.shiritori) {
      const board = round.shiritori, chosen = board.choices.find(word => word.id === action.value)
      if (!chosen) return state
      if (lastKana(chosen.reading) === 'ん' && firstKana(chosen.reading) === lastKana(board.current.reading)) {
        round.session = finish(loseLife(round.session), 'endsN'); round.feedback = 'wrong'
      } else if (board.used.includes(chosen.id) || firstKana(chosen.reading) !== lastKana(board.current.reading)) {
        round.session = loseLife(round.session); round.feedback = 'wrong'
        round.shiritori = { ...board, choices: board.choices.filter(word => word.id !== chosen.id) }
      } else {
        round.session = award(round.session, 100 + Math.min(200, round.session.chain * 10)); round.feedback = 'correct'
        const used = [...board.used, chosen.id], choices = shiritoriChoices(chosen, poolFor(level, round.pool).words, used, random.next)
        round.shiritori = { current: chosen, used, choices }
        if (!choices.length) round.session = finish(round.session, 'exhausted')
      }
    }
    if (game === 'cipher' && round.cipher) {
      if (action.questionId && action.questionId !== round.cipher.word.id) return state
      if (!action.value.trim()) return state
      if (solveCipher(round.cipher, action.value)) {
        round.session = award(round.session, cipherPoints(round.cipher)); round.feedback = 'correct'
        const pool = cipherCandidates(poolFor(level, round.pool).words, difficulty).filter(word => !round.cipherUsed.includes(word.id))
        if (round.session.correct >= 10) round.session = finish(round.session, 'completed')
        else if (!pool.length) round.session = finish(round.session, 'exhausted')
        else {
          round.cipher = createCipher(pick(cipherPoolForProgress(pool, difficulty, round.session.correct), random.next), round.alphabet, difficulty, random.next)
          round.cipherUsed.push(round.cipher.word.id)
        }
      } else { round.session = loseLife(round.session); round.feedback = 'wrong' }
    }
    if (game === 'memory' && round.memory) {
      const result = memoryInput(round.memory, action.value)
      if (result === 'ignored') return state
      if (result === 'wrong') {
        round.session = loseLife(round.session); round.feedback = 'wrong'
        round.memory = { ...round.memory, entered: 0, phase: 'showing', showingMs: 0 }
      } else if (result === 'complete') {
        round.session = award(round.session, memoryPoints(round.memory.sequence.length)); round.feedback = 'correct'
        if (round.memory.sequence.length >= 16) round.session = finish(round.session, 'completed')
        else round.memory = extendMemory(round.memory, random.next)
      } else round.memory = { ...round.memory, entered: round.memory.entered + 1 }
    }
  }
  stepWave2(round, action, random)
  round.seed = random.seed
  return round
}
