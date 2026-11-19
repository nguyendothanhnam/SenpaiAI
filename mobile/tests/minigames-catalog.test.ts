import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createInstance } from 'i18next'
import { GAMES, LEVELS } from '../../shared-games/types'
import { availability } from '../../shared-games/availability'
import { EMPTY_STATS, statsKey } from '../../shared-games/stats'
import { themes } from '../../frontend/src/themes/themes'
import { resources } from '../src/i18n/resources'
import { colorAlpha, gradientColors, readableText } from '../src/theme/nativeStyle'

const require = createRequire(import.meta.url)
function load(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} as Record<string, React.ComponentType> }
  new Function('require', 'module', 'exports', code)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}
test('catalog filters follow actual availability; help and start retain their original game and route', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const i18n = createInstance()
  await i18n.init({ resources, lng: 'vi', defaultNS: 'common' })
  const user = { id: 42 }
  const routes: unknown[] = [], reads: string[] = []
  const stats = { version: 1, entries: {
    [statsKey('falling', 'N5', 'normal', 'reading')]: { ...EMPTY_STATS, highScore: 120 },
    [statsKey('falling', 'N3', 'hard', 'meaning')]: { ...EMPTY_STATS, highScore: 950 },
    [statsKey('memory', 'N3', 'normal', 'hiragana')]: { ...EMPTY_STATS, highScore: 80 },
  } }
  const { MiniGamesScreen } = load('../src/screens/MiniGamesScreen.tsx', {
    '@games/types': { GAMES, LEVELS }, '@games/availability': { availability },
    '../components/minigames/GameGuide': { GameGuide: 'Guide' },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (value: unknown) => value } },
    '@expo/vector-icons/Ionicons': 'Icon',
    'expo-router': { router: { push: (route: unknown) => routes.push(route) }, useFocusEffect: (callback: () => () => void) => React.useEffect(callback, [callback]) },
    'react-i18next': { useTranslation: (ns: string) => ({ t: (key: string, options = {}) => i18n.t(key, { ns, ...options }), i18n }) },
    '../auth/AuthProvider': { useAuth: () => ({ user }) },
    '../features/minigames/native': { gameStore: { read: async (account: string) => { reads.push(account); return stats } } },
    '../components/ui': Object.fromEntries(['AppText', 'Card', 'ErrorNotice', 'Screen'].map(name => [name, name])),
    '../theme/ThemeProvider': { useTheme: () => ({ colors: themes['than-khe'].palettes.dark }), nativeThemes: themes },
    '../theme/nativeStyle': { colorAlpha, gradientColors, readableText },
  })
  let renderer: ReactTestRenderer | undefined
  const texts = () => renderer!.root.findAll(node => String(node.type) === 'AppText')
  const headers = () => texts().filter(node => node.props.accessibilityRole === 'header').map(node => node.props.children)
  const tap = async (label: string) => { await act(async () => renderer!.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label).props.onPress()) }
  try {
    await act(async () => { renderer = create(React.createElement(MiniGamesScreen)) })
    assert.deepEqual(reads, ['42'])
    assert.equal(headers().length, GAMES.length)
    assert.ok(!headers().includes(resources.vi.common.minigames.title))
    const scoreLabel = i18n.t('minigames.highScore', { score: 950 })
    assert.equal(renderer!.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityLabel === scoreLabel).length, 1)
    for (const level of ['N5', 'N4', 'N3'] as const) {
      await tap(level)
      const expected = GAMES.filter(game => availability(game, level).enabled)
      assert.deepEqual(headers(), expected.map(game => i18n.t(`minigames.games.${game}.name`)))
      assert.equal(renderer!.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === level).props.accessibilityState.selected, true)
    }
    await tap(resources.vi.mobile.minigames.catalog.all)
    assert.equal(headers().length, GAMES.length)
    for (const game of GAMES) {
      const name = i18n.t(`minigames.games.${game}.name`)
      await tap(`${i18n.t('gameHelp.title')} · ${name}`)
      assert.equal(renderer!.root.find(node => String(node.type) === 'Guide').props.game, game)
      await act(async () => renderer!.root.find(node => String(node.type) === 'Guide').props.onClose())
      await tap(`${i18n.t('minigames.start')} · ${name}`)
      assert.deepEqual(routes.at(-1), { pathname: '/games/[game]', params: { game } })
    }
    assert.deepEqual(reads, ['42']) // Filtering never re-reads or changes the account's statistics.
    await i18n.changeLanguage('en')
    await act(async () => renderer!.update(React.createElement(MiniGamesScreen)))
    assert.equal(headers()[0], resources.en.common.minigames.games.falling.name)
    assert.ok(texts().some(node => node.props.children === resources.en.mobile.minigames.catalog.notice))
    assert.ok(texts().some(node => node.props.children === resources.en.mobile.minigames.catalog.japanese.falling))
  } finally { await act(async () => renderer?.unmount()) }
})

test('settings lives in the native header and keeps the existing settings destination in every theme', async () => {
  const routes: unknown[] = []
  const tools: boolean[] = []
  Object.assign(globalThis, { __DEV__: true })
  let colors = themes.classic.palettes.light
  const { default: GamesRoute } = load('../app/games/index.tsx', {
    '@expo/vector-icons/Ionicons': 'Icon',
    'expo-router': { Stack: { Screen: 'HeaderOptions' }, router: { push: (route: unknown) => routes.push(route) }, useFocusEffect: (callback: () => (() => void) | undefined) => React.useEffect(callback, [callback]) },
    'expo-dev-client': { setToolsButtonVisible: (visible: boolean) => tools.push(visible) },
    'react-native': { Pressable: 'Pressable' },
    'react-i18next': { useTranslation: () => ({ t: () => resources.vi.nav.settings }) },
    '../../src/theme/ThemeProvider': { useTheme: () => ({ colors }) },
    '../../src/screens/MiniGamesScreen': { MiniGamesScreen: 'Catalog' },
  })
  let renderer: ReactTestRenderer | undefined, header: ReactTestRenderer | undefined
  try {
    for (const theme of Object.values(themes)) for (const mode of ['light', 'dark'] as const) {
      colors = theme.palettes[mode]
      await act(async () => { renderer = create(React.createElement(GamesRoute)) })
      const options = renderer!.root.find(node => String(node.type) === 'HeaderOptions').props.options
      await act(async () => { header = create(options.headerRight()) })
      assert.equal(header!.root.find(node => String(node.type) === 'Icon').props.color, colors.primary)
      await act(async () => header!.root.find(node => String(node.type) === 'Pressable').props.onPress())
      assert.equal(routes.at(-1), '/(tabs)/personal/settings')
      assert.equal(renderer!.root.findAll(node => String(node.type) === 'Pressable').length, 0)
      await act(async () => { renderer!.unmount(); header!.unmount() })
    }
    assert.deepEqual(tools, Object.values(themes).flatMap(() => [false, true, false, true]))
    const before = tools.length
    Object.assign(globalThis, { __DEV__: false })
    await act(async () => { renderer = create(React.createElement(GamesRoute)) })
    await act(async () => renderer!.unmount())
    assert.equal(tools.length, before)
  } finally { await act(async () => { renderer?.unmount(); header?.unmount() }); Object.assign(globalThis, { __DEV__: false }) }
})
