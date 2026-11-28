import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
if (!process.argv.includes('--create-test-account')) throw new Error('Use --create-test-account for a disposable account. Reset/delete are limited to that account.')
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
assert.ok(base)
const suffix = randomBytes(5).toString('hex')
const account = { username: `p3_${suffix}`, email: `p3-${suffix}@example.com`, password: randomBytes(18).toString('hex') }
let token, id
const request = async (path, method = 'GET', body) => {
  const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) })
  return { status: r.status, data: r.status === 204 ? null : await r.json() }
}
try {
  const created = await request('/auth/register', 'POST', account); assert.equal(created.status, 201); id = created.data.id
  const login = await request('/auth/login', 'POST', account); assert.equal(login.status, 200); token = login.data.access_token
  for (const level of ['N5', 'N4', 'N3']) {
    const page = await request(`/kanji/list?jlpt=${level}&limit=2`); assert.equal(page.status, 200); assert.equal(page.data.items.length, 2)
    const more = await request(`/kanji/list?jlpt=${level}&limit=2&offset=2`); assert.ok(more.data.items.every(k => !page.data.items.some(first => first.kanji === k.kanji)))
    const char = page.data.items[0].kanji
    assert.equal((await request(`/kanji/${encodeURIComponent(char)}`)).status, 200)
    assert.equal((await request(`/kanji/${encodeURIComponent(char)}/stroke-order`)).data.available, true)
    const searched = await request(`/kanji/list?jlpt=${level}&search=${encodeURIComponent(char)}`); assert.ok(searched.data.items.some(k => k.kanji === char))
  }
  for (const mode of ['meaning_match', 'reading_match', 'kanji_match']) {
    const quiz = await request(`/kanji/quiz?jlpt=N5&mode=${mode}&count=5`)
    assert.equal(quiz.status, 200); assert.equal(quiz.data.items.length, 5); assert.ok(quiz.data.items.every(q => q.options.includes(q.correct_answer)))
  }
  console.log('PASS live kanji levels/list/search/pagination/detail/stroke data/quiz contracts')
  const denied = await request('/auth/me', 'PUT', { current_jlpt_level: 'N4' })
  assert.equal(denied.status, 403); assert.equal(denied.data.detail, 'jlpt_level_requires_placement')
  const update = await request('/auth/me', 'PUT', { username: `edited_${suffix}`, learning_goals: ['JLPT N3'], ui_language: 'en' })
  assert.equal(update.status, 200); assert.equal(update.data.ui_language, 'en')
  const rewards = await request('/rewards/me'); assert.equal(rewards.status, 200)
  const shop = await request('/rewards/shop'); assert.equal(shop.status, 200)
  assert.ok(shop.data.themes.some(t => t.id === 'classic' && t.owned))
  assert.equal((await request('/rewards/equip', 'PUT', { theme_id: 'classic' })).status, 200)
  assert.equal((await request('/rewards/equip', 'PUT', { theme_id: 'sakura' })).status, 409)
  const exported = await request('/auth/me/export'); assert.equal(exported.status, 200); assert.equal(exported.data.user_profile.email, account.email)
  const conversation = await request('/chat/conversations', 'POST', { title: `Disposable ${suffix}`, mode: 'text' }); assert.equal(conversation.status, 201)
  assert.equal((await request('/auth/me')).data.id, id, 'Never reset an account other than this test account')
  const reset = await request('/auth/me/reset-progress', 'POST'); assert.equal(reset.status, 200); assert.ok(reset.data.preserved_items.includes('daily_tasks'))
  assert.equal((await request(`/chat/conversations/${conversation.data.id}`)).status, 404)
  assert.equal((await request('/rewards/me')).data.points_balance, rewards.data.points_balance)
  console.log('PASS live profile/language/goals, owned themes, JSON export and reset preserving rewards')
} finally {
  if (id) {
    if (!token) token = (await request('/auth/login', 'POST', account)).data.access_token
    assert.equal((await request('/auth/me')).data.id, id)
    assert.equal((await request('/auth/me', 'DELETE')).status, 204)
    console.log('CLEANUP disposable account; live delete endpoint passed')
  }
}
