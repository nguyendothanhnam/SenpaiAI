import { accountStorageKey, parseStats, recordStats, type StatStore } from '@games/stats'
import type { Session } from '@games/types'
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export class GameStore {
  private locks = new Map<string, Promise<unknown>>()
  constructor(private storage: Storage) {}
  async read(account: string): Promise<StatStore> {
    if (!account.trim()) throw new Error('unauthorized')
    const raw = await this.storage.getItem(accountStorageKey(account))
    if (raw !== null) {
      if (raw.length > 512_000) throw new Error('storage_corrupt')
      // Preserve corrupt/future data rather than silently overwriting existing records.
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('entries' in parsed) || JSON.stringify(parseStats(raw).entries) !== JSON.stringify(parsed.entries)) throw new Error('storage_corrupt')
    }
    return parseStats(raw)
  }
  record(account: string, key: string, session: Session): Promise<StatStore> {
    const previous = this.locks.get(account) || Promise.resolve()
    const next = previous.catch(() => undefined).then(async () => {
      const current = await this.read(account), updated = recordStats(current, key, session)
      if (updated !== current) await this.storage.setItem(accountStorageKey(account), JSON.stringify(updated))
      return updated
    })
    this.locks.set(account, next)
    void next.finally(() => { if (this.locks.get(account) === next) this.locks.delete(account) }).catch(() => undefined)
    return next
  }
}
