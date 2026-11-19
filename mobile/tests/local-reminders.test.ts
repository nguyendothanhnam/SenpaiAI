import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLocalPlan, isQuiet, localDate, localTime, wallTimeToInstant, localResponseTarget, LOCAL_OWNER, type LocalPlanItem, type ReminderSnapshot } from '../src/features/reminders/planner'
import { emptyLedger, LocalReminderController, localReminderLifecycle, parseLedger, type LocalReminderIO, type ReminderLedger, type LocalScheduleState } from '../src/features/reminders/LocalReminderController'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createInstance } from 'i18next'
import { resources } from '../src/i18n/resources'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

const snapshot: ReminderSnapshot = {
  userId: 1, language: 'vi', streak: 5, completedToday: false, allowed: true,
  settings: { enabled: true, timezone: 'Asia/Ho_Chi_Minh', reminder_time: '20:00', days_of_week: [0, 1, 2, 3, 4, 5, 6], types: ['daily_task', 'streak_risk', 'review_due'], quiet_start: '22:00', quiet_end: '07:00', max_per_day: 3, push_enabled: true, snooze_until: null },
}
const now = Date.parse('2026-11-19T10:00:00Z') // Thursday, 17:00 in Vietnam.
const settings = (patch: Partial<ReminderSnapshot['settings']>): ReminderSnapshot => ({ ...snapshot, settings: { ...snapshot.settings, ...patch } })
test('7 local calendar days use one-off instants, selected weekdays and at most two supported local kinds', () => {
  const plan = buildLocalPlan(snapshot, now)
  assert.equal(plan.length, 14)
  assert.equal(plan[0].at, Date.parse('2026-11-19T13:00:00Z'))
  assert.equal(plan[1].at, Date.parse('2026-11-19T14:00:00Z'))
  assert.equal(plan.at(-1)?.date, '2026-11-25')
  assert.equal(new Set(plan.map(p => p.id)).size, plan.length)
  assert.ok(plan.every(p => p.kind !== ('review_due' as string)))
  assert.deepEqual(buildLocalPlan(settings({ days_of_week: [0] }), now).map(p => p.date), ['2026-11-23', '2026-11-23'])
  assert.deepEqual(buildLocalPlan(settings({ days_of_week: [6] }), now).map(p => p.date), ['2026-11-22', '2026-11-22'])
})
test('timezone conversion is independent of device time, including UTC+14 and half-hour zones', () => {
  assert.equal(wallTimeToInstant('2026-11-19', '20:00', 'Asia/Ho_Chi_Minh'), Date.parse('2026-11-19T13:00:00Z'))
  assert.equal(wallTimeToInstant('2026-11-19', '00:15', 'Pacific/Kiritimati'), Date.parse('2026-11-18T10:15:00Z'))
  assert.equal(wallTimeToInstant('2026-11-19', '20:00', 'Asia/Kolkata'), Date.parse('2026-11-19T14:30:00Z'))
  assert.equal(localDate(now, 'Pacific/Kiritimati'), '2026-11-20')
  const plan = buildLocalPlan(settings({ timezone: 'Pacific/Kiritimati', reminder_time: '01:00', quiet_start: '02:00', quiet_end: '00:00' }), now)
  assert.equal(plan[0].date, '2026-11-20'); assert.equal(plan[0].at, Date.parse('2026-11-19T11:00:00Z'))
})
test('New York DST gap is skipped and the fold uses only the first occurrence', () => {
  assert.equal(wallTimeToInstant('2026-03-08', '02:30', 'America/New_York'), null)
  assert.equal(wallTimeToInstant('2026-03-08', '03:30', 'America/New_York'), Date.parse('2026-03-08T07:30:00Z'))
  assert.equal(wallTimeToInstant('2026-11-01', '01:30', 'America/New_York'), Date.parse('2026-11-01T05:30:00Z'))
  const folded = buildLocalPlan(settings({ timezone: 'America/New_York', reminder_time: '01:30', quiet_start: '03:00', quiet_end: '00:00', types: ['daily_task'] }), Date.parse('2026-11-01T05:45:00Z'))
  assert.ok(folded.every(p => p.date !== '2026-11-01'))
})
test('European and non-hour DST changes preserve local wall times and daily boundaries', () => {
  assert.equal(wallTimeToInstant('2026-03-29', '02:15', 'Europe/Berlin'), null)
  assert.equal(wallTimeToInstant('2026-10-25', '02:15', 'Europe/Berlin'), Date.parse('2026-10-25T00:15:00Z'))
  assert.equal(wallTimeToInstant('2026-10-04', '02:15', 'Australia/Lord_Howe'), null)
  assert.equal(wallTimeToInstant('2026-04-05', '01:45', 'Australia/Lord_Howe'), Date.parse('2026-04-04T14:45:00Z'))
  const plan = buildLocalPlan(settings({ timezone: 'America/New_York' }), Date.parse('2026-03-07T12:00:00Z'))
  const daily = plan.filter(p => p.kind === 'daily_task')
  assert.equal(daily[1].at - daily[0].at, 23 * 3600000)
  assert.ok(daily.every(p => localTime(p.at, 'America/New_York') === '20:00'))
})
test('quiet hours include start, exclude end, span midnight, and equal bounds mean all day', () => {
  assert.equal(isQuiet('22:00', '22:00', '07:00'), true)
  assert.equal(isQuiet('06:59', '22:00', '07:00'), true)
  assert.equal(isQuiet('07:00', '22:00', '07:00'), false)
  assert.equal(isQuiet('12:00', '10:00', '14:00'), true)
  assert.equal(isQuiet('14:00', '10:00', '14:00'), false)
  assert.equal(buildLocalPlan(settings({ quiet_start: '07:00', quiet_end: '07:00' }), now).length, 0)
  assert.equal(buildLocalPlan(settings({ quiet_start: '19:00', quiet_end: '22:00' }), now).length, 0)
})
test('disabled, denied, review-only, empty days/types and zero streak cannot produce inappropriate alerts', () => {
  for (const value of [settings({ enabled: false }), { ...snapshot, allowed: false }, settings({ types: ['review_due'] }), settings({ types: [] }), settings({ days_of_week: [] })]) assert.deepEqual(buildLocalPlan(value, now), [])
  assert.ok(buildLocalPlan({ ...snapshot, streak: 1 }, now).every(p => p.kind === 'daily_task'))
  assert.ok(buildLocalPlan({ ...snapshot, streak: 2 }, now).some(p => p.kind === 'streak_risk'))
})
test('daily caps, spent reservations and coincident reminders prevent duplicate or catch-up alerts', () => {
  const one = buildLocalPlan(settings({ max_per_day: 1 }), now)
  assert.equal(one.length, 7)
  assert.ok(one.every(p => p.kind === 'daily_task'))
  assert.equal(buildLocalPlan(settings({ reminder_time: '21:00' }), now).length, 7)
  const spent = [{ ...one[0], spent: true }]
  const later = Date.parse('2026-11-19T13:30:00Z')
  assert.ok(buildLocalPlan(settings({ max_per_day: 1 }), later, spent).every(p => p.date !== '2026-11-19'))
  const changedTime = buildLocalPlan(settings({ reminder_time: '20:45', max_per_day: 2 }), later, spent)
  assert.ok(changedTime.filter(p => p.date === '2026-11-19').every(p => p.kind === 'streak_risk'))
  assert.ok(buildLocalPlan(snapshot, Date.parse('2026-11-19T14:01:00Z')).every(p => p.date !== '2026-11-19'))
})
test('snooze uses its offset; completed dates only suppress their own local date across midnight', () => {
  const snoozed = buildLocalPlan(settings({ snooze_until: '2026-11-20T20:30:00+07:00' }), now)
  assert.equal(snoozed[0].kind, 'streak_risk'); assert.equal(snoozed[0].date, '2026-11-20')
  const done = { ...snapshot, completedToday: true, observedAt: now }
  assert.ok(buildLocalPlan(done, now).every(p => p.date !== '2026-11-19'))
  const tomorrow = buildLocalPlan(done, Date.parse('2026-11-19T18:00:00Z'), [], [now])
  assert.equal(tomorrow[0].date, '2026-11-20')
})
test('local response routes are scoped to the authenticated account and never use arbitrary URLs', () => {
  const data = { owner: LOCAL_OWNER, userId: 1, kind: 'daily_task', date: '2026-11-19', at: now }
  assert.equal(localResponseTarget(data, 1), '/(tabs)/daily')
  for (const value of [{ ...data, owner: 'other' }, { ...data, kind: 'review_due' }, { ...data, userId: 2 }, { ...data, at: NaN }, null, { url: 'https://example.com' }]) assert.equal(localResponseTarget(value, 1), null)
  assert.equal(localResponseTarget(data, null), null)
})

function rig() {
  let clock = now, cancellations = 0, scheduleCalls = 0
  const saved = new Map<number, ReminderLedger>()
  const pending = new Map<string, LocalPlanItem>()
  const states: LocalScheduleState[] = []
  const io: LocalReminderIO = {
    now: () => clock,
    read: async uid => structuredClone(saved.get(uid) ?? emptyLedger()),
    write: async (uid, value) => { saved.set(uid, structuredClone(value)) },
    cancel: async () => { cancellations++; pending.clear() },
    schedule: async item => { scheduleCalls++; pending.set(item.id, item) },
    state: value => states.push(value),
  }
  const controller = new LocalReminderController(io)
  return { controller, io, saved, pending, states, get cancellations() { return cancellations }, get scheduleCalls() { return scheduleCalls }, set clock(value: number) { clock = value } }
}
test('rebuilds replace the native window; due reservations survive process death and enforce caps', async () => {
  const r = rig(), s = settings({ max_per_day: 1 })
  await r.controller.replace(s)
  await r.controller.replace({ ...s, language: 'en' })
  assert.equal(r.pending.size, 7)
  assert.equal(new Set([...r.pending.keys()]).size, 7)
  r.clock = Date.parse('2026-11-19T13:30:00Z')
  const restarted = new LocalReminderController(r.io)
  await restarted.replace({ ...s, settings: { ...s.settings, reminder_time: '20:45' } })
  assert.ok([...r.pending.values()].every(p => p.date !== '2026-11-19'))
  assert.equal(r.saved.get(1)?.entries.filter(e => e.spent).length, 1)
})
test('completion cancels both reminders today, persists cancellation across restart, and retains later dates', async () => {
  const r = rig()
  await r.controller.replace(snapshot)
  await r.controller.complete(1, 6)
  assert.equal(r.pending.size, 12)
  assert.ok([...r.pending.values()].every(p => p.date !== '2026-11-19'))
  const restarted = new LocalReminderController(r.io)
  await restarted.replace(snapshot) // Even a stale API snapshot cannot undo a persisted completion.
  assert.ok([...r.pending.values()].every(p => p.date !== '2026-11-19'))
  await restarted.replace(null)
  assert.equal(r.pending.size, 0)
  const remote = rig()
  await remote.controller.replace({ ...snapshot, completedToday: true, observedAt: now })
  await new LocalReminderController(remote.io).replace(snapshot)
  assert.ok([...remote.pending.values()].every(p => p.date !== '2026-11-19'))
})
test('logout wins against an in-flight schedule, and account switching never retains the previous account', async () => {
  const r = rig()
  let started: () => void = () => undefined, release: () => void = () => undefined
  const entered = new Promise<void>(resolve => { started = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  r.io.schedule = async item => { started(); await gate; r.pending.set(item.id, item) }
  const first = r.controller.replace(snapshot)
  await entered
  const logout = r.controller.replace(null)
  release()
  await Promise.all([first, logout])
  assert.equal(r.pending.size, 0)
  r.io.schedule = async item => { r.pending.set(item.id, item) }
  await r.controller.replace({ ...snapshot, userId: 2 })
  assert.ok([...r.pending.keys()].every(id => id.startsWith(`${LOCAL_OWNER}.2.`)))
})
test('disabled and permission changes cancel all pending reminders without scheduling replacements', async () => {
  const r = rig()
  await r.controller.replace(snapshot)
  await r.controller.replace(settings({ enabled: false }))
  assert.equal(r.pending.size, 0)
  await r.controller.replace(snapshot)
  await r.controller.replace({ ...snapshot, allowed: false })
  assert.equal(r.pending.size, 0)
})
test('native schedule, cancel, storage and corrupt-ledger failures fail closed and remain retryable', async () => {
  const r = rig()
  const schedule = r.io.schedule
  let calls = 0
  r.io.schedule = async (item, s) => { if (++calls === 2) throw new Error('OS error'); await schedule(item, s) }
  await assert.rejects(r.controller.replace(snapshot))
  assert.equal(r.pending.size, 0); assert.equal(r.states.at(-1)?.status, 'error')
  r.io.schedule = schedule
  await r.controller.replace(snapshot)
  assert.equal(r.pending.size, 14)
  const cancel = r.io.cancel
  r.io.cancel = async () => { throw new Error('cancel failed') }
  const before = r.scheduleCalls
  await assert.rejects(r.controller.replace(snapshot)); assert.equal(r.scheduleCalls, before)
  r.io.cancel = cancel
  r.io.write = async () => { throw new Error('storage full') }
  await assert.rejects(r.controller.replace(snapshot)); assert.equal(r.pending.size, 0)
  assert.throws(() => parseLedger('{broken'))
  assert.throws(() => parseLedger(JSON.stringify({ ...emptyLedger(), version: 2 })))
  assert.throws(() => parseLedger(JSON.stringify({ ...emptyLedger(), entries: [{ at: 1 }] })))
})
test('completion cancellation runs before storage failures and an invalidated rebuild cannot reinstall old language', async () => {
  const r = rig()
  await r.controller.replace(snapshot)
  r.io.read = async () => { throw new Error('storage unavailable') }
  await assert.rejects(r.controller.complete(1, 6))
  assert.equal(r.pending.size, 0)
  const healthy = rig()
  const old = healthy.controller.replace(snapshot)
  healthy.controller.invalidate()
  await old
  assert.equal(healthy.pending.size, 0)
  await healthy.controller.replace({ ...snapshot, language: 'en' })
  assert.equal(healthy.pending.size, 14)
})
test('foreground delivery is compact, consumed once, and suppressed for completed days, quiet hours and stale events', async () => {
  const r = rig()
  await r.controller.replace(snapshot)
  const p = [...r.pending.values()][0]
  const data = { owner: LOCAL_OWNER, userId: 1, kind: p.kind, date: p.date, at: p.at }
  r.clock = p.at
  assert.equal(await r.controller.present(data, p.id), true)
  assert.equal(await r.controller.present(data, p.id), false)
  await r.controller.complete(1, 6)
  assert.equal(await r.controller.present(data, p.id), false)
  r.clock = Date.parse('2026-11-19T15:00:00Z')
  assert.equal(await r.controller.present(data, p.id), false)
  assert.equal(await r.controller.present({ ...data, userId: 2 }, p.id), false)
})

const require = createRequire(import.meta.url)
function loadNative(mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL('../src/features/reminders/localNotifications.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  const module = { exports: {} as typeof import('../src/features/reminders/localNotifications') }
  new Function('require', 'module', 'exports', code)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}
test('Expo adapter only requests permission explicitly, creates Android channel first and uses one-off localized dates', async () => {
  const i18n = createInstance()
  await i18n.init({ resources, lng: 'vi', defaultNS: 'common' })
  const events: string[] = [], stored = new Map<string, string>(), requests: Record<string, unknown>[] = []
  const native = {
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4, DENIED: 1 },
    AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: () => { events.push('handler') },
    getPermissionsAsync: async () => { events.push('check'); return { status: 'undetermined', granted: false, canAskAgain: true } },
    requestPermissionsAsync: async () => { events.push('request'); return { status: 'granted', granted: true } },
    setNotificationChannelAsync: async () => { events.push('channel') },
    scheduleNotificationAsync: async (value: Record<string, unknown>) => { requests.push(value); return String(value.identifier) },
  }
  const adapter = loadNative({
    '@react-native-async-storage/async-storage': { getItem: async (key: string) => stored.get(key) ?? null, setItem: async (key: string, value: string) => { stored.set(key, value) } },
    'react-native': { Platform: { OS: 'android' } }, 'expo-notifications': native,
    '../../i18n': { i18n }, './planner': { LOCAL_OWNER }, './LocalReminderController': { parseLedger },
  })
  await adapter.readPermission()
  assert.deepEqual(events, ['handler', 'check'])
  assert.equal(await adapter.hasLocalConsent(1), false)
  assert.equal(await adapter.requestLocalPermission(1, 'vi'), 'granted')
  assert.deepEqual(events.slice(2), ['channel', 'check', 'request'])
  assert.equal(await adapter.hasLocalConsent(1), true)
  const plan = buildLocalPlan(snapshot, now)
  await adapter.createLocalIO(() => undefined).schedule(plan[0], { ...snapshot, language: 'en' })
  const trigger = requests[0].trigger as { type: string; date: Date; repeats?: boolean }
  assert.equal(trigger.type, 'date'); assert.equal(trigger.date.getTime(), plan[0].at); assert.equal(trigger.repeats, undefined)
  assert.equal((requests[0].content as { title: string }).title, resources.en.mobile.localReminders.copy.daily_task.title)
  assert.equal(adapter.permissionFrom({ ios: { status: 3 } } as Parameters<typeof adapter.permissionFrom>[0]), 'provisional')
  assert.equal(adapter.permissionFrom({ ios: { status: 1 } } as Parameters<typeof adapter.permissionFrom>[0]), 'denied')
})

test('Android blocked channels are denied and iOS denied permission is never requested again automatically', async () => {
  let requests = 0
  const platform = { OS: 'android' }
  const native = {
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4, DENIED: 1 }, AndroidImportance: { NONE: 0 },
    setNotificationHandler: () => undefined,
    getPermissionsAsync: async () => ({ status: 'granted', granted: true, canAskAgain: false }),
    getNotificationChannelAsync: async () => ({ importance: 0 }),
    requestPermissionsAsync: async () => { requests++; return { status: 'granted', granted: true, canAskAgain: true } },
  }
  const adapter = loadNative({
    '@react-native-async-storage/async-storage': { setItem: async () => undefined },
    'react-native': { Platform: platform }, 'expo-notifications': native,
    '../../i18n': { i18n: {} }, './planner': { LOCAL_OWNER }, './LocalReminderController': { parseLedger },
  })
  assert.equal(await adapter.readPermission(), 'denied')
  platform.OS = 'ios'
  native.getPermissionsAsync = async () => ({ status: 'denied', granted: false, canAskAgain: false })
  assert.equal(await adapter.requestLocalPermission(1, 'vi'), 'denied')
  assert.equal(requests, 0)
})

test('provider never prompts at startup, handles denial/settings recovery and cold/warm taps, and clears on logout', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const r = rig()
  const i18n = createInstance()
  await i18n.init({ resources, lng: 'vi', defaultNS: 'common' })
  let status = 'loading', uid: number | undefined, permission: 'undetermined' | 'denied' | 'granted' = 'undetermined'
  let consent = false, prompts = 0, pushes = 0, responseCleared = 0
  let response: unknown = { notification: { request: { identifier: 'cold', content: { data: { owner: LOCAL_OWNER, userId: 1, date: '2026-11-19', kind: 'daily_task', at: now } } } }, actionIdentifier: 'default' }
  let received: (notification: unknown) => void = () => undefined
  let tapped: (value: unknown) => void = () => undefined
  const code = ts.transpileModule(readFileSync(new URL('../src/features/reminders/LocalReminderProvider.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const mocks: Record<string, unknown> = {
    'react-native': { View: 'View', AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) } },
    'expo-notifications': {
      getLastNotificationResponse: () => response,
      clearLastNotificationResponse: () => { response = null; responseCleared++ },
      addNotificationReceivedListener: (callback: typeof received) => { received = callback; return { remove: () => undefined } },
      addNotificationResponseReceivedListener: (callback: typeof tapped) => { tapped = callback; return { remove: () => undefined } },
    },
    'expo-router': { router: { push: () => { pushes++ } }, useRootNavigationState: () => ({ key: 'ready' }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    'react-i18next': { useTranslation: () => ({ t: (key: string) => i18n.t(key, { ns: 'mobile' }) }) },
    '../../auth/AuthProvider': { useAuth: () => ({ status, user: uid ? { id: uid } : null }) },
    '../../i18n/LanguageProvider': { useLanguage: () => ({ language: 'vi', ready: true }) },
    '../../api/reminders': { remindersAPI: { settings: async () => snapshot.settings } },
    '../../api/services': { dailyAPI: { today: async () => ({ status: 'in_progress' }) }, rewardsAPI: { me: async () => ({ current_streak: 5 }) } },
    '../../components/ui': Object.fromEntries(['AppText', 'Button', 'Card'].map(name => [name, name])),
    './LocalReminderController': { LocalReminderController, localReminderLifecycle },
    './planner': { localReminderData: (value: unknown) => value, localResponseTarget },
    './localNotifications': {
      createLocalIO: (state: LocalReminderIO['state']) => ({ ...r.io, state }),
      ensureLocalChannel: async () => undefined,
      hasLocalConsent: async () => consent,
      readPermission: async () => permission,
      permitted: (value: string) => value === 'granted',
      requestLocalPermission: async () => { prompts++; consent = true; permission = 'denied' },
      localNotificationCopy: () => ({ title: 'title', body: 'body' }),
    },
  }
  const module = { exports: {} as typeof import('../src/features/reminders/LocalReminderProvider') }
  new Function('require', 'module', 'exports', code)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  let context: ReturnType<typeof module.exports.useLocalReminders> | undefined
  function Probe() { context = module.exports.useLocalReminders(); return null }
  let renderer: ReactTestRenderer | undefined
  const render = () => React.createElement(module.exports.LocalReminderProvider, null, React.createElement(Probe))
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, 25)) }
  try {
    await act(async () => { renderer = create(render()); await settle() })
    assert.equal(prompts, 0); assert.equal(pushes, 0)
    status = 'authenticated'; uid = 1
    const cold = response
    await act(async () => { renderer!.update(render()); await settle() })
    assert.equal(prompts, 0); assert.equal(r.pending.size, 0)
    assert.equal(pushes, 1); assert.equal(responseCleared, 1)
    await act(async () => { tapped(cold); await settle() })
    assert.equal(pushes, 1)
    await act(async () => { await context!.enable(); await settle() })
    assert.equal(prompts, 1); assert.equal(context!.permission, 'denied'); assert.equal(r.pending.size, 0)
    permission = 'granted'
    await act(async () => { await context!.refresh(); await settle() })
    assert.equal(r.pending.size, 14)
    const p = [...r.pending.values()][0]; r.clock = p.at
    await act(async () => { received({ request: { identifier: p.id, content: { data: { owner: LOCAL_OWNER, userId: 1, date: p.date, kind: p.kind, at: p.at } } } }); await settle() })
    assert.ok(renderer!.root.findAll(node => String(node.type) === 'Card').length > 0)
    await act(async () => { await localReminderLifecycle.complete(1, 6); await settle() })
    assert.ok([...r.pending.values()].every(p => p.date !== '2026-11-19'))
    await act(async () => { await localReminderLifecycle.clear(); await settle() })
    assert.equal(r.pending.size, 0)
    status = 'anonymous'; uid = undefined
    await act(async () => { renderer!.update(render()); await settle() })
    assert.equal(r.pending.size, 0)
  } finally { await act(async () => renderer?.unmount()) }
})
