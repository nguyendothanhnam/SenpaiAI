import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
if (!process.argv.includes('--create-test-account')) throw new Error('Use --create-test-account for a disposable diagnostic account.')
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
assert.ok(base)
const suffix = randomBytes(5).toString('hex')
const account = { username: `diag_${suffix}`, email: `diag-${suffix}@example.com`, password: randomBytes(18).toString('hex') }
let token, id
const request = async (path, method = 'GET', body) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(180000) })
  return { status: response.status, data: response.status === 204 ? null : await response.json() }
}
try {
  const created = await request('/auth/register', 'POST', account); assert.equal(created.status, 201); id = created.data.id
  const login = await request('/auth/login', 'POST', account); assert.equal(login.status, 200); token = login.data.access_token
  const patterns = await request('/grammar-practice/patterns?jlpt_level=N5'); assert.equal(patterns.status, 200)
  const rule = patterns.data.patterns.find(p => p.question_counts.fill_blank > 0)
  assert.ok(rule)
  const options = { jlpt_level: 'N5', grammar_rule_id: rule.id, question_types: ['fill_blank'], count: 5 }
  const bank = await request('/grammar-practice/sessions', 'POST', { ...options, mode: 'bank' })
  console.log('BANK', bank.status, 'questions:', bank.data.questions?.length || 0)
  const generated = await request('/grammar-practice/generate', 'POST', { jlpt_level: 'N5', grammar_rule_id: rule.id, question_type: 'fill_blank', count: 1 })
  const g = generated.data
  let reason = g.error ? 'provider_error' : g.limited ? 'generation_limit' : g.saved === 0 ? 'invalid_or_duplicate_generated_content' : 'generated_content_saved'
  if (g.error && /connect|refused|unreachable|timeout|timed out/i.test(g.error)) reason = 'provider_connection_or_timeout'
  if (g.error && /model.*not found|model.*does not exist/i.test(g.error)) reason = 'provider_model_missing'
  console.log('GENERATE', generated.status, JSON.stringify({ requested: g.requested, saved: g.saved, rejected: g.rejected, limited: g.limited || false, reason }))
  if (g.error) {
    const safe = String(g.error).replace(/sk-[\w-]+/g, '[redacted]').replace(/Bearer\s+[\w.-]+/gi, 'Bearer [redacted]').replace(/((?:api[_-]?key|secret|password|token)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    console.log('PROVIDER DIAGNOSTIC', safe.slice(0, 450))
  }
  if (process.argv.includes('--sessions')) for (const mode of ['ai', 'mixed']) {
    const result = await request('/grammar-practice/sessions', 'POST', { ...options, mode })
    const detail = result.data.detail
    const classification = typeof detail === 'string' && /Không có câu hỏi/.test(detail) ? 'no_valid_questions' : detail === 'Not Found' ? 'route_not_found' : detail === 'Grammar pattern not found' ? 'pattern_not_found' : 'other'
    console.log('SESSION', mode, result.status, JSON.stringify({ questions: result.data.questions?.length || 0, detail: result.status >= 400 ? classification : undefined, hasMessage: Boolean(result.data.message) }))
  }
} finally {
  if (id) {
    if (!token) token = (await request('/auth/login', 'POST', account)).data.access_token
    assert.equal((await request('/auth/me')).data.id, id)
    assert.equal((await request('/auth/me', 'DELETE')).status, 204)
    console.log('CLEANUP diagnostic account and its practice history')
  }
}
