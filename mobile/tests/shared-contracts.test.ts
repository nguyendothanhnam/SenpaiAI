import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createInstance } from 'i18next'
import { resources } from '../src/i18n/resources'
import { isValidEmail, isValidPassword, isValidUsername } from '../src/utils/validation'
import { getErrorMessage } from '../src/utils/getErrorMessage'
import { parseApiUrl } from '../src/config/env'

test('form validation remains equivalent to the web rules', () => {
  const source = readFileSync(new URL('../../frontend/src/utils/helpers.ts', import.meta.url), 'utf8')
  for (const [name, validate, values] of [
    ['isValidEmail', isValidEmail, ['', 'bad', 'a@b.co', 'a b@c.co']],
    ['isValidPassword', isValidPassword, ['', '12345', '123456', 'aA123456']],
    ['isValidUsername', isValidUsername, ['', 'ab', 'abc', 'user_123', 'invalid space', 'a'.repeat(20), 'a'.repeat(21)]],
  ] as const) {
    const body = source.match(new RegExp(`export function ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n\\}`))
    assert.ok(body, `Missing web validation ${name}`)
    const web = vm.runInNewContext(`(function(value) { ${body[2].replaceAll(body[1].split(':')[0], 'value')} })`) as (value: string) => boolean
    for (const value of values) assert.equal(validate(value), web(value), `${name}: ${value}`)
  }
})

test('error messages use the same detail/status/timeout mapping as the web', async () => {
  const translator = createInstance()
  await translator.init({ resources, lng: 'en', defaultNS: 'common' })
  assert.equal(getErrorMessage({ response: { status: 401, data: { detail: 'Incorrect email or password' } } }, translator), resources.en.errors.details['Incorrect email or password'])
  assert.equal(getErrorMessage({ response: { status: 409, data: { detail: { code: 'task_expired' } } } }, translator), resources.en.errors.details.task_expired)
  for (const [status, key] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'notFound'], [409, 'conflict'], [429, 'rateLimited'], [408, 'timeout'], [422, 'badRequest'], [503, 'server']] as const) {
    assert.equal(getErrorMessage({ response: { status } }, translator), resources.en.errors[key])
  }
  assert.equal(getErrorMessage({ code: 'ETIMEDOUT' }, translator), resources.en.errors.timeout)
  assert.equal(getErrorMessage({}, translator), resources.en.errors.network)
  await translator.changeLanguage('vi')
  assert.equal(getErrorMessage({}, translator), resources.vi.errors.network)
})

test('API configuration accepts LAN/emulator/tunnel and rejects unsafe or incomplete URLs', () => {
  for (const url of ['http://10.0.2.2:8000/api', 'http://192.168.1.10:8000/api', 'https://example.com/api/']) assert.ok(parseApiUrl(url).endsWith('/api'))
  for (const url of [undefined, 'localhost:8000', 'http://user:pass@host/api', 'ftp://host/api', 'http://host', 'http://host/api?token=secret']) assert.throws(() => parseApiUrl(url))
})
