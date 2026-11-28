import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

// Mutations and cleanup are restricted to the account created by this invocation.
if (!process.argv.includes('--create-test-account')) throw new Error('Use --create-test-account for a disposable account.')
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
assert.ok(base)
const suffix = randomBytes(6).toString('hex')
const account = { email: `placement-${suffix}@example.com`, username: `pt_${suffix}`, password: randomBytes(20).toString('hex') }
let token, id
const request = async (path, method = 'GET', body, bearer = token) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) })
  return { status: response.status, data: response.status === 204 ? null : await response.json() }
}
const ok = response => { assert.equal(response.status, 200); return response.data }
function publicQuestion(question) {
  for (const key of ['answer', 'correct_answer', 'is_correct', 'explanation', 'transcript', 'audio_path']) assert.equal(key in question, false, `Private field leaked: ${key}`)
}
try {
  const created = await request('/auth/register', 'POST', account)
  assert.equal(created.status, 201); id = created.data.id
  token = ok(await request('/auth/login', 'POST', { email: account.email, password: account.password })).access_token
  const initialProfile = ok(await request('/auth/me'))
  const status = ok(await request('/placement/status'))
  assert.equal(status.has_completed, false); assert.equal(status.active_attempt_id, null)
  assert.equal(ok(await request('/placement/profile/summary')).source, 'unassessed')
  assert.deepEqual(ok(await request('/placement/attempts')), [])
  const levels = ok(await request('/placement/levels?language=vi'))
  assert.equal(levels.time_limit_seconds, 1800)
  assert.equal(ok(await request('/placement/levels?language=en')).levels.length, 5)
  const available = levels.levels.filter(row => row.available)
  console.log(`PASS status/summary/history/levels vi+en; available: ${available.map(row => `${row.level}${row.is_demo ? ' (demo)' : ''}`).join(', ') || 'none'}`)
  if (!levels.levels.find(row => row.level === 'N5')?.available) {
    assert.equal((await request('/placement/attempts', 'POST', { language: 'vi', mode: 'adaptive' })).status, 409)
    throw new Error('Live bank has insufficient N5 data; content import is outside this test.')
  }
  let attempt = ok(await request('/placement/attempts', 'POST', { language: 'vi', mode: 'adaptive' }))
  assert.equal(attempt.assessment_mode, 'adaptive')
  assert.equal(Date.parse(attempt.expires_at) - Date.parse(attempt.server_time) > 1700000, true)
  assert.equal(ok(await request('/placement/status')).active_attempt_id, attempt.id)
  assert.equal(ok(await request(`/placement/attempts/${attempt.id}`)).question.key, attempt.question.key)
  assert.equal((await request(`/placement/attempts/${attempt.id}/result`)).status, 409)
  let mediaChecked = false, duplicateChecked = false, count = 0
  while (attempt.status === 'in_progress' && !attempt.ready_to_submit) {
    const question = attempt.question
    assert.ok(question); publicQuestion(question)
    for (const item of attempt.items) publicQuestion(item)
    if (question.audio_url && !mediaChecked) {
      assert.equal(question.audio_url, `/placement/attempts/${attempt.id}/media/${question.item_id}`)
      const audio = await fetch(`${base}${question.audio_url}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
      assert.equal(audio.status, 200); assert.ok((await audio.arrayBuffer()).byteLength > 44)
      const unauthenticated = await fetch(`${base}${question.audio_url}`, { signal: AbortSignal.timeout(20000) })
      assert.ok([401, 403].includes(unauthenticated.status))
      mediaChecked = true
    }
    const answer = { question_key: question.key, answer: question.choices[0].id, revision: question.revision }
    attempt = ok(await request(`/placement/attempts/${attempt.id}/answers`, 'POST', answer))
    if (!duplicateChecked) {
      const duplicate = ok(await request(`/placement/attempts/${attempt.id}/answers`, 'POST', answer))
      assert.equal(duplicate.answered_count, attempt.answered_count)
      assert.equal((await request(`/placement/attempts/${attempt.id}/answers`, 'POST', { ...answer, answer: question.choices[1].id })).status, 409)
      duplicateChecked = true
    }
    count++; assert.ok(count <= 30)
  }
  console.log(`PASS create/resume/server deadline/choice IDs/revisions/duplicate and conflict; ${count} committed answers`)
  assert.equal(mediaChecked, true, 'No authenticated listening media was exercised')
  console.log('PASS authenticated audio bytes and unauthenticated audio rejected (native playback is not verified)')
  attempt = ok(await request(`/placement/attempts/${attempt.id}/submit`, 'POST'))
  assert.equal(attempt.status, 'completed')
  const result = ok(await request(`/placement/attempts/${attempt.id}/result`))
  const duplicate = ok(await request(`/placement/attempts/${attempt.id}/submit`, 'POST'))
  assert.deepEqual(duplicate.result, result)
  const confirmed = ok(await request(`/placement/attempts/${attempt.id}/confirm`, 'POST'))
  assert.ok(confirmed.confirmed_at)
  assert.equal(ok(await request(`/placement/attempts/${attempt.id}/confirm`, 'POST')).confirmed_at, confirmed.confirmed_at)
  if (result.is_demo) {
    assert.equal(result.estimated_level, null)
    assert.equal(ok(await request('/auth/me')).current_jlpt_level, initialProfile.current_jlpt_level)
  }
  assert.equal(ok(await request('/placement/status')).has_confirmed, true)
  assert.equal(ok(await request('/placement/profile/summary')).history[0].id, attempt.id)
  console.log('PASS submit/result/idempotent confirm/profile refresh/demo level protection/history')
  const next = ok(await request('/placement/attempts', 'POST', { language: 'vi', mode: 'confirmation', selected_level: 'N5' }))
  assert.equal(next.items.length, 30)
  const fixed = next.question
  const savedFixed = ok(await request(`/placement/attempts/${next.id}/answers`, 'POST', { question_key: fixed.key, answer: fixed.choices[0].id, revision: fixed.revision }))
  assert.equal(savedFixed.answered_count, 1)
  assert.equal(ok(await request(`/placement/attempts/${next.id}/abandon`, 'POST')).status, 'abandoned')
  assert.equal(ok(await request('/placement/status')).active_attempt_id, null)
  assert.equal((await request('/placement/status', 'GET', undefined, 'invalid-test-jwt')).status, 401)
  console.log('PASS confirmation mode/30 questions/answer/abandon/invalid JWT 401')
} finally {
  if (id) {
    if (!token) token = ok(await request('/auth/login', 'POST', { email: account.email, password: account.password })).access_token
    const owned = ok(await request('/auth/me'))
    assert.equal(owned.id, id); assert.equal(owned.username, account.username)
    assert.equal((await request('/auth/me', 'DELETE')).status, 204)
    console.log('CLEANUP: deleted this test account and its owned placement data')
  }
}
