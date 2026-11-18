import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createRound, reduceRound } = require('../../tmp/minigames-tests/session.js')
const { kanjiFor, wordsFor } = require('../../tmp/minigames-tests/data.js')
const { firstKana, lastKana } = require('../../tmp/minigames-tests/shiritori.js')
const pool = {
  kanji: kanjiFor('N3').map(item => ({ ...item, id: `prepared-${item.id}` })),
  words: wordsFor('N3').map(item => ({ ...item, id: `prepared-${item.id}` })),
}
test('falling initial and later questions exclusively use the injected same-level pool', () => {
  let round = createRound('falling', 'N3', 'normal', 1, 'reading', 'hiragana', 'pool', pool)
  for (let i = 0; i < 20; i++) {
    round = reduceRound(round, { type: 'tick', ms: 100 })
    for (const question of round.falling.questions) assert.ok(question.item.id.startsWith('prepared-'))
    const q = round.falling.questions[0]
    if (q) round = reduceRound(round, { type: 'answer', id: q.id, value: q.answer })
  }
})
test('shiritori and cipher retain their injected source when generating subsequent turns', () => {
  let round = createRound('shiritori', 'N3', 'normal', 1, 'reading', 'hiragana', 'pool', pool)
  for (let i = 0; i < 10 && round.session.status === 'playing'; i++) {
    const board = round.shiritori
    assert.ok(board.current.id.startsWith('prepared-'))
    assert.ok(board.choices.every(word => word.id.startsWith('prepared-')))
    const next = board.choices.find(word => firstKana(word.reading) === lastKana(board.current.reading) && lastKana(word.reading) !== 'ん')
    assert.ok(next)
    round = reduceRound(round, { type: 'answer', value: next.id })
  }
  round = createRound('cipher', 'N3', 'normal', 2, 'reading', 'hiragana', 'pool', pool)
  for (let i = 0; i < 10; i++) {
    assert.ok(round.cipher.word.id.startsWith('prepared-'))
    round = reduceRound(round, { type: 'answer', value: round.cipher.plain.join('') })
  }
  assert.equal(round.session.reason, 'completed')
})
test('no implicit bundled fallback for an empty or different-level prepared source', () => {
  for (const game of ['falling', 'shiritori', 'cipher', 'memory']) {
    assert.throws(() => createRound(game, 'N3', 'normal', 1, 'reading', 'hiragana', 'pool', { kanji: [], words: [] }), /insufficient_data/)
    assert.throws(() => createRound(game, 'N4', 'normal', 1, 'reading', 'hiragana', 'pool', pool), /insufficient_data/)
  }
})
test('memory derives its grid exclusively from the prepared readings', () => {
  const source = { kanji: [], words: Array.from({ length: 12 }, (_, index) => ({ id: String(index), level: 'N3', word: String(index), reading: 'あいうえ' })) }
  const round = createRound('memory', 'N3', 'normal', 1, 'reading', 'hiragana', 'pool', source)
  assert.equal(round.memory.grid.length, 4)
  assert.ok(round.memory.grid.every(char => 'あいうえ'.includes(char)))
})
