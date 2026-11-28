import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import axios from 'axios/dist/browser/axios.cjs'
import ts from 'typescript'

// Exercise the actual API client and interceptors with an HTTP adapter returning 401.
function clientWithFailure(status) {
  const source = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', 'undefined')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const removed = []
  const location = { href: '/login' }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require: name => { assert.equal(name, 'axios'); return axios },
    localStorage: { getItem: () => null, removeItem: key => removed.push(key) },
    window: { location },
  })
  exports.api.defaults.adapter = async config => {
    throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
      status, data: { detail: 'Incorrect email or password' }, headers: {}, config,
    })
  }
  return { api: exports.api, removed, location }
}

for (const url of ['/auth/login', '/auth/login/', 'http://localhost:8000/api/auth/login?lang=vi']) {
  test(`invalid credentials at ${url} reach the form without reloading`, async () => {
    const { api, removed, location } = clientWithFailure(401)
    location.href = '/login?mode=sign-in'
    await assert.rejects(api.post(url, { email: 'missing@example.test', password: 'wrong' }), error => {
      assert.equal(error.response.data.detail, 'Incorrect email or password')
      return true
    })
    assert.equal(location.href, '/login?mode=sign-in')
    assert.deepEqual(removed, [])
  })
}

test('expired authenticated requests still clear the token and redirect', async () => {
  const { api, removed, location } = clientWithFailure(401)
  location.href = '/profile'
  await assert.rejects(api.get('/auth/me'))
  assert.equal(location.href, '/login')
  assert.deepEqual(removed, ['access_token'])
})

test('server failures do not redirect or discard credentials', async () => {
  const { api, removed, location } = clientWithFailure(500)
  location.href = '/profile'
  await assert.rejects(api.get('/auth/me'))
  assert.equal(location.href, '/profile')
  assert.deepEqual(removed, [])
})
