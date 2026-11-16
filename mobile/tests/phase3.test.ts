import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createInstance } from 'i18next'
import { mixedNeedsBank, shouldUseBank } from '../src/features/phase2/grammarFallback'
import type { GrammarSession, SessionOptions } from '../src/api/phase2Types'
import { samplePath, vectorSegments } from '../src/features/kanji/vector'
import { isSupportedTheme, kanjiNextPage, quizScore } from '../src/features/kanji/logic'
import { resources } from '../src/i18n/resources'
import type { KanjiQuestion } from '../src/api/phase3Types'

test('AI and mixed failures select bank; authentication/cancellation never trigger a fallback', () => {
  for (const mode of ['ai', 'mixed'] as const) for (const status of [404, 408, 422, 429, 500, 503]) assert.equal(shouldUseBank({ response: { status } }, mode), true)
  assert.equal(shouldUseBank(new Error('offline'), 'ai'), true)
  assert.equal(shouldUseBank({ response: { status: 404 } }, 'bank'), false)
  assert.equal(shouldUseBank({ code: 'ERR_CANCELED' }, 'ai'), false)
  for (const status of [401, 403]) assert.equal(shouldUseBank({ response: { status } }, 'mixed'), false)
})
test('grammar fallback is translated at render time in Vietnamese and English', async () => {
  const translator = createInstance(); await translator.init({ resources, lng: 'vi' })
  assert.match(translator.t('phase3.aiFallback', { ns: 'mobile' }), /ngân hàng/)
  await translator.changeLanguage('en')
  assert.match(translator.t('phase3.aiFallback', { ns: 'mobile' }), /question bank/)
})
test('mixed partial success preserves the valid session while selecting bank for future starts', () => {
  const session = { session_id: 42, questions: [{ id: 1 }], message: 'partial' } as GrammarSession
  const original = JSON.stringify(session)
  const options: SessionOptions = { mode: 'mixed', jlpt_level: 'N5', question_types: ['fill_blank'], count: 5 }
  assert.equal(mixedNeedsBank(session, options), true)
  assert.equal(JSON.stringify(session), original)
  assert.equal(mixedNeedsBank(session, { ...options, mode: 'bank' }), false)
  assert.equal(mixedNeedsBank({ ...session, message: undefined }, options), false)
})
test('mobile and web use the same grammar routes with the backend dual registration', () => {
  const main = readFileSync(new URL('../../backend/app/main.py', import.meta.url), 'utf8')
  const web = readFileSync(new URL('../../frontend/src/services/api.ts', import.meta.url), 'utf8')
  const native = readFileSync(new URL('../src/api/phase2.ts', import.meta.url), 'utf8')
  assert.ok(main.includes('include_router(grammar_practice.router, prefix="/api")'))
  assert.ok(main.includes('include_router(grammar_practice.router)'))
  assert.ok(web.includes("'/grammar-practice/sessions'")); assert.ok(native.includes("'/grammar-practice/sessions'"))
  assert.ok(!native.includes("'/api/grammar-practice/"))
})
test('KanjiVG cubic curves preserve absolute, relative and smooth endpoints', () => {
  assert.deepEqual(samplePath('M10 10c1 2 3 4 10 20').at(-1), { x: 20, y: 30 })
  assert.deepEqual(samplePath('M10 10C11 12 13 14 20 30S40 40 50 60').at(-1), { x: 50, y: 60 })
  assert.deepEqual(samplePath('m10 10c1 2 3 4 10 20s3 4 5 6').at(-1), { x: 25, y: 36 })
  assert.throws(() => samplePath('M0 0A1 1 0 0 0 2 3'), /unsupported/)
  assert.throws(() => vectorSegments('M0 0L1 1', '0 0 0 0'), /viewbox/)
})
test('all bundled KanjiVG paths can be displayed without adding a native renderer', () => {
  const data = JSON.parse(readFileSync(new URL('../../backend/app/data/kanjivg_strokes.json', import.meta.url), 'utf8')) as Record<string, { viewBox: string; strokes: { path: string }[] }>
  let count = 0
  for (const entry of Object.values(data)) for (const stroke of entry.strokes) {
    const segments = vectorSegments(stroke.path, entry.viewBox)
    assert.ok(segments.length > 0)
    assert.ok(segments.every(s => Number.isFinite(s.length) && s.length > 0 && Number.isFinite(s.x)))
    count++
  }
  assert.ok(count > 1000)
})
test('kanji pagination and practice scoring do not fabricate account rewards', () => {
  assert.equal(kanjiNextPage({ items: [], total: 100, offset: 0, limit: 24 }), undefined)
  assert.equal(kanjiNextPage({ items: [{}] as never[], total: 2, offset: 0, limit: 1 }), 1)
  const questions = [{ correct_answer: '日' }, { correct_answer: '月' }] as KanjiQuestion[]
  assert.equal(quizScore(questions, ['日', '火']), 1)
  assert.equal(quizScore(questions, ['日']), 1)
  assert.equal(isSupportedTheme('sakura'), true); assert.equal(isSupportedTheme('unknown'), false)
})
