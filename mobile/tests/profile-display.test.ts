import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { QueryClient } from 'react-query'
import { Session } from '../src/auth/session'
import { publishProfile } from '../src/auth/profile'
import type { User } from '../src/api/types'
import { themes } from '../../frontend/src/themes/themes'
import { contrastRatio, readableText } from '../src/theme/nativeStyle'

const original: User = { id: 1, email: 'test@example.com', username: 'before', is_active: true, current_jlpt_level: 'N5', learning_goals: [], exercise_points: 0, created_at: '2026-01-01T00:00:00Z' }
async function setup() {
  const api = axios.create()
  api.defaults.adapter = async config => ({ data: original, status: 200, statusText: 'OK', headers: {}, config })
  const session = new Session(api, { get: async () => 'token', set: async () => undefined, remove: async () => undefined }, async () => undefined)
  await session.restore()
  return { session, client: new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } }) }
}
test('saving profile notifies subscribers immediately and late old GET cannot undo the save', async () => {
  const { session, client } = await setup(), updated = { ...original, username: 'after', current_jlpt_level: 'N3', learning_goals: ['Read every day'] }
  let resolveOld!: (user: User) => void, notifications = 0
  const unsubscribe = session.subscribe(() => notifications++)
  client.setQueryData(['profile', 1], original)
  const fetch = client.fetchQuery(['profile', 1], () => new Promise<User>(resolve => { resolveOld = resolve }))
  const settled = fetch.catch(() => undefined)
  await publishProfile(client, session, updated)
  resolveOld(original); await settled; await Promise.resolve()
  assert.deepEqual(client.getQueryData(['profile', 1]), updated)
  assert.deepEqual(session.getSnapshot().user, updated)
  assert.equal(notifications, 1)
  unsubscribe(); client.clear()
})
test('a profile save completing after sign-out cannot restore a private profile', async () => {
  const { session, client } = await setup()
  await session.logout()
  await publishProfile(client, session, { ...original, username: 'after' })
  assert.equal(client.getQueryData(['profile', 1]), undefined)
  assert.equal(session.getSnapshot().user, null)
  client.clear()
})
test('game title surfaces and button labels retain readable contrast in every theme and mode', () => {
  for (const theme of Object.values(themes)) for (const mode of ['light', 'dark'] as const) {
    const p = theme.palettes[mode]
    for (const surface of [p.bg, p.card]) assert.ok(contrastRatio(surface, p.text) >= 4.5, `${theme.id}/${mode}: title`)
    for (const secondary of [false, true]) {
      const background = secondary ? p.accent : p.primary
      const text = readableText(background, secondary ? p.text : p.primaryContrast, [p.text, p.primaryContrast, p.bg])
      assert.ok(contrastRatio(background, text) >= 4.5, `${theme.id}/${mode}: button`)
    }
  }
})
