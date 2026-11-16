import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = readFileSync(new URL('../src/features/dialogs/queue.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function queue() { const module = { exports: {} }; vm.runInNewContext(compiled, { module, exports: module.exports }); return new module.exports.DialogQueue() }
test('missing dialog host fails closed instead of approving an action', async () => { assert.equal(await queue().ask({ message: 'Delete?' }), null) })
test('only the displayed request resolves; different confirmations are queued', async () => {
  const q = queue(); const unsubscribe = q.subscribe(() => undefined)
  const first = q.ask({ message: 'First' }), second = q.ask({ message: 'Second' })
  assert.equal(q.snapshot().message, 'First')
  q.answer('confirm'); assert.equal(await first, 'confirm'); assert.equal(q.snapshot().message, 'Second')
  q.answer(null); assert.equal(await second, null); assert.equal(q.snapshot(), null); unsubscribe()
})
test('a rapid duplicate click is rejected and cannot cause two destructive actions', async () => {
  const q = queue(); q.subscribe(() => undefined)
  const first = q.ask({ message: 'Delete this set', tone: 'danger' })
  assert.equal(await q.ask({ message: 'Delete this set', tone: 'danger' }), null)
  q.answer('confirm'); assert.equal(await first, 'confirm'); assert.equal(q.snapshot(), null)
})
test('secondary action is distinct from approval and from dismissing the dialog', async () => {
  const q = queue(); q.subscribe(() => undefined)
  const request = q.ask({ message: 'Folder', secondaryLabel: 'Keep conversations' })
  q.answer('secondary'); assert.equal(await request, 'secondary')
})
test('teardown cancels every queued request and resets the snapshot', async () => {
  const q = queue(); let notifications = 0; q.subscribe(() => notifications++)
  const a = q.ask({ message: 'A' }), b = q.ask({ message: 'B' }); q.cancelAll()
  assert.equal(await a, null); assert.equal(await b, null); assert.equal(q.snapshot(), null); assert.equal(notifications, 3)
})
test('a stale double click cannot approve the next queued confirmation', async () => {
  const q = queue(); q.subscribe(() => undefined)
  const a = q.ask({ message: 'A' }), b = q.ask({ message: 'B' }), displayed = q.snapshot()
  q.answer('confirm', displayed); q.answer('confirm', displayed)
  assert.equal(await a, 'confirm'); assert.equal(q.snapshot().message, 'B')
  q.answer(null); assert.equal(await b, null)
})
