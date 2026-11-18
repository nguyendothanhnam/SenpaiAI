import { poolFor } from './pool'
import { compoundsFor, pairsFor, searchWordsFor } from './phase2-data'
import { battleDamage, battleMatch, battleRules, createBattle } from './battle'
import { createWorkshop, selectWorkshopCard, validRecipe } from './workshop'
import { checkSearchPath, createWordSearch } from './wordsearch'
import { createNinja, newNinjaWave, slashNinja, tickNinja } from './ninja'
import { createMissingStroke, missingPoints } from './missing-stroke'
import { award, finish, loseLife } from './lifecycle'
import type { Random } from './random'
import type { Action, Round } from './session'
export function setupWave2(round: Round, random: Random): void {
  const { game, level, difficulty } = round.session
  if (game === 'battle') round.battle = createBattle(pairsFor(level, round.pool), level, difficulty, 1, random.next)
  if (game === 'workshop') round.workshop = createWorkshop(compoundsFor(level, round.pool), poolFor(level, round.pool).kanji, difficulty, random.next)
  if (game === 'wordsearch') round.wordsearch = createWordSearch(searchWordsFor(level, round.pool), round.alphabet, difficulty, random.next)
  if (game === 'ninja') round.ninja = createNinja(poolFor(level, round.pool).words, level, difficulty, round.mode, random.next)
  if (game === 'missing') {
    round.missing = createMissingStroke(level, difficulty, random.next, [], 1, round.pool ? round.pool.strokes || [] : undefined)
    if (!round.missing) throw new Error('insufficient_stroke_choices')
  }
}
export function stepWave2(round: Round, action: Action, random: Random): void {
  const { game, level, difficulty } = round.session
  if (action.type === 'tick') {
    const ms = Math.min(action.ms, 250)
    if (game === 'battle' && round.battle) {
      const board = { ...round.battle, attackInMs: round.battle.attackInMs - ms, comboMs: round.battle.comboMs + ms }
      if (board.attackInMs <= 0) {
        round.session = loseLife(round.session); round.feedback = 'wrong'; board.combo = 0
        board.attackInMs = battleRules(level, difficulty, board.stage).attackMs
      }
      round.battle = board
    }
    if (game === 'missing' && round.missing) round.missing = { ...round.missing, ageMs: round.missing.ageMs + ms }
    if (game === 'ninja' && round.ninja) {
      const next = tickNinja(round.ninja, ms, round.mode)
      round.ninja = next.board
      for (let i = 0; i < next.missed; i++) { round.session = loseLife(round.session); round.feedback = 'wrong' }
      if (round.session.status === 'playing' && !round.ninja.entities.length) round.ninja = newNinjaWave(round.ninja, poolFor(level, round.pool).words, level, difficulty, round.mode, random.next)
    }
  }
  if (game === 'battle' && action.type === 'match' && round.battle && action.boardId === round.battle.boardId) {
    const result = battleMatch(round.battle, action.wordId, action.meaningId)
    if (result === 'ignored') return
    if (result === 'wrong') { round.session = loseLife(round.session); round.feedback = 'wrong'; round.battle = { ...round.battle, combo: 0 }; return }
    const combo = round.battle.comboMs <= 5000 ? round.battle.combo + 1 : 1, damage = battleDamage(combo)
    const board = { ...round.battle, combo, comboMs: 0, lastDamage: damage, hp: Math.max(0, round.battle.hp - damage), matched: [...round.battle.matched, action.wordId] }
    round.session = award(round.session, damage * 4); round.feedback = 'correct'; round.battle = board
    if (!board.hp && board.stage >= 5) round.session = finish(round.session, 'completed')
    else if (!board.hp || board.matched.length === board.pairs.length) {
      const next = createBattle(pairsFor(level, round.pool), level, difficulty, board.hp ? board.stage : board.stage + 1, random.next, board.boardId + 1)
      round.battle = { ...next, combo, hp: board.hp || next.hp, maxHp: board.hp ? board.maxHp : next.maxHp, attackInMs: board.hp ? board.attackInMs : next.attackInMs, lastDamage: damage }
    }
  }
  if (game === 'workshop' && round.workshop) {
    if (action.type === 'tile') round.workshop = selectWorkshopCard(round.workshop, action.id)
    if (action.type === 'undo') round.workshop = { ...round.workshop, selected: round.workshop.selected.slice(0, -1) }
    if (action.type === 'clear') round.workshop = { ...round.workshop, selected: [] }
    if (action.type === 'answer' && action.questionId === String(round.workshop.questionId)) {
      if (round.workshop.selected.length !== round.workshop.target.word.length) return
      if (!validRecipe(round.workshop, compoundsFor(level, round.pool))) { round.session = loseLife(round.session); round.feedback = 'wrong'; return }
      const board = round.workshop, discovered = [...new Set([...board.discovered, board.target.id])], used = [...board.used, board.target.id]
      round.session = award(round.session, board.target.word.length * 60); round.feedback = 'correct'
      round.workshop = { ...board, discovered, used }
      if (round.session.correct >= 8) round.session = finish(round.session, 'completed')
      else {
        const next = createWorkshop(compoundsFor(level, round.pool), poolFor(level, round.pool).kanji, difficulty, random.next, used, discovered, board.questionId + 1)
        if (!next) round.session = finish(round.session, 'exhausted')
        else round.workshop = next
      }
    }
  }
  if (game === 'wordsearch' && round.wordsearch && action.type === 'selectPath') {
    const result = checkSearchPath(round.wordsearch, action.cells)
    if (result.kind === 'wrong') { round.session = loseLife(round.session); round.feedback = 'wrong' }
    if (result.kind === 'found' && result.id) {
      const word = round.wordsearch.words.find(word => word.item.id === result.id)!
      round.session = award(round.session, word.text.length * 30); round.feedback = 'correct'
      round.wordsearch = { ...round.wordsearch, found: [...round.wordsearch.found, result.id] }
      if (round.wordsearch.found.length === round.wordsearch.words.length) round.session = finish(round.session, 'completed')
    }
  }
  if (game === 'ninja' && round.ninja && action.type === 'slash') {
    const next = slashNinja(round.ninja, action.points, round.mode)
    round.ninja = next.board
    for (let i = 0; i < next.correct; i++) { round.session = award(round.session, Math.floor(next.points / next.correct) + (i < next.points % next.correct ? 1 : 0)); round.feedback = 'correct' }
    for (let i = 0; i < next.wrong; i++) { round.session = loseLife(round.session); round.feedback = 'wrong' }
    if (round.session.status === 'playing' && round.ninja.hits >= round.ninja.goal) round.session = finish(round.session, 'completed')
  }
  if (game === 'missing' && round.missing && action.type === 'answer' && action.questionId === String(round.missing.questionId)) {
    if (!round.missing.choices.some(choice => choice.id === action.value)) return
    if (action.value !== round.missing.targetId) {
      round.session = loseLife(round.session); round.feedback = 'wrong'
      round.missing = { ...round.missing, choices: round.missing.choices.filter(choice => choice.id !== action.value) }
    } else {
      round.session = award(round.session, missingPoints(round.missing.ageMs)); round.feedback = 'correct'
      if (round.session.correct >= 10) round.session = finish(round.session, 'completed')
      else {
        const next = createMissingStroke(level, difficulty, random.next, [...round.missing.used, round.missing.glyph.id], round.missing.questionId + 1, round.pool ? round.pool.strokes || [] : undefined)
        if (!next) round.session = finish(round.session, 'exhausted')
        else round.missing = next
      }
    }
  }
}
