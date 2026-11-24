import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function load(path, modules = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, URLSearchParams, require: name => {
    if (name === 'react/jsx-runtime') return jsxRuntime
    if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) }
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
    if (name === 'react-router-dom') return { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) }
    assert.ok(name in modules, name); return modules[name]
  } })
  return exports
}
const { default: Setup } = load('../src/components/placement/PlacementSetup.tsx')
const { default: Results } = load('../src/components/placement/PlacementResults.tsx')
const { placementDefault, comparableAttempts } = load('../src/utils/placementDefaults.ts')
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'].map(level => ({ level, available: level === 'N5', is_demo: level === 'N5' }))
const renderSetup = (mode, available = true) => renderToStaticMarkup(React.createElement(Setup, {
  mode, level: 'N5', levels, available, busy: false, onMode() {}, onLevel() {}, onStart() {},
}))

test('landing offers two modes without showing a question or assigning a level', () => {
  const html = renderSetup('adaptive')
  assert.equal((html.match(/name="placement-mode"/g) || []).length, 2)
  assert.doesNotMatch(html, /name="placement-level"/)
  assert.match(html, /demoNotice/)
})
test('confirmation displays five levels and disables the four unavailable banks', () => {
  const html = renderSetup('confirmation')
  assert.equal((html.match(/name="placement-level"/g) || []).length, 5)
  assert.equal((html.match(/name="placement-level"[^>]*disabled=""/g) || []).length, 4)
  assert.match(html, /selectionDoesNotSetLevel/)
  assert.match(renderSetup('confirmation', false), /<button[^>]*disabled=""/)
})
test('demo result offers reference save, has five bars and cannot claim the suggested level', () => {
  const html = renderToStaticMarkup(React.createElement(Results, { attempt: {
    assessment_mode: 'confirmation', selected_level: 'N5', result: {
      recommended_level: 'N5', estimated_level: null, suggested_level: 'N5', is_demo: true,
      skill_scores: {}, strengths: [], weaknesses: [], focus_skills: [],
    },
  }, busy: false, onConfirm() {}, onRetake() {}, onAdjacent() {} }))
  assert.match(html, /insufficientEvidence/)
  assert.match(html, /saveReference/)
  assert.match(html, /demoNotice/)
  assert.equal((html.match(/<progress/g) || []).length, 5)
  assert.doesNotMatch(html, /tryLevel/)
})
test('practice defaults honor profile, explicit higher-level requests and unavailable-level fallbacks', () => {
  assert.equal(placementDefault('', 'N4', ['N5', 'N4', 'N3'], 'N5'), 'N4')
  assert.equal(placementDefault('level=N3', 'N4', ['N5', 'N4', 'N3'], 'N5'), 'N3')
  assert.equal(placementDefault('', 'N1', ['N5', 'N4', 'N3'], 'N5'), 'N5')
  assert.equal(placementDefault('level=invalid', undefined, ['N5'], ''), '')
})
test('progress trend excludes demo, other modes, other levels and scoring versions', () => {
  const row = { mode: 'confirmation', selected_level: 'N4', scoring_version: 'v2', is_demo: false, total_score: 75 }
  const rows = [{ ...row, id: 6 }, { ...row, id: 5, selected_level: 'N3' }, { ...row, id: 4, is_demo: true }, { ...row, id: 3, scoring_version: 'v1' }, { ...row, id: 2, mode: 'adaptive' }, { ...row, id: 1, total_score: 60 }]
  assert.deepEqual(Array.from(comparableAttempts(rows), row => row.id), [1, 6])
})
