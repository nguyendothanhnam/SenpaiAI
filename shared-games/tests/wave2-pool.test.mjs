import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const e = require('../../tmp/minigames-tests/index.js')
const source = {
  kanji: e.kanjiFor('N3'),
  words: e.wordsFor('N3').map(word => ({ ...word, id: `api:${word.id}` })),
  strokes: e.strokeGlyphs.filter(glyph => glyph.level === 'N3').map(glyph => ({ ...glyph, id: `api:${glyph.id}` })),
}
const create = game => e.createRound(game, 'N3', 'normal', 41, 'reading', 'hiragana', `native-${game}`, source)
test('every wave-2 game rejects an explicitly empty prepared pool', () => {
  for (const game of e.WAVE2_GAMES) assert.throws(() => e.createRound(game, 'N3', 'normal', 1, 'reading', 'hiragana', 'empty', { kanji: [], words: [], strokes: [] }), /insufficient_data/)
})
test('battle and workshop complete exclusively from prepared pairs/compounds on subsequent boards', () => {
  let round = create('battle')
  for (let turn = 0; turn < 100 && round.session.status === 'playing'; turn++) {
    const board = round.battle, pair = board.pairs.find(pair => !board.matched.includes(pair.id))
    assert.ok(pair.id.startsWith('api:'))
    round = e.reduceRound(round, { type: 'match', wordId: pair.id, meaningId: pair.id, boardId: board.boardId })
  }
  assert.equal(round.session.reason, 'completed')
  round = create('workshop')
  for (let turn = 0; turn < 8; turn++) {
    const board = round.workshop, used = new Set()
    assert.ok(board.target.id.startsWith('api:'))
    for (const char of board.target.word) {
      const card = board.cards.find(card => card.kanji === char && !used.has(card.id))
      used.add(card.id); round = e.reduceRound(round, { type: 'tile', id: card.id })
    }
    round = e.reduceRound(round, { type: 'answer', value: '', questionId: String(board.questionId) })
  }
  assert.equal(round.session.reason, 'completed')
  assert.equal(round.workshop.discovered.length, 8)
  assert.ok(round.workshop.discovered.every(id => id.startsWith('api:')))
})
test('word-search and ninja never silently substitute bundled vocabulary', () => {
  let round = create('wordsearch')
  for (const word of round.wordsearch.words) {
    assert.ok(word.item.id.startsWith('api:'))
    round = e.reduceRound(round, { type: 'selectPath', cells: word.cells })
  }
  assert.equal(round.session.reason, 'completed')
  round = create('ninja')
  const firstWave = round.ninja.wave
  for (let i = 0; i < 100 && round.ninja.wave === firstWave; i++) round = e.reduceRound(round, { type: 'tick', ms: 100 })
  assert.ok(round.ninja.wave > firstWave)
  assert.ok(round.ninja.request.id.startsWith('api:'))
  assert.ok(round.ninja.entities.every(item => item.item.id.startsWith('api:')))
})
test('missing strokes use only prepared glyphs for all ten questions and their distractors', () => {
  let round = create('missing')
  const paths = new Set(source.strokes.flatMap(glyph => glyph.paths))
  for (let i = 0; i < 10; i++) {
    assert.ok(round.missing.glyph.id.startsWith('api:'))
    assert.ok(round.missing.choices.every(choice => paths.has(choice.path)))
    round = e.reduceRound(round, { type: 'answer', value: round.missing.targetId, questionId: String(round.missing.questionId) })
  }
  assert.equal(round.session.reason, 'completed')
})
test('portable data helpers retain Array.flatMap compatibility used by the existing web adapter', () => {
  assert.deepEqual(e.LEVELS.flatMap(e.compoundsFor), e.LEVELS.flatMap(level => e.compoundsFor(level)))
})
