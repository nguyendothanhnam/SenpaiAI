import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PoolCache } from '../src/features/minigames/pool'
import { RecipeStore, recipeKey } from '../src/features/minigames/recipes'
import { cellAt, snappedPath } from '../src/features/minigames/gestures'
import { GameRuntime } from '../src/features/minigames/runtime'
import { availability } from '@games/availability'
import { compoundsFor } from '@games/phase2-data'
import { createRound, type Action } from '@games/session'
import { WAVE2_GAMES } from '@games/types'
import { checkSearchPath } from '@games/wordsearch'
import type { KanjiEntry } from '../src/api/phase3Types'

const rows = JSON.parse(readFileSync('../backend/app/data/kanji_dictionary.json', 'utf8')) as KanjiEntry[]
test('API-prepared wave-2 pools agree with actual eligibility for each supported level and difficulty', async () => {
  const cache = new PoolCache(async (level, _search, offset, limit) => { const group = rows.filter(row => row.jlpt === level); return { items: group.slice(offset, offset + limit), total: group.length, offset, limit } })
  for (const level of ['N5', 'N4', 'N3'] as const) {
    const pool = await cache.prepare(level)
    for (const game of WAVE2_GAMES) for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      assert.deepEqual(availability(game, level, difficulty, 'reading', 'hiragana', pool), availability(game, level, difficulty))
      if (availability(game, level, difficulty).enabled) {
        const round = createRound(game, level, difficulty, 8, 'reading', 'hiragana', 'native', pool)
        assert.equal(round.pool?.kanji.length, pool.kanji.length)
        if (round.missing) assert.ok(pool.strokes!.some(glyph => glyph.id === round.missing!.glyph.id))
      }
    }
  }
})
test('finger coordinates map to cells and snap to valid horizontal, vertical and diagonal selections', () => {
  assert.deepEqual(cellAt({ x: 75, y: 105 }, 300, 10), { row: 3, col: 2 })
  assert.equal(cellAt({ x: 300, y: 0 }, 300, 10), null)
  assert.equal(cellAt({ x: -1, y: 0 }, 300, 10), null)
  assert.deepEqual(snappedPath({ row: 2, col: 2 }, { row: 3, col: 7 }, 10).at(-1), { row: 2, col: 7 })
  assert.deepEqual(snappedPath({ row: 2, col: 2 }, { row: 7, col: 3 }, 10).at(-1), { row: 7, col: 2 })
  assert.deepEqual(snappedPath({ row: 2, col: 2 }, { row: 5, col: 6 }, 10).at(-1), { row: 6, col: 6 })
  const round = createRound('wordsearch', 'N3', 'normal', 5), word = round.wordsearch!.words[0], path = snappedPath(word.cells[0], word.cells.at(-1)!, round.wordsearch!.size)
  assert.equal(checkSearchPath(round.wordsearch!, path).kind, 'found')
})
test('all five portable boards freeze input/time on background and resume only explicitly', () => {
  for (const game of WAVE2_GAMES) {
    const runtime = new GameRuntime(createRound(game, 'N3', 'normal', 7), () => undefined)
    runtime.appState('background'); const snapshot = runtime.round
    for (const action of [{ type: 'tick', ms: 200 }, { type: 'slash', points: [] }, { type: 'selectPath', cells: [] }, { type: 'tile', id: 'x' }, { type: 'clear' }] satisfies Action[]) runtime.dispatch(action)
    assert.equal(runtime.round, snapshot)
    runtime.appState('active'); assert.equal(runtime.round.session.status, 'paused')
    runtime.dispatch({ type: 'resume' }); assert.equal(runtime.round.session.status, 'playing')
  }
})
function memory() { const data = new Map<string, string>(); return { data, getItem: async (key: string) => data.get(key) || null, setItem: async (key: string, value: string) => { data.set(key, value) } } }
test('recipes persist immediately, deduplicate concurrent writes and isolate accounts after reopening', async () => {
  const storage = memory(), store = new RecipeStore(storage), pool = compoundsFor('N3')
  await Promise.all([store.add('A', [pool[0].id], pool), store.add('A', [pool[1].id, pool[0].id, 'invented'], pool)])
  assert.equal((await new RecipeStore(storage).read('A')).length, 2)
  assert.deepEqual(await store.read('B'), [])
  await store.add('B', [pool[2].id], pool)
  assert.equal((await store.read('A')).length, 2)
})
test('corrupt/future recipe stores and storage failures preserve existing data and support retries', async () => {
  const storage = memory(), pool = compoundsFor('N3'), store = new RecipeStore(storage)
  for (const raw of ['{bad', '{"version":2,"recipes":[]}', '{"version":1,"recipes":[null]}']) {
    storage.data.set(recipeKey('A'), raw)
    await assert.rejects(store.add('A', [pool[0].id], pool)); assert.equal(storage.data.get(recipeKey('A')), raw)
  }
  let fail = true
  const retry = new RecipeStore({ getItem: storage.getItem, setItem: async (key, value) => { if (fail) throw new Error('full'); await storage.setItem(key, value) } })
  await assert.rejects(retry.add('B', [pool[0].id], pool)); fail = false
  assert.deepEqual(await retry.add('B', [pool[0].id], pool), [pool[0].id])
})
