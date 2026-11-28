import assert from 'node:assert/strict'
import test from 'node:test'
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createPlacementAPI } from '../src/api/placement'
import { PlacementController } from '../src/features/placement/controller'
import { anchorClock, answerBody, currentQuestion, estimatedLevel, placementMediaPath, remainingSeconds, type PlacementAttempt, type PlacementQuestion } from '../src/features/placement/model'
import { Session } from '../src/auth/session'
import type { User } from '../src/api/types'
import { createPlacementResume } from '../src/features/placement/resume'

const question: PlacementQuestion = { key: 'q1', skill: 'vocab', level: 'N5', question_type: 'mcq', prompt: '語', revision: 0, item_id: 4, choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }
const attempt = (overrides: Partial<PlacementAttempt> = {}): PlacementAttempt => ({ id: 7, status: 'in_progress', assessment_mode: 'adaptive', items: [question], question, ready_to_submit: false, is_demo: false, expires_at: '2026-11-27T01:30:00Z', server_time: '2026-11-27T01:00:00Z', revision: 0, language: 'vi', answered_count: 0, min_questions: 20, max_questions: 30, available_levels: ['N5'], created_at: '2026-11-27T01:00:00Z', completed_at: null, confirmed_at: null, result: null, ...overrides })
const answered = () => attempt({ answered_count: 1, items: [{ ...question, user_answer: 'a', revision: 1 }, { ...question, key: 'q2' }] })
function harness(initial = attempt()) {
  let now = 100, gets = 0, answers = 0, submits = 0, remote = initial
  const api = {
    get: async () => { gets++; return remote },
    answer: async () => { answers++; remote = answered(); return remote },
    submit: async () => { submits++; remote = { ...remote, status: 'completed' as const }; return remote },
  }
  const controller = new PlacementController(api, () => now)
  controller.accept(initial)
  return { controller, api, set now(value: number) { now = value }, set remote(value: PlacementAttempt) { remote = value }, get gets() { return gets }, get answers() { return answers }, get submits() { return submits } }
}

test('server deadline uses monotonic elapsed time, regardless of device date', () => {
  const clock = anchorClock(attempt(), 100)
  const original = Date.now
  try {
    Date.now = () => 0
    assert.equal(remainingSeconds(clock, 60100), 1740)
    Date.now = () => 99999999999999
    assert.equal(remainingSeconds(clock, 120100), 1680)
  } finally { Date.now = original }
})
test('receipt timestamp travels with server response and is not reset by rendering', () => {
  const clock = anchorClock(attempt({ receivedAt: 10 }), 5000)
  assert.equal(remainingSeconds(clock, 1010), 1799)
})
test('clock clamps elapsed time and expiry, with explicit UTC timestamps', () => {
  const clock = anchorClock(attempt(), 100)
  assert.equal(remainingSeconds(clock, 0), 1800)
  assert.equal(remainingSeconds(clock, 1800100), 0)
  assert.equal(remainingSeconds(clock, 2800100), 0)
})
test('missing or invalid server timestamps never fall back to device time', () => {
  assert.equal(anchorClock(attempt({ server_time: undefined })), null)
  assert.equal(anchorClock(attempt({ expires_at: 'bad' })), null)
  assert.equal(remainingSeconds(null), null)
})
test('resume selects first server-unanswered question and never a committed answer', async () => {
  const app = harness()
  app.remote = answered()
  await app.controller.resume(7)
  assert.equal(currentQuestion(app.controller.getSnapshot().attempt!)?.key, 'q2')
  assert.equal(app.gets, 1)
})
test('confirmation mode also moves forward only and keeps stable server choice IDs', () => {
  const session = answered(); session.assessment_mode = 'confirmation'
  assert.equal(currentQuestion(session)?.key, 'q2')
  assert.deepEqual(answerBody(session, 'a'), { question_key: 'q2', answer: 'a', revision: 0 })
})
test('legacy resume uses current server question and preserves boolean/list answers', () => {
  const session = attempt({ assessment_mode: 'legacy', items: [], question: { ...question, question_type: 'true_false' } })
  assert.equal(currentQuestion(session)?.key, 'q1')
  assert.deepEqual(answerBody(session, false), { question_key: 'q1', answer: false })
  assert.deepEqual(answerBody(session, ['私', 'は']), { question_key: 'q1', answer: ['私', 'は'] })
})
test('completed and abandoned sessions expose no editable question', () => {
  assert.equal(currentQuestion(attempt({ status: 'completed' })), null)
  assert.equal(currentQuestion(attempt({ status: 'abandoned' })), null)
})
test('answer payload contains only server question key, choice ID and revision', () => {
  assert.deepEqual(answerBody(attempt(), 'b'), { question_key: 'q1', answer: 'b', revision: 0 })
  assert.throws(() => answerBody(attempt(), 'B'))
  assert.throws(() => answerBody(attempt(), true))
  assert.throws(() => answerBody(attempt({ items: [] }), 'a'))
})
test('synchronous lock suppresses repeated taps before React can render', async () => {
  const app = harness()
  let release!: (value: PlacementAttempt) => void
  app.api.answer = () => new Promise(resolve => { release = resolve })
  const first = app.controller.answer('a')
  assert.equal(app.controller.getSnapshot().busy, true)
  assert.equal(await app.controller.answer('b'), false)
  assert.equal(await app.controller.submit(), false)
  release(answered()); await first
  assert.equal(currentQuestion(app.controller.getSnapshot().attempt!)?.key, 'q2')
})
test('unknown answer outcome locks sending until server reconciliation', async () => {
  const app = harness()
  app.api.answer = async () => { app.remote = answered(); throw new Error('connection lost after commit') }
  assert.equal(await app.controller.answer('a'), false)
  assert.equal(app.controller.getSnapshot().needsSync, true)
  assert.equal(await app.controller.answer('b'), false)
  await app.controller.reconcile()
  assert.equal(currentQuestion(app.controller.getSnapshot().attempt!)?.key, 'q2')
  assert.equal(app.controller.getSnapshot().needsSync, false)
})
test('foreground requires reloading session and accepts an expired server result', async () => {
  const app = harness()
  app.controller.suspend()
  assert.equal(await app.controller.answer('a'), false)
  app.remote = attempt({ status: 'completed', server_time: '2026-11-27T02:00:00Z' })
  await app.controller.reconcile()
  assert.equal(app.controller.getSnapshot().attempt?.status, 'completed')
  assert.equal(currentQuestion(app.controller.getSnapshot().attempt!), null)
})
test('at server deadline an attempted answer submits without sending the late answer', async () => {
  const app = harness()
  app.now = 1800100
  await app.controller.answer('a')
  assert.equal(app.answers, 0)
  assert.equal(app.submits, 1)
  assert.equal(app.controller.getSnapshot().attempt?.status, 'completed')
})
test('expiry submission is serialized and never grades or builds scores locally', async () => {
  const app = harness()
  await Promise.all([app.controller.submit(), app.controller.submit(), app.controller.submit()])
  assert.equal(app.submits, 1)
  await app.controller.submit()
  assert.equal(app.submits, 1)
})
test('expiry failure is recoverable through GET before retrying submission', async () => {
  const app = harness(); let calls = 0
  app.api.submit = async () => { calls++; if (calls === 1) throw new Error('offline'); return attempt({ status: 'completed' }) }
  assert.equal(await app.controller.submit(), false)
  assert.equal(app.controller.getSnapshot().needsSync, true)
  await app.controller.submit()
  assert.equal(app.gets, 1)
  assert.equal(calls, 2)
  assert.equal(app.controller.getSnapshot().attempt?.status, 'completed')
})
test('lost submit response already committed on server does not submit twice', async () => {
  const app = harness(); let calls = 0
  app.api.submit = async () => { calls++; app.remote = attempt({ status: 'completed' }); throw new Error('lost response') }
  await app.controller.submit(); await app.controller.submit()
  assert.equal(calls, 1)
  assert.equal(app.controller.getSnapshot().attempt?.status, 'completed')
})
test('legacy sessions are not sent to the unsupported submit endpoint', async () => {
  const app = harness(attempt({ assessment_mode: 'legacy' }))
  await app.controller.submit()
  assert.equal(app.submits, 0)
})
test('disposal prevents a late response from restoring another account state', async () => {
  const app = harness(); let release!: (value: PlacementAttempt) => void
  app.api.get = () => new Promise(resolve => { release = resolve })
  const work = app.controller.resume(7)
  app.controller.dispose(); release(answered()); await work
  assert.equal(app.controller.getSnapshot().attempt?.answered_count, 0)
  assert.equal(await app.controller.answer('a'), false)
})
test('demo fallback and insufficient evidence never become a verified estimate', () => {
  const result = { recommended_level: 'N5', estimated_level: 'N4', is_demo: false } as NonNullable<PlacementAttempt['result']>
  assert.equal(estimatedLevel(attempt({ result })), 'N4')
  assert.equal(estimatedLevel(attempt({ result, is_demo: true })), null)
  assert.equal(estimatedLevel(attempt({ result: { ...result, is_demo: true } })), null)
  assert.equal(estimatedLevel(attempt({ result: { ...result, estimated_level: null } })), null)
  assert.equal(estimatedLevel(attempt({ result, assessment_mode: 'legacy' })), 'N5')
})
test('media URL only accepts owned placement path or legacy listening path', () => {
  assert.equal(placementMediaPath(7, { ...question, audio_url: '/placement/attempts/7/media/4' }), '/placement/attempts/7/media/4')
  for (const path of ['https://evil.test/audio', '/placement/attempts/8/media/4', '//evil.test/audio', '/auth/me']) assert.equal(placementMediaPath(7, { ...question, audio_url: path }), null)
  assert.equal(placementMediaPath(7, { ...question, question_type: 'listening', lesson_id: 3 }), '/listening/lessons/3/audio')
})
test('transport uses all existing endpoints, no client score, and explicit v2 mode', async () => {
  const requests: InternalAxiosRequestConfig[] = [], client = axios.create()
  client.defaults.adapter = async config => { requests.push(config); return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: attempt() } }
  const api = createPlacementAPI(client)
  await api.status(); await api.levels('en'); await api.summary(); await api.history()
  await api.start('vi', 'adaptive', 'N1'); await api.start('en', 'confirmation', 'N4'); await api.get(7)
  await api.answer(attempt(), 'a'); await api.submit(7); await api.result(7); await api.abandon(7); await api.confirm(7)
  assert.deepEqual(requests.map(r => r.url), ['/placement/status', '/placement/levels', '/placement/profile/summary', '/placement/attempts', '/placement/attempts', '/placement/attempts', '/placement/attempts/7', '/placement/attempts/7/answers', '/placement/attempts/7/submit', '/placement/attempts/7/result', '/placement/attempts/7/abandon', '/placement/attempts/7/confirm'])
  assert.deepEqual(JSON.parse(requests[4].data), { language: 'vi', mode: 'adaptive' })
  assert.deepEqual(JSON.parse(requests[5].data), { language: 'en', mode: 'confirmation', selected_level: 'N4' })
  assert.deepEqual(JSON.parse(requests[7].data), { question_key: 'q1', answer: 'a', revision: 0 })
  for (const index of [8, 10, 11]) assert.equal(requests[index].data, undefined)
})
test('registration creates a dismissible invitation, regular login does not repeat it', async () => {
  let token: string | null = null
  const client = axios.create(), user = { id: 1 } as User
  client.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: config.url === '/auth/login' ? { access_token: 'token' } : user })
  const session = new Session(client, { get: async () => token, set: async value => { token = value }, remove: async () => { token = null } }, async () => {})
  await session.register('learner@example.com', 'learner', 'password')
  assert.equal(session.getSnapshot().placementInvite, true)
  session.dismissPlacementInvite(); assert.equal(session.getSnapshot().placementInvite, false)
  await session.logout(); await session.login('learner@example.com', 'password')
  assert.equal(session.getSnapshot().placementInvite, false)
})
test('cold-start resume hints survive process replacement and are isolated by account', async () => {
  const values = new Map<string, string>()
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value) }, removeItem: async (key: string) => { values.delete(key) } }
  await createPlacementResume(storage).remember(1, 7)
  const reopened = createPlacementResume(storage)
  assert.equal(await reopened.read(1), 7)
  assert.equal(await reopened.read(2), null)
  await reopened.remember(2, 9); await reopened.forget(1)
  assert.equal(await reopened.read(1), null)
  assert.equal(await reopened.read(2), 9)
  assert.deepEqual([...values.values()], ['9'])
})
test('corrupt or unavailable local hints never grant an exam state', async () => {
  for (const value of ['bad', '-1', '0', '1.5', 'Infinity']) {
    const resume = createPlacementResume({ getItem: async () => value, setItem: async () => {}, removeItem: async () => {} })
    assert.equal(await resume.read(1), null)
  }
  const resume = createPlacementResume({ getItem: async () => { throw new Error('storage') }, setItem: async () => {}, removeItem: async () => {} })
  assert.equal(await resume.read(1), null)
})
