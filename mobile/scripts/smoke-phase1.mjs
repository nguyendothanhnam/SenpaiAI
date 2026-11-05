import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

if (!process.argv.includes('--create-test-account')) {
  console.error('Use --create-test-account to create a disposable account/document and clean them up after the test.')
  process.exit(1)
}
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
assert.ok(base, 'EXPO_PUBLIC_API_URL is required')
const suffix = randomBytes(5).toString('hex')
const account = { email: `phase1-${suffix}@example.com`, username: `p1_${suffix}`, password: randomBytes(18).toString('hex') }
let token
let accountId
let documentId
const title = `Phase1 disposable ${suffix}`
const fixture = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(`<html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>This is original sample learning material for the SenpaiAI mobile integration check. It contains enough plain text for the library page importer to extract and let the learner review before saving.</p></main></body></html>`)
})
const request = async (path, { method = 'GET', body, bearer = token } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90000) })
  return { status: response.status, data: response.status === 204 ? null : await response.json(), date: response.headers.get('date') }
}
try {
  const registration = await request('/auth/register', { method: 'POST', body: account })
  assert.equal(registration.status, 201)
  accountId = registration.data.id
  const login = await request('/auth/login', { method: 'POST', body: account })
  assert.equal(login.status, 200)
  token = login.data.access_token
  let today = await request('/daily/today')
  assert.equal(today.status, 200)
  assert.ok(Number.isFinite(Date.parse(today.date)))
  const taskId = today.data.task_id
  const taskDate = today.data.date
  const types = new Set()
  let duplicateChecked = false
  for (const item of today.data.items) {
    types.add(`${item.item_type}:${item.question_type}`)
    const p = item.payload
    const answer = item.item_type === 'flashcard' ? true : item.question_type === 'true_false' ? false : item.question_type === 'reorder' ? p.tokens : item.question_type === 'conjugation' ? p.base_form || 'です' : p.options[0]
    const result = await request(`/daily/items/${item.id}/answer`, { method: 'POST', body: { answer, time_spent_ms: 1000 } })
    assert.equal(result.status, 200)
    assert.equal(typeof result.data.is_correct, 'boolean')
    assert.equal(typeof result.data.explanation, 'string')
    if (!duplicateChecked) {
      const duplicate = await request(`/daily/items/${item.id}/answer`, { method: 'POST', body: { answer, time_spent_ms: 1000 } })
      assert.equal(duplicate.status, 409)
      assert.equal(duplicate.data.detail.code, 'item_already_answered')
      duplicateChecked = true
    }
    today = await request('/daily/today')
    assert.equal(today.data.task_id, taskId)
    assert.equal(today.data.items.find((entry) => entry.id === item.id).answered, true)
  }
  assert.equal(today.data.progress.all_answered, true)
  const completion = await request('/daily/complete', { method: 'POST' })
  assert.equal(completion.status, 200)
  for (const field of ['base_points', 'correct_points', 'perfect_bonus', 'streak_bonus', 'streak_milestone_bonus', 'total_points']) assert.equal(typeof completion.data.breakdown[field], 'number')
  const again = await request('/daily/complete', { method: 'POST' })
  assert.deepEqual(again.data, completion.data)
  const rewards = await request('/rewards/me')
  assert.equal(rewards.data.points_balance, completion.data.balance)
  const history = await request('/daily/history?days=7')
  assert.equal(history.data.find((entry) => entry.date === taskDate).points_awarded, completion.data.points_awarded)
  console.log(`PASS daily task, resume after each item, duplicate guard, idempotent completion, reward/history. Returned types: ${[...types].join(', ')}`)

  const document = await request('/library/documents', { method: 'POST', body: { title, content: '日本語\n\nOriginal disposable mobile test document.', document_type: 'grammar', jlpt_level: 'N5', tags: ['phase1-disposable'], source_url: null } })
  assert.equal(document.status, 201)
  documentId = document.data.id
  const detail = await request(`/library/documents/${documentId}?language=en`)
  assert.equal(detail.data.title, title)
  assert.equal(detail.data.content.includes('\n'), true)
  const metadata = ['scope', 'is_mine', 'can_edit', 'can_delete'].filter((field) => !(field in detail.data))
  if (metadata.length) console.log(`API LIMITATION: library lacks ${metadata.join(', ')}; mobile must not infer ownership.`)
  const updated = await request(`/library/documents/${documentId}`, { method: 'PUT', body: { content: '日本語\n\nEdited disposable document.' } })
  assert.equal(updated.status, 200)
  assert.ok(updated.data.content.includes('Edited'))
  const list = await request('/library/documents?document_type=grammar&jlpt_level=N5&limit=2&offset=0')
  assert.equal(list.status, 200)
  assert.ok(list.data.items.length <= 2)
  const search = await request('/library/search?language=en', { method: 'POST', body: { query: title, limit: 12, offset: 0 } })
  assert.equal(search.status, 200)
  assert.ok(search.data.results.some((entry) => entry.id === documentId))
  assert.equal((await request('/library/stats')).status, 200)
  assert.equal((await request('/library/categories')).status, 200)
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve))
  const address = fixture.address()
  const imported = await request('/library/fetch-url', { method: 'POST', body: { url: `http://127.0.0.1:${address.port}/lesson` } })
  assert.equal(imported.status, 200)
  assert.equal(imported.data.title, title)
  assert.ok(imported.data.content.includes('original sample learning material'))
  console.log('PASS library create/detail/update, search, filters/paging, stats/categories, and URL extraction from a controlled HTML fixture.')
} finally {
  fixture.close()
  if (documentId && token) {
    const ownTest = await request(`/library/documents/${documentId}`)
    assert.equal(ownTest.data.title, title, 'Refusing to delete a document not created by this test')
    assert.equal((await request(`/library/documents/${documentId}`, { method: 'DELETE' })).status, 204)
    console.log('CLEANUP test document')
  }
  if (accountId) {
    if (!token) token = (await request('/auth/login', { method: 'POST', body: account })).data.access_token
    assert.equal((await request('/auth/me')).data.id, accountId)
    assert.equal((await request('/auth/me', { method: 'DELETE' })).status, 204)
    console.log('CLEANUP test account and daily history')
  }
}
