import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PoolCache } from '../src/features/minigames/pool'
import { GameStore } from '../src/features/minigames/storage'
import { GameRuntime } from '../src/features/minigames/runtime'
import { availability } from '@games/availability'
import { createRound, reduceRound } from '@games/session'
import { accountStorageKey, statsKey } from '@games/stats'
import { kanjiFor, wordsFor } from '@games/data'
import type { KanjiEntry } from '../src/api/phase3Types'
import type { Level } from '@games/types'

const rows = JSON.parse(readFileSync('../backend/app/data/kanji_dictionary.json', 'utf8')) as KanjiEntry[]
function fixture() {
  let calls = 0, fail = false, now = 0
  const cache = new PoolCache(async (level, _search, offset, limit) => {
    calls++
    if (fail) throw new Error('offline')
    const items = rows.filter(row => row.jlpt === level)
    return { items: items.slice(offset, offset + limit), total: items.length, offset, limit }
  }, () => now)
  return { cache, calls: () => calls, offline: () => { fail = true }, online: () => { fail = false }, expire: () => { now += 600_001 } }
}

test('actual API dictionary is paginated, deduplicated, cached and validates every available level', async () => {
  const f = fixture()
  for (const level of ['N5', 'N4', 'N3'] as Level[]) {
    const pool = await f.cache.prepare(level)
    assert.equal(pool.kanji.length, kanjiFor(level).length)
    assert.equal(pool.words.length, wordsFor(level).length)
    for (const game of ['falling', 'shiritori', 'cipher', 'memory'] as const) assert.deepEqual(availability(game, level, 'normal', 'reading', 'hiragana', pool), availability(game, level))
  }
  assert.equal(f.calls(), 7)
  const calls = f.calls()
  await Promise.all([f.cache.prepare('N3'), f.cache.prepare('N3')])
  assert.equal(f.calls(), calls)
  f.expire(); await f.cache.prepare('N3')
  assert.equal(f.calls(), calls + 4)
})
test('failed preparation is retryable, concurrent loads share a request, empty API cannot borrow bundled data', async () => {
  const f = fixture()
  f.offline()
  await assert.rejects(f.cache.prepare('N3'))
  f.online()
  const [a, b] = await Promise.all([f.cache.prepare('N3'), f.cache.prepare('N3')])
  assert.equal(a, b)
  assert.equal(f.calls(), 5)
  const empty = { kanji: [], words: [] }
  assert.throws(() => createRound('falling', 'N3', 'normal', 1, 'reading', 'hiragana', 'empty', empty), /insufficient_data/)
})
test('prepared pool drives a complete cipher round without any requests during play', async () => {
  const f = fixture(), pool = await f.cache.prepare('N3'), calls = f.calls()
  f.offline()
  let round = createRound('cipher', 'N3', 'normal', 5, 'reading', 'hiragana', 'offline-round', pool)
  for (let i = 0; i < 10; i++) round = reduceRound(round, { type: 'answer', value: round.cipher!.plain.join(''), questionId: round.cipher!.word.id })
  assert.equal(round.session.reason, 'completed')
  assert.equal(f.calls(), calls)
})
test('invalid, non-progressing or oversized API pages fail preparation rather than starting a partial round', async () => {
  const repeated = new PoolCache(async (_level, _search, offset, limit) => ({ items: rows.filter(row => row.jlpt === 'N3').slice(0, 100), total: 367, offset, limit }))
  await assert.rejects(repeated.prepare('N3'), /invalid_pool/)
  const empty = new PoolCache(async () => ({ items: [], total: 12, offset: 0, limit: 100 }))
  await assert.rejects(empty.prepare('N3'), /invalid_pool/)
  const oversized = new PoolCache(async () => ({ items: [], total: 5001, offset: 0, limit: 100 }))
  await assert.rejects(oversized.prepare('N3'), /invalid_pool/)
})
test('static cipher/shiritori screens do not render on each clock tick, while round time still accumulates', () => {
  for (const game of ['cipher', 'shiritori'] as const) {
    let renders = 0
    const runtime = new GameRuntime(createRound(game, 'N3', 'normal', 8), () => renders++)
    for (let i = 0; i < 10; i++) runtime.dispatch({ type: 'tick', ms: 100 })
    assert.equal(renders, 0)
    assert.equal(runtime.round.session.elapsedMs, 1000)
    runtime.appState('inactive')
    assert.equal(renders, 1)
    assert.equal(runtime.round.session.status, 'paused')
  }
})
test('every game pauses for calls/inactive/background; time and input freeze until explicit resume', () => {
  for (const game of ['falling', 'shiritori', 'cipher', 'memory'] as const) {
    const updates: string[] = []
    const runtime = new GameRuntime(createRound(game, 'N3', 'normal', 11), value => updates.push(value.session.status))
    for (const state of ['inactive', 'background']) {
      runtime.appState(state)
      const snapshot = runtime.round
      runtime.dispatch({ type: 'tick', ms: 200 }); runtime.dispatch({ type: 'hint' }); runtime.dispatch({ type: 'answer', value: 'あ' })
      assert.equal(runtime.round, snapshot)
      runtime.appState('active')
      assert.equal(runtime.round.session.status, 'paused')
      runtime.dispatch({ type: 'resume' })
      assert.equal(runtime.round.session.status, 'playing')
    }
    runtime.dispatch({ type: 'quit' })
    assert.equal(runtime.round.session.reason, 'quit')
    assert.ok(updates.length > 0)
  }
})
function storage() {
  const data = new Map<string, string>()
  return { data, getItem: async (key: string) => data.get(key) || null, setItem: async (key: string, value: string) => { data.set(key, value) } }
}
const ended = (id: string, score: number) => ({ ...reduceRound(createRound('falling', 'N3', 'normal', 1, 'reading', 'hiragana', id), { type: 'quit' }).session, score })
test('native high scores survive reopening, isolate accounts/modes and serialize duplicate or concurrent saves', async () => {
  const memory = storage(), store = new GameStore(memory), key = statsKey('falling', 'N3', 'normal', 'reading'), value = ended('one', 200)
  await Promise.all([store.record('A', key, value), store.record('A', key, value)])
  await Promise.all([store.record('A', key, ended('two', 50)), store.record('A', key, ended('three', 300)), store.record('B', key, ended('b', 10))])
  const reopened = new GameStore(memory)
  assert.equal((await reopened.read('A')).entries[key].highScore, 300)
  assert.equal((await reopened.read('A')).entries[key].played, 3)
  assert.equal((await reopened.read('B')).entries[key].highScore, 10)
  assert.equal((await reopened.read('A')).entries[statsKey('falling', 'N3', 'normal', 'meaning')], undefined)
  await assert.rejects(reopened.read(''))
})
test('corrupt/future records and full/unavailable storage fail without overwriting existing data', async () => {
  const memory = storage(), store = new GameStore(memory), key = accountStorageKey('A')
  for (const raw of ['{broken', '{"version":2,"entries":{}}', '{"version":1,"entries":{"x":{"highScore":-1}}}']) {
    memory.data.set(key, raw)
    await assert.rejects(store.record('A', 'x', ended('one', 20)))
    assert.equal(memory.data.get(key), raw)
  }
  const blocked = new GameStore({ getItem: async () => null, setItem: async () => { throw new Error('full') } })
  await assert.rejects(blocked.record('A', 'x', ended('one', 20)))
  const unavailable = new GameStore({ getItem: async () => { throw new Error('unavailable') }, setItem: memory.setItem })
  await assert.rejects(unavailable.read('A'))
})
