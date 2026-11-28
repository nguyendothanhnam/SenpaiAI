import { buildLocalPlan, isQuiet, localDate, localReminderData, localTime, type LocalPlanItem, type ReminderSnapshot, type Reservation } from './planner'

export interface ReminderLedger { version: 1; entries: Reservation[]; completedAt: number[]; presented: string[] }
export type LocalScheduleState = { status: 'idle' | 'syncing' | 'scheduled' | 'disabled' | 'permission' | 'error'; count: number }
export interface LocalReminderIO {
  now: () => number
  read: (userId: number) => Promise<ReminderLedger>
  write: (userId: number, ledger: ReminderLedger) => Promise<void>
  cancel: () => Promise<void>
  schedule: (item: LocalPlanItem, snapshot: ReminderSnapshot) => Promise<void>
  state: (state: LocalScheduleState) => void
}
export const emptyLedger = (): ReminderLedger => ({ version: 1, entries: [], completedAt: [], presented: [] })
export function parseLedger(raw: string | null): ReminderLedger {
  if (!raw) return emptyLedger()
  const value = JSON.parse(raw) as ReminderLedger
  if (value.version !== 1 || !Array.isArray(value.entries) || !Array.isArray(value.completedAt) || !Array.isArray(value.presented)
    || value.entries.some(e => typeof e.id !== 'string' || !Number.isFinite(e.at) || typeof e.spent !== 'boolean' || !['daily_task', 'streak_risk'].includes(e.kind))
    || value.completedAt.some(at => !Number.isFinite(at)) || value.presented.some(id => typeof id !== 'string')) throw new Error('Invalid local reminder ledger')
  return value
}
/** Every native/storage mutation shares one queue. A newer request invalidates work
 * already in flight, including a schedule call resolving after logout. */
export class LocalReminderController {
  private revision = 0
  private queue: Promise<unknown> = Promise.resolve()
  private desired: ReminderSnapshot | null = null
  constructor(private io: LocalReminderIO) {}
  invalidate() { this.revision++ }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation)
    this.queue = next.catch(() => undefined)
    return next
  }
  replace(snapshot: ReminderSnapshot | null) {
    this.desired = snapshot
    const revision = ++this.revision
    return this.enqueue(() => this.reconcile(snapshot, revision))
  }
  private async reconcile(snapshot: ReminderSnapshot | null, revision: number) {
    if (revision !== this.revision) return
    this.io.state({ status: 'syncing', count: 0 })
    try {
      await this.io.cancel()
      if (revision !== this.revision) return
      if (!snapshot || !snapshot.settings.enabled || !snapshot.allowed) {
        this.io.state({ status: !snapshot || !snapshot.settings.enabled ? 'disabled' : 'permission', count: 0 }); return
      }
      const now = this.io.now()
      const ledger = await this.io.read(snapshot.userId)
      if (revision !== this.revision) return
      // A due reservation is conservatively spent even if the OS did not display it.
      // This survives process death and avoids replaying a delivered alert after rebuild.
      ledger.entries = ledger.entries.filter(e => (e.spent || e.at <= now) && e.at >= now - 35 * 86400000).map(e => ({ ...e, spent: true }))
      ledger.completedAt = ledger.completedAt.filter(at => at >= now - 35 * 86400000)
      const observed = snapshot.observedAt ?? now
      if (snapshot.completedToday && !ledger.completedAt.some(at => localDate(at, snapshot.settings.timezone) === localDate(observed, snapshot.settings.timezone))) ledger.completedAt.push(observed)
      const plan = buildLocalPlan(snapshot, now, ledger.entries, ledger.completedAt)
      ledger.entries.push(...plan.map(item => ({ id: item.id, at: item.at, kind: item.kind, spent: false })))
      ledger.presented = ledger.presented.filter(id => ledger.entries.some(e => e.id === id))
      // Reserve BEFORE asking the OS. A crash/failure may skip an alert, never replay it.
      await this.io.write(snapshot.userId, ledger)
      if (revision !== this.revision) return
      for (const item of plan) {
        if (item.at <= this.io.now()) continue // Never turn an expired trigger into an immediate alert.
        await this.io.schedule(item, snapshot)
        if (revision !== this.revision) { await this.io.cancel(); return }
      }
      this.io.state({ status: 'scheduled', count: plan.length })
    } catch (error) {
      // A partially installed plan must not survive and combine with a later retry.
      try { await this.io.cancel() } catch { /* Report the original failure; retry will cancel first. */ }
      if (revision === this.revision) this.io.state({ status: 'error', count: 0 })
      throw error
    }
  }
  complete(userId: number, streak: number) {
    const at = this.io.now()
    if (this.desired && this.desired.userId !== userId) return Promise.resolve()
    const snapshot = this.desired ? { ...this.desired, completedToday: true, observedAt: at, streak } : null
    this.desired = snapshot
    const revision = ++this.revision
    return this.enqueue(async () => {
      // Cancel first, even if persisting the completion marker fails.
      try {
        await this.io.cancel()
        const ledger = await this.io.read(userId)
        ledger.completedAt.push(at)
        await this.io.write(userId, ledger)
        await this.reconcile(snapshot, revision)
      } catch (error) { if (revision === this.revision) this.io.state({ status: 'error', count: 0 }); throw error }
    })
  }
  present(data: unknown, id: string): Promise<boolean> {
    const revision = this.revision
    return this.enqueue(async () => {
      const d = localReminderData(data), s = this.desired
      if (!d || !s || d.userId !== s.userId || !s.allowed || !s.settings.enabled) return false
      const now = this.io.now(), zone = s.settings.timezone
      if (s.completedToday && localDate(s.observedAt ?? now, zone) === localDate(now, zone)) return false
      if (localDate(now, zone) !== d.date || isQuiet(localTime(now, zone), s.settings.quiet_start, s.settings.quiet_end)) return false
      const ledger = await this.io.read(s.userId)
      const entry = ledger.entries.find(e => e.id === id && e.at === d.at && e.kind === d.kind)
      const used = ledger.entries.filter(e => e.at <= now && localDate(e.at, zone) === d.date).sort((a, b) => a.at - b.at)
      if (!entry || ledger.presented.includes(id) || ledger.completedAt.some(at => localDate(at, zone) === d.date) || used.findIndex(e => e.id === id) >= s.settings.max_per_day || !used.some(e => e.id === id)) return false
      ledger.presented.push(id); entry.spent = true
      await this.io.write(s.userId, ledger)
      return revision === this.revision
    })
  }
}

// API services call these hooks without importing native modules or a React context.
type Hooks = { clear: () => Promise<void>; complete: (userId: number, streak: number) => Promise<void> }
let hooks: Hooks | undefined
export const localReminderLifecycle = {
  attach(next: Hooks) { hooks = next; return () => { if (hooks === next) hooks = undefined } },
  clear: async () => { await hooks?.clear() },
  complete: async (userId: number, streak: number) => { await hooks?.complete(userId, streak) },
}
