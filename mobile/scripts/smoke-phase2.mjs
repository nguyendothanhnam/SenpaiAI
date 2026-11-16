import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

if (!process.argv.includes('--create-test-account')) throw new Error('Pass --create-test-account to use a disposable account and clean it up.')
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
assert.ok(base, 'EXPO_PUBLIC_API_URL is required')
const suffix = randomBytes(5).toString('hex')
const account = { email: `p2-${suffix}@example.com`, username: `p2_${suffix}`, password: randomBytes(18).toString('hex') }
let token, accountId
const request = async (path, method = 'GET', body) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000) })
  const data = response.status === 204 ? null : await response.json()
  return { status: response.status, data }
}
try {
  let r = await request('/auth/register', 'POST', account); assert.equal(r.status, 201); accountId = r.data.id
  r = await request('/auth/login', 'POST', account); assert.equal(r.status, 200); token = r.data.access_token
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    r = await request(`/grammar-practice/patterns?jlpt_level=${level}`); assert.equal(r.status, 200)
    console.log(`BANK ${level}: ${r.data.patterns.reduce((n, p) => n + Object.values(p.question_counts).reduce((a, b) => a + b, 0), 0)} active questions`)
  }
  const kinds = ['fill_blank', 'reorder', 'true_false', 'conjugation']
  const wrongIds = []
  for (const kind of kinds) {
    r = await request('/grammar-practice/sessions', 'POST', { jlpt_level: 'N5', question_types: [kind], count: 5, mode: 'bank' }); assert.equal(r.status, 200)
    const { session_id, questions } = r.data
    for (const question of questions) {
      assert.equal(question.question_type, kind); assert.equal(question.correct_answer, undefined)
      const answer = kind === 'fill_blank' ? question.options[0] : kind === 'reorder' ? question.tokens : kind === 'true_false' ? false : question.base_form
      r = await request(`/grammar-practice/sessions/${session_id}/answer`, 'POST', { question_id: question.id, answer, time_spent_ms: 1200 }); assert.equal(r.status, 200)
      assert.equal(typeof r.data.is_correct, 'boolean'); assert.equal(typeof r.data.explanation_vi, 'string')
      if (!r.data.is_correct) wrongIds.push(question.id)
      const duplicate = await request(`/grammar-practice/sessions/${session_id}/answer`, 'POST', { question_id: question.id, answer, time_spent_ms: 1200 }); assert.equal(duplicate.status, 409)
    }
    const finished = await request(`/grammar-practice/sessions/${session_id}/finish`, 'POST'); assert.equal(finished.status, 200); assert.equal(finished.data.total, questions.length)
    assert.deepEqual((await request(`/grammar-practice/sessions/${session_id}/finish`, 'POST')).data, finished.data)
    console.log(`PASS grammar ${kind}: server feedback, duplicate guard, finish, idempotent results`)
  }
  if (wrongIds.length) {
    r = await request('/grammar-practice/sessions', 'POST', { jlpt_level: 'N5', question_types: kinds, count: 5, mode: 'bank', question_ids: wrongIds }); assert.equal(r.status, 200); assert.ok(r.data.questions.every(q => wrongIds.includes(q.id)))
  }
  r = await request('/grammar-practice/stats'); assert.equal(r.status, 200); assert.equal(r.data.activity_7_days.length, 7)
  // A deterministic greeting checks the full chat contract without an external AI bill.
  r = await request('/chat/conversations', 'POST', { mode: 'text' }); assert.equal(r.status, 201); const conversation = r.data
  r = await request('/chat/message', 'POST', { message: 'こんにちは', conversation_id: conversation.id, response_language: 'en', jlpt_level: 'N5' }); assert.equal(r.status, 200); assert.equal(r.data.conversation_id, conversation.id)
  r = await request(`/chat/conversations/${conversation.id}/messages?limit=1`); assert.equal(r.status, 200); assert.equal(r.data.items.length, 1); assert.ok(r.data.items[0].answer)
  assert.equal((await request('/chat/message', 'POST', { message: 'ありがとう', conversation_id: conversation.id, response_language: 'en' })).status, 200)
  const first = await request(`/chat/conversations/${conversation.id}/messages?limit=1&offset=0`)
  const second = await request(`/chat/conversations/${conversation.id}/messages?limit=1&offset=1`)
  assert.equal(first.data.has_more, true); assert.equal(second.data.has_more, false)
  assert.notEqual(first.data.items[0].id, second.data.items[0].id)
  assert.ok(first.data.items[0].id > second.data.items[0].id)
  const title = `Mobile phase2 ${suffix}`
  assert.equal((await request(`/chat/conversations/${conversation.id}`, 'PATCH', { title })).status, 200)
  assert.equal((await request(`/chat/conversations/${conversation.id}/pin`, 'PUT', { is_pinned: true })).status, 200)
  r = await request('/chat/folders', 'POST', { name: title }); assert.equal(r.status, 201); const folder = r.data
  assert.equal((await request(`/chat/folders/${folder.id}`, 'PATCH', { name: `${title} renamed` })).status, 200)
  assert.equal((await request(`/chat/conversations/${conversation.id}/folder`, 'PUT', { folder_id: folder.id })).status, 200)
  r = await request(`/chat/conversations?search=${encodeURIComponent('こんにちは')}&limit=1`); assert.equal(r.status, 200); assert.equal(r.data.items[0].id, conversation.id)
  assert.equal((await request(`/chat/folders/${folder.id}?delete_conversations=false`, 'DELETE')).status, 200)
  r = await request(`/chat/conversations/${conversation.id}`); assert.equal(r.data.folder_id, null)
  r = await request('/chat/folders', 'POST', { name: title }); const folder2 = r.data
  await request(`/chat/conversations/${conversation.id}/folder`, 'PUT', { folder_id: folder2.id })
  assert.equal((await request(`/chat/folders/${folder2.id}?delete_conversations=true`, 'DELETE')).status, 200)
  assert.equal((await request(`/chat/conversations/${conversation.id}`)).status, 404)
  r = await request('/chat/conversations', 'POST', { mode: 'text' }); const removable = r.data.id
  assert.equal((await request(`/chat/conversations/${removable}`, 'DELETE')).status, 204)
  assert.equal((await request(`/chat/conversations/${removable}`)).status, 404)
  console.log('PASS chat send/messages/search/rename/pin/move and folder rename/deletion with both modes')
  if (process.argv.includes('--ai')) {
    r = await request('/analysis/grammar', 'POST', { text: '私は毎日日本語を勉強しています。', response_language: 'en' }); assert.equal(r.status, 200); assert.ok(r.data.jlpt_level)
    console.log('PASS live grammar analysis')
    r = await request('/grammar-practice/sessions', 'POST', { jlpt_level: 'N5', question_types: ['fill_blank'], count: 5, mode: 'ai' }); assert.equal(r.status, 200, 'The configured AI provider did not produce valid practice questions'); assert.ok(r.data.questions.length)
    console.log('PASS live grammar analysis and AI generation')
  } else console.log('NOT RUN external AI analysis/generation; use --ai for the configured provider.')
} finally {
  if (accountId) {
    if (!token) token = (await request('/auth/login', 'POST', account)).data.access_token
    assert.equal((await request('/auth/me')).data.id, accountId)
    assert.equal((await request('/auth/me', 'DELETE')).status, 204)
    console.log('CLEANUP disposable account, grammar sessions, messages and folders')
  }
}
