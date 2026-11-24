import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function render(selections, language = 'en') {
  const strings = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`, import.meta.url), 'utf8')).exerciseSelection
  const source = readFileSync(new URL('../src/components/ExerciseSelectionNotice.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: name => {
    if (name === 'react/jsx-runtime') return jsxRuntime
    assert.equal(name, 'react-i18next')
    return { useTranslation: () => ({ t: (key, params = {}) => strings[key.split('.')[1]].replace('{{level}}', params.level || '') }) }
  } })
  return renderToStaticMarkup(React.createElement(exports.default, { selections }))
}

test('older API payloads and fresh exact-level exercises render no warning', () => {
  assert.equal(render([undefined]), '')
  assert.equal(render([{ fallback: false, review_mode: false }]), '')
})
test('review and exhausted cooldown notices use translated text in both languages', () => {
  assert.match(render([{ review_mode: true }]), /Review mode/)
  assert.match(render([{ review_mode: true, cooldown_relaxed: true }], 'vi'), /Kho câu ngoài khoảng chống lặp đã cạn/)
  assert.match(render([{ review_mode: true }]), /role="note"/)
})
test('fallback lists distinct real levels and theme tokens without relying on color alone', () => {
  const html = render([{ actual_level: 'N4', fallback: true }, { actual_level: 'N4', fallback: true }, { actual_level: 'N2', fallback: true }])
  assert.match(html, /Actual level: N4, N2/)
  assert.match(html, /var\(--text-muted\)/)
})
