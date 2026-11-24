import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Render the actual gate with controlled authentication, route and query results.
function renderGate(query, pathname = '/shop') {
  const source = readFileSync(new URL('../src/components/placement/PlacementGate.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const exports = {}
  const modules = {
    'react/jsx-runtime': { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment },
    'react-router-dom': { useLocation: () => ({ pathname }), Navigate: ({ to }) => React.createElement('span', { 'data-redirect': to }) },
    'react-query': { useQuery: () => ({ refetch() {}, ...query }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../Layout': { default: ({ children }) => React.createElement('div', { 'data-layout': true }, children), __esModule: true },
    '../LoadingSpinner': { default: () => React.createElement('span', { role: 'progressbar' }), __esModule: true },
    '../../pages/Placement': { default: ({ requiredSetup }) => React.createElement('span', { 'data-required-setup': String(requiredSetup) }), __esModule: true },
    '../../services/auth': { useAuth: () => ({ user: { id: 1 }, logout() {} }) },
    '../../services/placement': { placementAPI: {} },
    '../../utils/getErrorMessage': { getErrorMessage: () => 'status error' },
  }
  vm.runInNewContext(compiled, { exports, require: name => { assert.ok(name in modules, name); return modules[name] } })
  return renderToStaticMarkup(React.createElement(exports.default, null, React.createElement('main', null, 'protected dashboard')))
}

test('unassessed users cannot open a deep link into the app', () => {
  const html = renderGate({ data: { has_completed: false, has_confirmed: false } })
  assert.match(html, /data-redirect="\/placement"/)
  assert.doesNotMatch(html, /protected dashboard/)
})
test('finishing without confirming still requires setup', () => {
  assert.match(renderGate({ data: { has_completed: true, has_confirmed: false } }), /data-redirect="\/placement"/)
})
test('the assessment route renders required setup before confirmation', () => {
  const html = renderGate({ data: { has_completed: false, has_confirmed: false, active_attempt_id: 17 } }, '/placement')
  assert.match(html, /data-required-setup="true"/)
  assert.doesNotMatch(html, /protected dashboard/)
})
test('confirmed users can use the app while a later retake remains unfinished', () => {
  const html = renderGate({ data: { has_completed: true, has_confirmed: true, active_attempt_id: 18 } })
  assert.match(html, /protected dashboard/)
  assert.doesNotMatch(html, /data-redirect/)
})

test('explicit manual setup permits access without pretending a test was completed', () => {
  assert.match(renderGate({ data: { has_completed: false, has_confirmed: true, has_manual_level: true, has_estimated_level: false } }), /protected dashboard/)
})
test('loading status cannot flash protected content', () => {
  const html = renderGate({ isLoading: true })
  assert.match(html, /progressbar/)
  assert.doesNotMatch(html, /protected dashboard/)
})
test('a failed status request exposes retry without bypassing placement', () => {
  const html = renderGate({ error: new Error('offline') })
  assert.match(html, /role="alert"/)
  assert.match(html, /retry/)
  assert.doesNotMatch(html, /protected dashboard/)
})
