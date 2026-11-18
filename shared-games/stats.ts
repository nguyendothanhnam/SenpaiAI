import type { Difficulty, Game, Level, Session } from './types'
export interface Stats { highScore: number; played: number; correct: number; mistakes: number; longestChain: number; elapsedMs: number; completed: number; lastRoundId: string }
export const EMPTY_STATS: Stats = { highScore: 0, played: 0, correct: 0, mistakes: 0, longestChain: 0, elapsedMs: 0, completed: 0, lastRoundId: '' }
export interface StatStore { version: 1; entries: Record<string, Stats> }
export function statsKey(game: Game, level: Level, difficulty: Difficulty, variant = '') { return [game, level, difficulty, variant].join(':') }
export function parseStats(raw: string | null): StatStore {
  try {
    const value = JSON.parse(raw || '')
    if (value?.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) return { version: 1, entries: {} }
    const entries: Record<string, Stats> = {}
    for (const [key, entry] of Object.entries(value.entries)) {
      const stat = entry as Stats
      if (stat && typeof stat.lastRoundId === 'string' && Object.keys(EMPTY_STATS).filter(k => k !== 'lastRoundId').every(k => Number.isFinite(stat[k as keyof Stats]) && Number(stat[k as keyof Stats]) >= 0)) entries[key] = stat
    }
    return { version: 1, entries }
  } catch { return { version: 1, entries: {} } }
}
export function recordStats(store: StatStore, key: string, session: Session): StatStore {
  if (session.status !== 'finished') return store
  const previous = store.entries[key] || EMPTY_STATS
  if (previous.lastRoundId === session.id) return store
  return { version: 1, entries: { ...store.entries, [key]: { highScore: Math.max(previous.highScore, session.score), played: previous.played + 1, correct: previous.correct + session.correct, mistakes: previous.mistakes + session.mistakes, longestChain: Math.max(previous.longestChain, session.longestChain), elapsedMs: previous.elapsedMs + session.elapsedMs, completed: previous.completed + (session.reason === 'completed' ? 1 : 0), lastRoundId: session.id } } }
}
export const accountStorageKey = (account: string | number) => `senpaiai.minigames.v1.account:${encodeURIComponent(String(account))}`
