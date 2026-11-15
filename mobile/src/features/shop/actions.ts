import type { EquipPayload, Equipped, PurchaseResult, ShopItem, ShopItemType, ShopSnapshot } from './types'

export class ShopError extends Error {
  constructor(public code: string, public values: Record<string, string | number> = {}) { super(code) }
}
export interface Quote { id: number; item: ShopItem; before: number; after: number }
export interface ShopTransport {
  snapshot(): Promise<ShopSnapshot>
  purchase(type: ShopItemType, id: string): Promise<PurchaseResult>
  equip(payload: EquipPayload): Promise<Equipped>
}
export function errorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: { code?: string } } } })?.response?.data?.detail?.code
}
function itemFrom(snapshot: ShopSnapshot, type: ShopItemType, id: string) {
  const item = (type === 'theme' ? snapshot.catalog.themes : snapshot.catalog.backgrounds).find(item => item.id === id)
  if (!item) throw new ShopError('item_not_found')
  return { ...item, item_type: type }
}
function owned(snapshot: ShopSnapshot, item: ShopItem) {
  return item.owned || (item.item_type === 'theme' ? snapshot.profile.unlocked.themes : snapshot.profile.unlocked.backgrounds).includes(item.id)
}
function apply(snapshot: ShopSnapshot, equipped: Equipped): ShopSnapshot {
  return { profile: { ...snapshot.profile, ...equipped }, catalog: {
    themes: snapshot.catalog.themes.map(item => ({ ...item, equipped: item.id === equipped.active_theme_id })),
    backgrounds: snapshot.catalog.backgrounds.map(item => ({ ...item, equipped: item.id === equipped.active_background_id })),
  } }
}
/** One mutation in flight, one POST per accepted quote; never retry an unknown
 * purchase delivery automatically. All balances/prices come from the server. */
export class ShopActions {
  private serial = 0
  private pending: { key: string; task: Promise<ShopSnapshot> } | undefined
  private used = new Set<number>()
  private uncertain: ShopItem | undefined
  constructor(private transport: ShopTransport, private publish: (snapshot: ShopSnapshot) => void = () => undefined) {}
  get hasUncertainPurchase() { return !!this.uncertain }
  async refresh() {
    const snapshot = await this.transport.snapshot()
    if (this.uncertain && owned(snapshot, itemFrom(snapshot, this.uncertain.item_type, this.uncertain.id))) this.uncertain = undefined
    this.publish(snapshot)
    return snapshot
  }
  async quote(type: ShopItemType, id: string): Promise<Quote> {
    if (this.uncertain) throw new ShopError('uncertain')
    const snapshot = await this.refresh(), item = itemFrom(snapshot, type, id)
    if (owned(snapshot, item)) throw new ShopError('already_owned')
    const missing = Math.max(0, item.price - snapshot.profile.points_balance)
    if (missing) throw new ShopError('insufficient_points', { missing })
    return { id: ++this.serial, item, before: snapshot.profile.points_balance, after: snapshot.profile.points_balance - item.price }
  }
  private exclusive(key: string, action: () => Promise<ShopSnapshot>) {
    if (this.pending) return this.pending.key === key ? this.pending.task : Promise.reject(new ShopError('busy'))
    if (this.uncertain) return Promise.reject(new ShopError('uncertain'))
    const task = action()
    this.pending = { key, task }
    void task.finally(() => { if (this.pending?.task === task) this.pending = undefined }).catch(() => undefined)
    return task
  }
  buy(quote: Quote): Promise<ShopSnapshot> {
    return this.exclusive(`buy:${quote.id}`, async () => {
      if (this.used.has(quote.id)) throw new ShopError('already_submitted')
      let snapshot = await this.refresh()
      const item = itemFrom(snapshot, quote.item.item_type, quote.item.id)
      if (owned(snapshot, item)) throw new ShopError('already_owned')
      const missing = Math.max(0, item.price - snapshot.profile.points_balance)
      if (missing) throw new ShopError('insufficient_points', { missing })
      if (item.price !== quote.item.price || snapshot.profile.points_balance !== quote.before) throw new ShopError('quote_changed')
      this.used.add(quote.id)
      let result: PurchaseResult
      try { result = await this.transport.purchase(item.item_type, item.id) }
      catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (!status || status >= 500 || status === 408) this.uncertain = item
        let refreshed = false
        try { snapshot = await this.refresh(); refreshed = true } catch { /* Keep the unknown delivery locked. */ }
        if (this.uncertain) throw new ShopError('uncertain')
        if ((!status || status >= 500 || status === 408) && owned(snapshot, item)) return snapshot
        if (errorCode(error) === 'insufficient_points') {
          const missing = refreshed ? Math.max(0, itemFrom(snapshot, item.item_type, item.id).price - snapshot.profile.points_balance) : 0
          if (!missing) throw new ShopError('balance_unknown')
          throw new ShopError('insufficient_points', { missing })
        }
        throw error
      }
      const group = item.item_type === 'theme' ? 'themes' : 'backgrounds'
      const profile = { ...snapshot.profile, points_balance: result.points_balance, unlocked: { ...snapshot.profile.unlocked, [group]: [...new Set([...snapshot.profile.unlocked[group], item.id])] } }
      snapshot = { profile, catalog: { ...snapshot.catalog, [group]: snapshot.catalog[group].map(entry => entry.id === item.id ? { ...entry, owned: true } : entry) } }
      if (result.purchased.equipped) snapshot = apply(snapshot, { active_theme_id: item.item_type === 'theme' ? item.id : profile.active_theme_id, active_background_id: item.item_type === 'background' ? item.id : profile.active_background_id })
      this.publish(snapshot)
      return snapshot
    })
  }
  equip(type: ShopItemType, id: string | null): Promise<ShopSnapshot> {
    return this.exclusive(`equip:${type}:${id}`, async () => {
      let snapshot = await this.refresh()
      if (id !== null) { const item = itemFrom(snapshot, type, id); if (!owned(snapshot, item)) throw new ShopError('not_owned') }
      const result = await this.transport.equip(type === 'theme' ? { theme_id: id! } : { background_id: id })
      snapshot = apply(snapshot, result); this.publish(snapshot); return snapshot
    })
  }
}
