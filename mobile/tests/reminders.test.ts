import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createInstance } from 'i18next'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from 'react-query'
import ts from 'typescript'
import { resources } from '../src/i18n/resources'
import { mobileSettings, nextNotificationLimit, notificationCopy, notificationTarget, relativeNotificationTime, validateReminderSettings } from '../src/features/reminders/logic'
import type { AppNotification, ReminderSettings } from '../src/api/reminders'

const defaults: ReminderSettings = { enabled: true, timezone: 'Asia/Ho_Chi_Minh', reminder_time: '20:00', days_of_week: [0, 1, 2, 3, 4, 5, 6], types: ['daily_task', 'streak_risk', 'review_due'], quiet_start: '22:00', quiet_end: '07:00', max_per_day: 3, push_enabled: true, snooze_until: '2026-11-20T12:00:00Z' }
const item: AppNotification = { id: 1, type: 'daily_task', title: 'server title', body: 'server body', url: '/daily', data: {}, created_at: '2026-11-19T00:00:00', read_at: null }
async function translator(language = 'en') {
  const i18n = createInstance()
  await i18n.init({ resources, lng: language, defaultNS: 'common', interpolation: { escapeValue: false } })
  return i18n
}
test('server notification links use native routes and unknown/unsafe URLs stay in the list', () => {
  for (const url of ['/daily', '/daily?date=2026-11-19', '/daily/#task']) assert.equal(notificationTarget(url), '/(tabs)/daily')
  assert.equal(notificationTarget('/library'), '/(tabs)/library')
  assert.equal(notificationTarget('/grammar'), '/grammar')
  assert.equal(notificationTarget('/kanji'), '/kanji')
  assert.equal(notificationTarget('/settings/reminders'), '/reminder-settings')
  for (const url of [null, '', '/unknown', '//example.com', 'https://example.com/daily', 'javascript:alert(1)', '/\\example.com', '/%2fexample.com', '/daily/../settings', '/daily\n']) assert.equal(notificationTarget(url), '/notifications')
})
test('settings use strict server times, IANA zones and integer daily limits', () => {
  assert.equal(validateReminderSettings(defaults), undefined)
  for (const time of ['24:00', '9:00', '20:60', '', ' 20:00']) assert.equal(validateReminderSettings({ ...defaults, reminder_time: time }), 'timeError')
  for (const zone of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/Berlin', 'UTC']) assert.equal(validateReminderSettings({ ...defaults, timezone: zone }), undefined)
  for (const zone of ['', 'Not/AZone', '+07:00', ' Asia/Ho_Chi_Minh']) assert.equal(validateReminderSettings({ ...defaults, timezone: zone }), 'timezoneError')
  for (const max of [0, 21, NaN, 1.5]) assert.equal(validateReminderSettings({ ...defaults, max_per_day: max }), 'limitError')
  for (const max of [1, 20]) assert.equal(validateReminderSettings({ ...defaults, max_per_day: max }), undefined)
})
test('empty selections and equal/overnight quiet hours remain valid; invalid days/types are rejected', () => {
  assert.equal(validateReminderSettings({ ...defaults, days_of_week: [], types: [], quiet_start: '07:00', quiet_end: '07:00' }), undefined)
  for (const days of [[0, 0], [-1], [7], [1.5]]) assert.equal(validateReminderSettings({ ...defaults, days_of_week: days }), 'daysError')
  assert.equal(validateReminderSettings({ ...defaults, types: ['bad' as 'daily_task'] }), 'typesError')
})
test('mobile save payload preserves browser push and server snooze by omitting both', () => {
  const payload = mobileSettings(defaults)
  assert.ok(!('push_enabled' in payload)); assert.ok(!('snooze_until' in payload))
  payload.days_of_week.pop(); payload.types.pop()
  assert.equal(defaults.days_of_week.length, 7); assert.equal(defaults.types.length, 3)
})
test('load more grows the newest-first window without exceeding the API limit', () => {
  assert.equal(nextNotificationLimit(20, 20), 40)
  assert.equal(nextNotificationLimit(80, 80), 100)
  assert.equal(nextNotificationLimit(100, 100), null)
  assert.equal(nextNotificationLimit(20, 19), null)
})
test('notification copy uses shared translations, pluralization and current language', async () => {
  const i18n = await translator()
  assert.equal(notificationCopy(item, i18n).title, resources.en.common.notificationTypes.daily_task.title)
  assert.match(notificationCopy({ ...item, type: 'review_due', data: { review_count: 1 } }, i18n).body, /1 word or kanji/)
  assert.match(notificationCopy({ ...item, type: 'review_due', data: { review_count: 2 } }, i18n).body, /2 words or kanji/)
  assert.match(notificationCopy({ ...item, type: 'streak_risk', data: { streak: 5 } }, i18n).body, /5-day/)
  assert.equal(notificationCopy({ ...item, type: 'custom' }, i18n).title, resources.en.common.notificationTypes.unknown.title)
  await i18n.changeLanguage('vi')
  assert.equal(notificationCopy(item, i18n).title, resources.vi.common.notificationTypes.daily_task.title)
})
test('relative time treats missing offsets as UTC and handles invalid/future timestamps in both languages', async () => {
  const i18n = await translator()
  const now = Date.parse('2026-11-19T00:02:00Z')
  assert.equal(relativeNotificationTime(item.created_at, now, i18n), '2 minutes ago')
  assert.equal(relativeNotificationTime('2026-11-19T07:00:00+07:00', now, i18n), '2 minutes ago')
  assert.equal(relativeNotificationTime('2026-11-20T00:00:00Z', now, i18n), 'Just now')
  assert.equal(relativeNotificationTime(null, now, i18n), 'Time unavailable')
  assert.equal(relativeNotificationTime('invalid', now, i18n), 'Time unavailable')
  await i18n.changeLanguage('vi')
  assert.equal(relativeNotificationTime(item.created_at, now, i18n), '2 phút trước')
})

// Run the actual React components with host/native boundaries replaced, not a second implementation.
const require = createRequire(import.meta.url)
function loadComponent(path: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} as Record<string, React.ComponentType> }
  new Function('require', 'module', 'exports', code)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 25)) }
test('count refresh starts at mount/resume, cancels in-flight work on background and removes listener on unmount', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } })
  let calls = 0, aborted = 0, removed = false
  let onChange: (state: string) => void = () => undefined
  const { NotificationProvider } = loadComponent('../src/features/reminders/NotificationProvider.tsx', {
    'react-native': { AppState: { currentState: 'active', addEventListener: (_: string, callback: typeof onChange) => { onChange = callback; return { remove: () => { removed = true } } } } },
    '../../auth/AuthProvider': { useAuth: () => ({ status: 'authenticated', user: { id: 1 } }) },
    '../../api/services': { queryClient: client },
    '../../api/reminders': { notificationsAPI: { count: (signal: AbortSignal) => {
      calls++
      if (calls === 1) return new Promise(() => { signal.addEventListener('abort', () => aborted++) })
      return Promise.resolve({ unread_count: 2 })
    } } },
  })
  let renderer: ReactTestRenderer | undefined
  try {
    await act(async () => { renderer = create(React.createElement(QueryClientProvider, { client }, React.createElement(NotificationProvider))) })
    assert.equal(calls, 1)
    await act(async () => { onChange('background'); await settle() })
    assert.equal(aborted, 1)
    const options = client.getQueryCache().getAll()[0].getObserversCount()
    assert.equal(options, 1)
    await act(async () => { await settle() }); assert.equal(calls, 1)
    await act(async () => { onChange('active'); await settle() }); assert.equal(calls, 2)
  } finally { await act(async () => renderer?.unmount()); client.clear() }
  assert.equal(removed, true)
})

test('settings preserve a dirty draft on refetch, apply suggestions only on consent and suppress duplicate saves', async () => {
  const i18n = await translator()
  const t = (key: string, options = {}) => i18n.t(key, { ns: 'mobile', ...options })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } })
  let saves = 0, payload: unknown
  let finish: (value: ReminderSettings) => void = () => undefined
  const { ReminderSettingsScreen } = loadComponent('../src/screens/ReminderSettingsScreen.tsx', {
    '../features/reminders/LocalReminderProvider': { useLocalReminders: () => ({ refresh: async () => undefined, enable: async () => undefined }) },
    '../components/LocalReminderStatus': { LocalReminderStatus: 'LocalStatus' },
    'react-native': { Switch: 'Switch', View: 'View' },
    'react-i18next': { useTranslation: () => ({ t, i18n }) },
    '../auth/AuthProvider': { useAuth: () => ({ user: { id: 1 } }) },
    '../api/services': { queryClient: client },
    '../api/reminders': { reminderTypes: ['daily_task', 'streak_risk', 'review_due'], remindersAPI: {
      settings: async () => defaults,
      suggested: async () => ({ suggested_time: '18:30', sample_count: 4, timezone: defaults.timezone }),
      save: (value: unknown) => { saves++; payload = value; return new Promise(resolve => { finish = resolve }) },
    } },
    '../features/reminders/logic': { mobileSettings, validateReminderSettings },
    '../components/KeyboardLayout': { KeyboardInput: 'Input' },
    '../components/ui': { ...Object.fromEntries(['AppText', 'Button', 'Card', 'ErrorNotice', 'Loading', 'Muted', 'Screen', 'Title'].map(name => [name, name])), styles: {} },
    '../theme/ThemeProvider': { useTheme: () => ({ colors: {} }) },
    '../utils/getErrorMessage': { getErrorMessage: () => 'error' },
    '../utils/date': { formatTimestamp: (value: string) => value },
  })
  let renderer: ReactTestRenderer | undefined
  const input = () => renderer!.root.findAll(node => String(node.type) === 'Input').find(node => node.props.accessibilityLabel === t('reminders.time'))!
  const button = (title: string) => renderer!.root.findAll(node => String(node.type) === 'Button').find(node => node.props.title === title)!
  try {
    await act(async () => { renderer = create(React.createElement(QueryClientProvider, { client }, React.createElement(ReminderSettingsScreen))); await settle() })
    await act(settle)
    assert.equal(input().props.value, '20:00')
    await act(async () => input().props.onChangeText('17:00'))
    await act(async () => { client.setQueryData(['mobile-reminders', 1, 'settings'], { ...defaults, reminder_time: '19:00' }); await settle() })
    assert.equal(input().props.value, '17:00')
    await act(async () => button(t('reminders.apply')).props.onPress())
    assert.equal(input().props.value, '18:30'); assert.equal(saves, 0)
    const save = button(t('reminders.save')).props.onPress
    await act(async () => { save(); save() })
    assert.equal(saves, 1)
    assert.equal((payload as ReminderSettings).reminder_time, '18:30')
    assert.ok(!('push_enabled' in (payload as object))); assert.ok(!('snooze_until' in (payload as object)))
    await act(async () => { finish({ ...defaults, reminder_time: '18:30' }); await settle() })
    assert.ok(renderer!.root.findAll(node => String(node.type) === 'AppText').some(node => node.props.children === t('reminders.saved')))
  } finally { await act(async () => renderer?.unmount()); client.clear() }
})

test('opening a notification waits for mark-read, blocks rapid duplicate taps and keeps unknown links in the list', async () => {
  const i18n = await translator()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, cacheTime: 0 } } })
  let reads = 0, target = ''
  let finish: () => void = () => undefined
  let current = item
  const { NotificationsScreen } = loadComponent('../src/screens/NotificationsScreen.tsx', {
    'react-native': { Pressable: 'Pressable', View: 'View' },
    'expo-router': { router: { push: (value: string) => { target = value } }, useFocusEffect: React.useEffect },
    'react-i18next': { useTranslation: (ns: string) => ({ t: (key: string, options = {}) => i18n.t(key, { ns, ...options }), i18n }) },
    '../auth/AuthProvider': { useAuth: () => ({ user: { id: 1 } }) },
    '../api/services': { queryClient: client },
    '../api/reminders': { notificationsAPI: { list: async () => [current], read: () => { reads++; return new Promise<void>(resolve => { finish = resolve }) } } },
    '../features/reminders/NotificationProvider': { notificationKey: ['mobile-notifications'], useNotifications: () => ({ active: true, count: 1 }) },
    '../features/reminders/logic': { nextNotificationLimit, notificationCopy, notificationTarget, relativeNotificationTime },
    '../components/ui': { ...Object.fromEntries(['AppText', 'Button', 'Card', 'ErrorNotice', 'Loading', 'Muted', 'Screen', 'Title'].map(name => [name, name])), styles: {} },
    '../theme/ThemeProvider': { useTheme: () => ({ colors: {} }) },
    '../utils/getErrorMessage': { getErrorMessage: () => 'error' },
  })
  let renderer: ReactTestRenderer | undefined
  try {
    await act(async () => { renderer = create(React.createElement(QueryClientProvider, { client }, React.createElement(NotificationsScreen))); await settle() })
    await act(settle)
    const open = renderer!.root.find(node => String(node.type) === 'Pressable').props.onPress
    await act(async () => { open(); open() })
    assert.equal(reads, 1); assert.equal(target, '')
    await act(async () => { finish(); await settle() })
    assert.equal(target, '/(tabs)/daily')
    target = ''
    current = { ...item, url: '/unknown', read_at: '2026-11-19T01:00:00Z' }
    await act(async () => { await client.invalidateQueries(['mobile-notifications']); await settle() })
    await act(async () => { renderer!.root.find(node => String(node.type) === 'Pressable').props.onPress(); await settle() })
    assert.equal(target, ''); assert.equal(reads, 1)
  } finally { await act(async () => renderer?.unmount()); client.clear() }
})
