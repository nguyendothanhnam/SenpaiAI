import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { createInstance } from 'i18next'

function harness(language, request) {
  const instance = createInstance()
  instance.init({ lng: language, defaultNS: 'profile', initImmediate: false, resources: { [language]: { profile: JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/profile.json`, import.meta.url), 'utf8')) } } })
  const slots = [], files = [], revoked = []
  let cursor = 0
  const hooks = {
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = next }] },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value } },
  }
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL('../src/components/profile/PersonalExport.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = {
    react: hooks, 'react/jsx-runtime': jsxRuntime,
    'react-i18next': { useTranslation: () => ({ t: key => { assert.ok(instance.exists(key), key); return instance.t(key) }, i18n: { language } }) },
    '../../services/api': { authAPI: { exportFile: request } },
  }
  vm.runInNewContext(code, {
    module, exports: module.exports, require: name => { assert.ok(name in mocks, name); return mocks[name] },
    URL: { createObjectURL: () => 'blob:export', revokeObjectURL: url => revoked.push(url) },
    document: { body: { append() {} }, createElement: () => ({ href: '', download: '', click() { files.push(this.download) }, remove() {} }) },
    window: { setTimeout: callback => { callback() } }, Date,
  })
  return {
    render() { cursor = 0; return module.exports.default() }, files, revoked, instance,
  }
}
function find(element, predicate) {
  if (!element || typeof element !== 'object') return
  if (predicate(element)) return element
  for (const child of React.Children.toArray(element.props?.children)) { const result = find(child, predicate); if (result) return result }
}

for (const language of ['vi', 'en']) test(`web export confirms format, blocks duplicates and downloads files (${language})`, async () => {
  let finish
  const calls = []
  const h = harness(language, (kind, lang) => { calls.push([kind, lang]); return new Promise(resolve => { finish = resolve }) })
  let tree = h.render()
  assert.equal(calls.length, 0)
  assert.equal(find(tree, n => n.props?.role === 'dialog'), undefined)
  find(tree, n => n.type === 'button').props.onClick()
  tree = h.render()
  assert.ok(find(tree, n => n.props?.role === 'dialog'))
  find(tree, n => n.type === 'select').props.onChange({ target: { value: 'zip' } })
  tree = h.render()
  const download = find(tree, n => n.type === 'button' && n.props.children === h.instance.t('personalExport.download'))
  download.props.onClick(); download.props.onClick()
  assert.deepEqual(calls, [['zip', language]])
  tree = h.render()
  assert.equal(find(tree, n => n.type === 'select').props.disabled, true)
  finish({ data: {}, headers: { 'x-export-truncated': 'true' } })
  await new Promise(resolve => setImmediate(resolve))
  tree = h.render()
  assert.match(h.files[0], /^senpaiai-\d{4}-\d{2}-\d{2}\.zip$/)
  assert.deepEqual(h.revoked, ['blob:export'])
  assert.ok(renderToStaticMarkup(tree).includes(h.instance.t('personalExport.truncated')))
})

test('web export displays a translated failure and allows retry', async () => {
  const h = harness('en', async () => { throw Error('offline') })
  find(h.render(), n => n.type === 'button').props.onClick()
  find(h.render(), n => n.type === 'button' && n.props.children === h.instance.t('personalExport.download')).props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  const tree = h.render()
  assert.ok(renderToStaticMarkup(tree).includes(h.instance.t('personalExport.error')))
  assert.equal(find(tree, n => n.type === 'select').props.disabled, false)
  assert.equal(h.files.length, 0)
})
