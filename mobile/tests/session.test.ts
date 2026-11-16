import assert from 'node:assert/strict'
import test from 'node:test'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from '../src/api/client'
import { Session } from '../src/auth/session'
import type { TokenStorage } from '../src/storage/types'
import type { User } from '../src/api/types'

const user: User = { id: 1, email: 'test@example.com', username: 'learner', is_active: true, current_jlpt_level: 'N5', learning_goals: [], exercise_points: 12, created_at: '2026-11-05T00:00:00Z', ui_language: 'vi' }
function setup(initialToken: string | null = null) {
  let saved = initialToken
  let cleared = 0
  const requests: InternalAxiosRequestConfig[] = []
  const storage: TokenStorage = { get: async () => saved, set: async (token) => { saved = token }, remove: async () => { saved = null } }
  const api = createApiClient({ baseURL: 'http://test/api', storage, onUnauthorized: (token) => session.expire(token) })
  const session = new Session(api, storage, async () => { cleared++ })
  api.defaults.adapter = async (config) => {
    requests.push(config)
    return { status: 200, statusText: 'OK', headers: new AxiosHeaders(), config, data: config.url === '/auth/login' ? { access_token: 'valid-token' } : user }
  }
  const rejectWith = (status: number, config: InternalAxiosRequestConfig) => Promise.reject(new AxiosError('request failed', undefined, config, undefined, { status, statusText: 'Error', headers: new AxiosHeaders(), config, data: {} }))
  return { api, session, storage, requests, rejectWith, get token() { return saved }, get cleared() { return cleared } }
}

test('restores a valid secure token and attaches it to requests', async () => {
  const app = setup('existing')
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'authenticated')
  assert.equal(app.requests[0].headers.get('Authorization'), 'Bearer existing')
  assert.equal(app.session.getSnapshot().user?.id, 1)
})

test('no token goes to login without a profile request', async () => {
  const app = setup()
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'anonymous')
  assert.equal(app.requests.length, 0)
})

test('register, login, profile, and logout use existing backend endpoints', async () => {
  const app = setup()
  let registered = false
  await app.session.register(user.email, user.username, 'secret1', () => { registered = true })
  assert.equal(registered, true)
  assert.deepEqual(app.requests.map((request) => request.url), ['/auth/register', '/auth/login', '/auth/me'])
  assert.equal(app.token, 'valid-token')
  assert.equal(app.session.getSnapshot().status, 'authenticated')
  await app.session.logout()
  assert.equal(app.token, null)
  assert.equal(app.session.getSnapshot().user, null)
  assert.ok(app.cleared >= 2)
})

test('expired JWT clears credentials and private data and selects login', async () => {
  const app = setup('expired')
  app.api.defaults.adapter = (config) => app.rejectWith(401, config)
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'anonymous')
  assert.equal(app.session.getSnapshot().expired, true)
  assert.equal(app.token, null)
  assert.equal(app.cleared, 1)
})

test('offline restoration preserves the secure token and retries', async () => {
  const app = setup('existing')
  const adapter = app.api.defaults.adapter
  app.api.defaults.adapter = async () => { throw new AxiosError('Network Error', 'ERR_NETWORK') }
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'offline')
  assert.equal(app.token, 'existing')
  app.api.defaults.adapter = adapter
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'authenticated')
})

test('bad login credentials do not trigger a global expiration', async () => {
  const app = setup()
  await app.session.restore()
  app.api.defaults.adapter = (config) => app.rejectWith(401, config)
  await assert.rejects(app.session.login('bad@example.com', 'wrong'))
  assert.equal(app.session.getSnapshot().expired, false)
  assert.equal(app.session.getSnapshot().status, 'anonymous')
})

test('a late 401 from the previous token cannot invalidate a fresh login', async () => {
  const app = setup('old')
  await app.session.login(user.email, 'secret1')
  await app.session.expire('old')
  assert.equal(app.token, 'valid-token')
  assert.equal(app.session.getSnapshot().status, 'authenticated')
})

test('a late profile response cannot restore a logged-out user', async () => {
  const app = setup('existing')
  let resolveResponse: (() => void) | undefined
  app.api.defaults.adapter = (config) => new Promise((resolve) => {
    resolveResponse = () => resolve({ status: 200, statusText: 'OK', headers: new AxiosHeaders(), config, data: user })
  })
  const restoring = app.session.restore()
  while (!resolveResponse) await new Promise((resolve) => setTimeout(resolve, 0))
  await app.session.logout()
  resolveResponse()
  await restoring
  assert.equal(app.session.getSnapshot().status, 'anonymous')
  assert.equal(app.token, null)
})

test('secure storage failure blocks authentication instead of using plain storage', async () => {
  const app = setup()
  app.storage.get = async () => { throw new Error('locked') }
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'storage-error')
})

test('a lost connection after login keeps the JWT for profile restoration', async () => {
  const app = setup()
  const adapter = app.api.defaults.adapter
  app.api.defaults.adapter = async (config) => {
    if (config.url === '/auth/me') throw new AxiosError('Network Error', 'ERR_NETWORK')
    return { status: 200, statusText: 'OK', headers: new AxiosHeaders(), config, data: { access_token: 'valid-token' } }
  }
  await assert.rejects(app.session.login(user.email, 'secret1'))
  assert.equal(app.session.getSnapshot().status, 'offline')
  assert.equal(app.token, 'valid-token')
  app.api.defaults.adapter = adapter
  await app.session.restore()
  assert.equal(app.session.getSnapshot().status, 'authenticated')
})

test('successful registration is reported even if automatic login fails', async () => {
  const app = setup()
  let registered = false
  app.api.defaults.adapter = async (config) => {
    if (config.url === '/auth/login') return app.rejectWith(503, config)
    return { status: 201, statusText: 'Created', headers: new AxiosHeaders(), config, data: user }
  }
  await assert.rejects(app.session.register(user.email, user.username, 'secret1', () => { registered = true }))
  assert.equal(registered, true)
  assert.equal(app.token, null)
})
