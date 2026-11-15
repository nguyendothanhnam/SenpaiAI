import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { themes, themeBackgrounds } from '../../frontend/src/themes/themes'
import { accountAppearance, activeImagePath, mergeCatalog, mobilePalette, nativeThemes } from '../src/features/shop/catalog'
import { ShopActions, ShopError, errorCode, type ShopTransport } from '../src/features/shop/actions'
import type { EquipPayload, ShopItemType, ShopSnapshot } from '../src/features/shop/types'
import { colorAlpha, imageOverlay } from '../src/theme/nativeStyle'
import { resources } from '../src/i18n/resources'

function seed(): ShopSnapshot {
  return { catalog: {
    themes: Object.keys(themes).map(id => ({ id, name: id, price: id === 'classic' ? 0 : 500, item_type: 'theme', owned: id === 'classic', equipped: id === 'classic' })),
    backgrounds: themeBackgrounds.map(bg => ({ id: bg.id, name: bg.id, image: bg.image, price: 150, item_type: 'background', owned: false, equipped: false })),
  }, profile: { points_balance: 1000, active_theme_id: 'classic', active_background_id: null, current_streak: 0, longest_streak: 0, last_completed_date: null, unlocked: { themes: ['classic'], backgrounds: [] } } }
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const matches = (code: string) => (error: unknown) => error instanceof ShopError && error.code === code
function harness() {
  const state = seed(), calls = { purchase: 0, equip: [] as EquipPayload[] }, published: ShopSnapshot[] = []
  const transport: ShopTransport = {
    snapshot: async () => clone(state),
    purchase: async (type, id) => {
      calls.purchase++
      const group = type === 'theme' ? 'themes' : 'backgrounds', item = state.catalog[group].find(item => item.id === id)!
      state.profile.points_balance -= item.price; item.owned = true; state.profile.unlocked[group].push(id)
      if (type === 'theme') state.profile.active_theme_id = id; else state.profile.active_background_id = id
      state.catalog[group].forEach(item => { item.equipped = item.id === id })
      return { points_balance: state.profile.points_balance, purchased: { item_type: type, item_id: id, price_paid: item.price, equipped: true } }
    },
    equip: async payload => {
      calls.equip.push(payload)
      if (payload.theme_id) state.profile.active_theme_id = payload.theme_id
      if ('background_id' in payload) state.profile.active_background_id = payload.background_id ?? null
      return { active_theme_id: state.profile.active_theme_id, active_background_id: state.profile.active_background_id }
    },
  }
  const actions = new ShopActions(transport, snapshot => published.push(clone(snapshot)))
  return { state, calls, transport, actions, published }
}
test('catalog preserves all server items, server prices and unsupported entries', () => {
  const data = seed().catalog
  data.themes.push({ id: 'future-theme', name: 'Future', price: 900, item_type: 'theme', owned: false, equipped: false })
  data.backgrounds.push({ id: 'future-background', name: 'Future', image: '/missing.webp', price: 123, item_type: 'background', owned: true, equipped: false })
  const rows = mergeCatalog(data, 'light', new Set(themeBackgrounds.map(bg => bg.image)))
  assert.equal(rows.length, 18)
  assert.equal(rows.find(row => row.item.id === 'than-khe')?.item.price, 500)
  assert.notEqual(rows.find(row => row.item.id === 'than-khe')?.item.price, themes['than-khe'].points)
  assert.equal(rows.find(row => row.item.id === 'future-theme')?.supported, false)
  assert.equal(rows.find(row => row.item.id === 'future-background')?.supported, false)
  assert.equal(rows.find(row => row.item.id === 'future-background')?.item.owned, true)
})
test('all native palettes use the shared definitions, including both modes and RGB conversion', () => {
  assert.equal(nativeThemes, themes)
  for (const id of Object.keys(themes)) for (const mode of ['light', 'dark'] as const) {
    const result = mobilePalette(id, mode)
    assert.equal(result.bg, themes[id].palettes[mode].bg)
    assert.equal(result.primary, themes[id].palettes[mode].primary)
    assert.match(result.cardGlass, /^rgba\(/)
    assert.equal(colorAlpha(result.bg, 0.86).endsWith(', 0.86)'), true)
  }
  assert.equal(mobilePalette('unknown', 'dark').bg, themes.classic.palettes.dark.bg)
})
test('account appearance accepts only owned selections and restores independent theme/background preferences', () => {
  const profile = seed().profile
  assert.deepEqual(accountAppearance(), { themeId: 'classic', backgroundId: null })
  profile.active_theme_id = 'sakura'; profile.active_background_id = 'fuji-reading'
  assert.deepEqual(accountAppearance(profile), { themeId: 'classic', backgroundId: null })
  profile.unlocked.themes.push('sakura'); profile.unlocked.backgrounds.push('fuji-reading')
  assert.deepEqual(accountAppearance(profile), { themeId: 'sakura', backgroundId: 'fuji-reading' })
  assert.equal(activeImagePath('sakura', null, 'dark'), themes.sakura.background.dark)
  assert.equal(activeImagePath('sakura', 'fuji-reading', 'dark'), themeBackgrounds[0].image)
})
test('background tint preserves at least 4.5 contrast for normal and muted text over image extremes', () => {
  const channels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
  const luminance = (rgb: number[]) => rgb.reduce((sum, n, i) => { const c = n / 255; return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i] }, 0)
  for (const theme of Object.values(themes)) for (const mode of ['light', 'dark'] as const) {
    const palette = theme.palettes[mode], overlay = imageOverlay(palette, mode)
    const alpha = Number(overlay.match(/, ([\d.]+)\)$/)?.[1] || 1)
    for (const image of [0, 127, 255]) for (const token of [palette.text, palette.textMuted]) {
      const a = luminance(channels(palette.bg).map(c => c * alpha + image * (1 - alpha))), b = luminance(channels(token))
      assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, theme.id + mode)
    }
  }
})
test('packaged WebP assets match the web bytes, cover every background and report missing mascots', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/THEME_ASSETS.json', import.meta.url), 'utf8')) as { assets: { path: string; missing?: boolean; bytes?: number }[]; packagedBytes: number }
  assert.equal(manifest.assets.filter(asset => !asset.missing).length, 13)
  assert.ok(manifest.packagedBytes < 1300000)
  for (const asset of manifest.assets.filter(asset => !asset.missing)) {
    const web = readFileSync(new URL(`../../frontend/public${asset.path}`, import.meta.url))
    const mobile = readFileSync(new URL(`../assets/themes/${asset.path.slice('/themes/'.length).replaceAll('/', '-')}`, import.meta.url))
    assert.equal(createHash('sha256').update(web).digest('hex'), createHash('sha256').update(mobile).digest('hex'))
  }
  const paths = new Set(manifest.assets.filter(asset => !asset.missing).map(asset => asset.path))
  const rows = mergeCatalog(seed().catalog, 'dark', paths)
  assert.ok(rows.every(row => row.supported))
  assert.equal(rows.find(row => row.item.id === 'sakura')?.mascotMissing, true)
})
test('catalog names and descriptions exist in both shared web languages', () => {
  for (const locale of [resources.vi.common, resources.en.common]) {
    for (const id of Object.keys(themes)) assert.ok((locale.themes as Record<string, { name: string; description: string }>)[id].description)
    for (const bg of themeBackgrounds) assert.ok((locale.backgrounds as Record<string, { name: string; description: string }>)[bg.id].name)
  }
})
test('purchase quotes show before/after amounts and apply the server-confirmed result immediately', async () => {
  const { actions, calls, published } = harness()
  const quote = await actions.quote('theme', 'sakura')
  assert.equal(quote.before, 1000); assert.equal(quote.after, 500); assert.equal(quote.item.price, 500)
  const result = await actions.buy(quote)
  assert.equal(calls.purchase, 1); assert.equal(result.profile.points_balance, 500)
  assert.equal(result.profile.active_theme_id, 'sakura'); assert.ok(result.profile.unlocked.themes.includes('sakura'))
  assert.equal(result.catalog.themes.find(item => item.id === 'sakura')?.equipped, true)
  assert.equal(published.at(-1)?.profile.active_theme_id, 'sakura')
})
test('rapid confirmation taps share one purchase request; an accepted quote cannot be submitted again', async () => {
  const { actions, transport, calls } = harness()
  const purchase = transport.purchase
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  transport.purchase = async (type, id) => { await gate; return purchase(type, id) }
  const quote = await actions.quote('theme', 'sakura'), a = actions.buy(quote), b = actions.buy(quote)
  assert.equal(a, b); release(); await a
  assert.equal(calls.purchase, 1)
  await assert.rejects(actions.buy(quote), matches('already_submitted'))
})
test('insufficient points, changed quotes and already owned items never post a purchase', async () => {
  const { actions, state, calls } = harness()
  state.profile.points_balance = 499
  await assert.rejects(actions.quote('theme', 'sakura'), error => matches('insufficient_points')(error) && (error as ShopError).values.missing === 1)
  state.profile.points_balance = 1000
  const quote = await actions.quote('theme', 'sakura')
  state.catalog.themes.find(item => item.id === 'sakura')!.price = 600
  await assert.rejects(actions.buy(quote), matches('quote_changed'))
  state.profile.points_balance = 300
  await assert.rejects(actions.buy(quote), error => matches('insufficient_points')(error) && (error as ShopError).values.missing === 300)
  await assert.rejects(actions.quote('theme', 'classic'), matches('already_owned'))
  assert.equal(calls.purchase, 0)
})
test('lost purchase response reconciles server ownership without issuing a second POST', async () => {
  const { actions, transport, calls } = harness(), purchase = transport.purchase
  transport.purchase = async (type, id) => { await purchase(type, id); throw new Error('connection lost after commit') }
  const quote = await actions.quote('theme', 'sakura'), result = await actions.buy(quote)
  assert.equal(calls.purchase, 1); assert.equal(result.profile.points_balance, 500)
  assert.equal(actions.hasUncertainPurchase, false)
})
test('unknown delivery remains locked and permits only read-only reconciliation', async () => {
  const { actions, transport } = harness()
  let calls = 0
  transport.purchase = async () => { calls++; throw new Error('timeout') }
  const quote = await actions.quote('theme', 'sakura')
  await assert.rejects(actions.buy(quote), matches('uncertain'))
  await actions.refresh()
  await assert.rejects(actions.quote('theme', 'sakura'), matches('uncertain'))
  await assert.rejects(actions.equip('theme', 'classic'), matches('uncertain'))
  assert.equal(calls, 1)
})
test('server already-owned and insufficient-points errors refresh authoritative data', async () => {
  for (const code of ['already_owned', 'insufficient_points']) {
    const { actions, transport, state, published } = harness()
    transport.purchase = async () => {
      if (code === 'already_owned') { state.profile.unlocked.themes.push('sakura'); state.catalog.themes.find(item => item.id === 'sakura')!.owned = true }
      else state.profile.points_balance = 100
      throw { response: { status: code === 'already_owned' ? 409 : 400, data: { detail: { code } } } }
    }
    const quote = await actions.quote('theme', 'sakura')
    await assert.rejects(actions.buy(quote), error => code === 'already_owned' ? errorCode(error) === code : matches(code)(error) && (error as ShopError).values.missing === 400)
    assert.equal(actions.hasUncertainPurchase, false)
    assert.equal(published.at(-1)?.profile.points_balance, state.profile.points_balance)
  }
})
test('owned themes/backgrounds equip through the correct payload and default background clears via null', async () => {
  const { actions, calls } = harness()
  await actions.buy(await actions.quote('background', 'fuji-reading'))
  const result = await actions.equip('background', 'fuji-reading')
  assert.equal(result.profile.active_background_id, 'fuji-reading')
  await actions.equip('theme', 'classic'); await actions.equip('background', null)
  assert.deepEqual(calls.equip, [{ background_id: 'fuji-reading' }, { theme_id: 'classic' }, { background_id: null }])
  await assert.rejects(actions.equip('theme', 'sakura'), matches('not_owned'))
})
test('a failed balance refresh after server rejection never invents a zero-point shortfall', async () => {
  const { actions, transport } = harness()
  const quote = await actions.quote('theme', 'sakura')
  transport.purchase = async () => {
    transport.snapshot = async () => { throw new Error('offline') }
    throw { response: { status: 400, data: { detail: { code: 'insufficient_points' } } } }
  }
  await assert.rejects(actions.buy(quote), matches('balance_unknown'))
})
test('network failures before purchase do not enter unknown-delivery mode or spend points', async () => {
  const { actions, transport, calls } = harness()
  transport.snapshot = async () => { throw new Error('offline') }
  await assert.rejects(actions.quote('theme', 'sakura'))
  assert.equal(calls.purchase, 0); assert.equal(actions.hasUncertainPurchase, false)
})
test('equip errors preserve the previous appearance rather than applying an optimistic theme', async () => {
  const { actions, transport, published } = harness()
  transport.equip = async () => { throw new Error('offline') }
  await assert.rejects(actions.equip('theme', 'classic'))
  assert.equal(published.at(-1)?.profile.active_theme_id, 'classic')
})
test('requests for another item cannot run concurrently with a pending purchase', async () => {
  const { actions, transport } = harness(), original = transport.purchase
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  transport.purchase = async (type: ShopItemType, id: string) => { await gate; return original(type, id) }
  const quote = await actions.quote('theme', 'sakura'), pending = actions.buy(quote)
  await assert.rejects(actions.equip('theme', 'classic'), matches('busy'))
  release(); await pending
})
