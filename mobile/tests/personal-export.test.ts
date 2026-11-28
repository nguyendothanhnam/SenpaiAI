import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { exportDay, exportHeaders, exportPath } from '../src/utils/personalExport'
const require = createRequire(import.meta.url)
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

test('download requests use the dedicated API and robust summary headers', () => {
  assert.equal(exportPath('json', 'vi'), '/auth/me/export/download?format=json')
  assert.equal(exportDay(new Date('2026-11-26T18:00:00Z')), '2026-11-27')
  assert.equal(exportPath('zip', 'en'), '/auth/me/export/download?format=zip')
  assert.equal(exportPath('html', 'en-US'), '/auth/me/export/report?language=en')
  assert.deepEqual(exportHeaders({ 'X-Export-Summary': '{"chat_history":2000}', 'X-Export-Truncated': 'true' }), { counts: { chat_history: 2000 }, truncated: true })
  assert.deepEqual(exportHeaders({ 'X-Export-Summary': 'invalid' }), { counts: {}, truncated: false })
})

function load(mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL('../src/screens/ExportScreen.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} as { ExportScreen: React.ComponentType } }
  new Function('require', 'module', 'exports', code)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports.ExportScreen
}

for (const offline of [false, true]) test(`native export ${offline ? 'cleans a failed download and retries' : 'downloads to disk, prevents duplicates and shares a file URI'}`, async () => {
  let fail = offline
  let downloads = 0
  const removed: string[] = [], shared: string[] = []
  let resolve: (() => void) | undefined
  const gate = () => new Promise<void>(done => { resolve = done })
  const t = (key: string) => key
  const Component = load({
    'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'vi' } }) },
    '../auth/AuthProvider': { useAuth: () => ({ user: { id: 1 } }) },
    '../components/ui': Object.fromEntries(['AppText', 'Button', 'Card', 'ErrorNotice', 'Muted', 'Screen', 'Title'].map(name => [name, name])),
    '../config/env': { apiConfiguration: { url: 'https://example.test/api' } },
    '../storage/secureToken': { secureToken: { get: async () => 'private-token' } },
    '../utils/personalExport': { exportDay, exportHeaders, exportPath },
    '../features/study/storage': { studyStorageKey: () => 'study-account-1' },
    '@games/stats': { accountStorageKey: () => 'game-account-1' },
    '@react-native-async-storage/async-storage': { multiGet: async () => [] },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri: string) => { shared.push(uri) } },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/', makeDirectoryAsync: async () => {},
      createDownloadResumable: (url: string, uri: string, options: { headers: { Authorization: string } }) => {
        assert.equal(url, 'https://example.test/api/auth/me/export/download?format=json')
        assert.equal(options.headers.Authorization, 'Bearer private-token')
        return { cancelAsync: async () => {}, downloadAsync: async () => {
          downloads++; await gate()
          if (fail) { fail = false; throw Error('offline') }
          return { status: 200, uri, headers: { 'X-Export-Summary': '{"chat_history":2500}' } }
        } }
      },
      getInfoAsync: async () => ({ exists: true, size: 123456 }),
      deleteAsync: async (uri: string) => { removed.push(uri) },
    },
  })
  let renderer: ReactTestRenderer | undefined
  const button = (key: string) => renderer!.root.find(node => String(node.type) === 'Button' && node.props.title === key)
  try {
    await act(async () => { renderer = create(React.createElement(Component)) })
    assert.equal(downloads, 0)
    await act(async () => { button('personalExport.download').props.onPress(); button('personalExport.download').props.onPress() })
    assert.equal(downloads, 1)
    assert.equal(button('personalExport.preparing').props.disabled, true)
    await act(async () => { resolve!() })
    if (offline) {
      assert.equal(removed.length, 1)
      assert.equal(renderer!.root.findAll(node => String(node.type) === 'ErrorNotice').length, 1)
      await act(async () => { button('personalExport.download').props.onPress() })
      await act(async () => { resolve!() })
      assert.equal(downloads, 2)
    }
    await act(async () => { button('personalExport.share').props.onPress() })
    assert.match(shared[0], /^file:\/\/\/cache\/personal-export-1\/senpaiai-.*\.json$/)
    assert.equal(shared.length, 1)
    assert.match(JSON.stringify(renderer!.toJSON()), /2500/)
    assert.doesNotMatch(JSON.stringify(renderer!.toJSON()), /private-token/)
  } finally { await act(async () => { renderer?.unmount() }) }
})
