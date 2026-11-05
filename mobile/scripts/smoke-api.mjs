import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

// Explicit opt-in: this integration check creates and deletes ONLY its own account.
if (!process.argv.includes('--create-test-account')) {
  console.error('Thêm --create-test-account để cho phép tạo tài khoản thử dùng một lần rồi xóa chính tài khoản đó.')
  process.exit(1)
}
const baseURL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '')
if (!baseURL) throw new Error('Thiếu EXPO_PUBLIC_API_URL')
const suffix = randomBytes(5).toString('hex')
const credentials = { email: `mobile-${suffix}@example.com`, username: `m0_${suffix}`, password: randomBytes(18).toString('hex') }
let token
let accountId
async function request(path, { method = 'GET', body, bearer = token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  return { status: response.status, data: response.status === 204 ? null : await response.json() }
}
try {
  const created = await request('/auth/register', { method: 'POST', body: credentials })
  assert.equal(created.status, 201, 'Đăng ký không trả về 201')
  accountId = created.data.id
  const login = await request('/auth/login', { method: 'POST', body: { email: credentials.email, password: credentials.password } })
  assert.equal(login.status, 200, 'Đăng nhập không trả về 200')
  token = login.data.access_token
  assert.ok(token)
  const me = await request('/auth/me')
  assert.equal(me.status, 200)
  assert.equal(me.data.id, accountId)
  assert.ok(me.data.current_jlpt_level)
  console.log('PASS: đăng ký → đăng nhập JWT → hồ sơ/JLPT')
  const rewards = await request('/rewards/me')
  assert.equal(rewards.status, 200)
  for (const key of ['points_balance', 'current_streak', 'longest_streak']) assert.equal(typeof rewards.data[key], 'number')
  console.log('PASS: điểm và chuỗi ngày học')
  for (const language of ['en', 'vi']) {
    assert.equal((await request('/auth/me', { method: 'PUT', body: { ui_language: language } })).status, 200)
    assert.equal((await request('/auth/me')).data.ui_language, language)
  }
  console.log('PASS: đồng bộ ngôn ngữ hồ sơ en ↔ vi')
  const daily = await request('/daily/today')
  assert.equal(daily.status, 200, 'Chưa đọc được nhiệm vụ hôm nay; kiểm tra nội dung seed của backend')
  assert.ok(['in_progress', 'completed'].includes(daily.data.status))
  assert.equal(typeof daily.data.progress.total_items, 'number')
  console.log('PASS: tổng quan nhiệm vụ hôm nay')
  assert.equal((await request('/auth/me', { bearer: 'invalid-test-jwt' })).status, 401)
  console.log('PASS: backend từ chối JWT không hợp lệ bằng 401')
} finally {
  if (accountId) {
    if (!token) {
      const login = await request('/auth/login', { method: 'POST', body: { email: credentials.email, password: credentials.password } })
      token = login.data.access_token
    }
    assert.ok(token, 'Không lấy được token để dọn tài khoản thử')
    const ownAccount = await request('/auth/me')
    assert.equal(ownAccount.data.id, accountId, 'Từ chối xóa tài khoản không thuộc lần kiểm tra này')
    assert.equal(ownAccount.data.username, credentials.username)
    const removed = await request('/auth/me', { method: 'DELETE' })
    assert.equal(removed.status, 204, `Cần dọn tài khoản thử ${credentials.username} (id ${accountId})`)
    console.log('CLEANUP: đã xóa tài khoản thử và dữ liệu nhiệm vụ của nó')
  }
}
