import { emptyStats, newSet, type StudySet } from './types'
import { StudyError, asRecord, utf8Bytes, validateManual } from './validation'

export const STORAGE_VERSION = 1
export const MAX_SETS = 100
// Below the Android AsyncStorage per-row cursor limit; includes both kinds.
export const MAX_STORAGE_BYTES = 1536 * 1024
export interface KeyValueStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface StudyLibrary { sets: StudySet[]; warning?: 'storageCorrupt' | 'storageUnavailable' | 'storageVersion'; writable: boolean }
export function studyStorageKey(account: string | number) {
  if (String(account).trim() === '') throw new StudyError('unauthorized')
  return `senpaiai.study.account.${encodeURIComponent(String(account))}`
}
function finite(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 }
function checkedSet(value: unknown): StudySet {
  const set = asRecord(value)
  if (typeof set.id !== 'string' || !set.id || (set.kind !== 'quiz' && set.kind !== 'flashcard') || typeof set.name !== 'string' || typeof set.category !== 'string' || typeof set.jlpt_level !== 'string' || !['manual', 'imported'].includes(String(set.source)) || typeof set.file_name !== 'string' || typeof set.created_at !== 'string' || !Number.isFinite(Date.parse(set.created_at)) || typeof set.updated_at !== 'string' || !Number.isFinite(Date.parse(set.updated_at)) || !Array.isArray(set.questions) || !Array.isArray(set.cards)) throw new Error('schema')
  const stats = asRecord(set.stats)
  if (!['correct', 'wrong', 'streak', 'accuracy'].every(key => finite(stats[key])) || Number(stats.accuracy) > 100 || (set.last_studied_at !== null && (typeof set.last_studied_at !== 'string' || !Number.isFinite(Date.parse(set.last_studied_at)))) || (set.last_accuracy !== null && (!finite(set.last_accuracy) || Number(set.last_accuracy) > 100))) throw new Error('stats')
  return validateManual(set as unknown as StudySet)
}
export class StudyStore {
  private locks = new Map<string, Promise<unknown>>()
  constructor(private storage: KeyValueStorage) {}
  async read(account: string | number): Promise<StudyLibrary> {
    const key = studyStorageKey(account)
    let raw: string | null
    try { raw = await this.storage.getItem(key) } catch { return { sets: [], warning: 'storageUnavailable', writable: false } }
    if (raw === null) return { sets: [], writable: true }
    try {
      if (utf8Bytes(raw) > MAX_STORAGE_BYTES) throw new Error('size')
      const data = asRecord(JSON.parse(raw))
      if (typeof data.version === 'number' && data.version > STORAGE_VERSION) return { sets: [], warning: 'storageVersion', writable: false }
      if (data.version !== STORAGE_VERSION || !Array.isArray(data.sets) || data.sets.length > MAX_SETS) throw new Error('version')
      const sets = data.sets.map(checkedSet)
      if (new Set(sets.map(set => set.id)).size !== sets.length) throw new Error('duplicate')
      return { sets, writable: true }
    } catch { return { sets: [], warning: 'storageCorrupt', writable: false } }
  }
  private serialize<T>(account: string | number, action: () => Promise<T>): Promise<T> {
    const key = studyStorageKey(account), previous = this.locks.get(key) || Promise.resolve()
    const next = previous.catch(() => undefined).then(action)
    this.locks.set(key, next)
    void next.finally(() => { if (this.locks.get(key) === next) this.locks.delete(key) }).catch(() => undefined)
    return next
  }
  private async write(account: string | number, transform: (sets: StudySet[]) => StudySet[]) {
    const library = await this.read(account)
    if (!library.writable) throw new StudyError(library.warning!)
    const sets = transform(library.sets)
    if (sets.length > MAX_SETS) throw new StudyError('tooManySets', { count: MAX_SETS })
    const text = JSON.stringify({ version: STORAGE_VERSION, sets })
    if (utf8Bytes(text) > MAX_STORAGE_BYTES) throw new StudyError('storageFull')
    try { await this.storage.setItem(studyStorageKey(account), text) } catch { throw new StudyError('storageUnavailable') }
    return sets
  }
  save(account: string | number, input: StudySet) {
    return this.serialize(account, () => this.write(account, sets => {
      const set = checkedSet({ ...input, updated_at: new Date().toISOString() })
      return [set, ...sets.filter(item => item.id !== set.id)]
    }))
  }
  remove(account: string | number, id: string) { return this.serialize(account, () => this.write(account, sets => sets.filter(set => set.id !== id))) }
  rename(account: string | number, id: string, name: string) {
    return this.serialize(account, () => this.write(account, sets => sets.map(set => set.id === id ? checkedSet({ ...set, name, updated_at: new Date().toISOString() }) : set)))
  }
  duplicate(account: string | number, id: string, name: string) {
    return this.serialize(account, () => this.write(account, sets => {
      const original = sets.find(set => set.id === id)
      if (!original) throw new StudyError('missingSet')
      const copy = checkedSet({ ...original, ...newSet(original.kind), name, jlpt_level: original.jlpt_level, category: original.category, source: original.source, file_name: original.file_name, questions: original.questions, cards: original.cards })
      return [copy, ...sets]
    }))
  }
  record(account: string | number, id: string, remembered: boolean) {
    return this.serialize(account, () => this.write(account, sets => {
      if (!sets.some(set => set.id === id && set.kind === 'flashcard')) throw new StudyError('missingSet')
      return sets.map(set => {
        if (set.id !== id) return set
        const stats = { ...set.stats, correct: set.stats.correct + (remembered ? 1 : 0), wrong: set.stats.wrong + (remembered ? 0 : 1), streak: remembered ? set.stats.streak + 1 : 0 }
        stats.accuracy = Math.round(stats.correct / (stats.correct + stats.wrong) * 100)
        return { ...set, stats, last_studied_at: new Date().toISOString() }
      })
    }))
  }
  finish(account: string | number, id: string, accuracy: number) {
    return this.serialize(account, () => this.write(account, sets => sets.map(set => set.id === id ? { ...set, last_accuracy: Math.min(100, Math.max(0, accuracy)), last_studied_at: new Date().toISOString() } : set)))
  }
  reset(account: string | number) { return this.serialize(account, async () => { try { await this.storage.removeItem(studyStorageKey(account)) } catch { throw new StudyError('storageUnavailable') } }) }
}
export { emptyStats }
