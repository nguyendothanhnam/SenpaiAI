import { distance, segmentIntersectsRect, segmentRectInterval, type Point, type SwipePoint } from './geometry'
import { hiragana } from './shiritori'
import { pick, shuffle } from './random'
import { DIFFICULTY, LEVELS, type AnswerMode, type Difficulty, type Level, type WordItem } from './types'
export interface FlyingWord {
  id: number; item: WordItem; bornAt: number; x0: number; vx: number; vy: number; gravity: number
  speed: number; lifetimeMs: number; width: number; height: number
}
export interface Ninja { request: WordItem; entities: FlyingWord[]; timeMs: number; hits: number; goal: number; wave: number; nextId: number }
export function ninjaValue(item: WordItem, mode: AnswerMode): string { return mode === 'reading' ? hiragana(item.reading) : (item.meaning || '').trim() }
export const ninjaMatches = (item: WordItem, request: WordItem, mode: AnswerMode) => !!ninjaValue(request, mode) && ninjaValue(item, mode) === ninjaValue(request, mode)
export function ninjaRules(level: Level, difficulty: Difficulty, hits: number) {
  return { count: Math.min(4, (difficulty === 'easy' ? 2 : difficulty === 'normal' ? 3 : 4) + Math.floor(hits / 6)), speed: Math.min(2.2, DIFFICULTY[difficulty].speed * (1 + LEVELS.indexOf(level) * .07 + hits * .025)), goal: difficulty === 'easy' ? 8 : difficulty === 'normal' ? 12 : 16 }
}
export function flyingPosition(entity: FlyingWord, timeMs: number): Point {
  const t = (timeMs - entity.bornAt) * entity.speed / 1000
  return { x: entity.x0 + entity.vx * t, y: 112 - entity.vy * t + .5 * entity.gravity * t * t }
}
export function newNinjaWave(board: Ninja, pool: WordItem[], level: Level, difficulty: Difficulty, mode: AnswerMode, random: () => number): Ninja {
  const rules = ninjaRules(level, difficulty, board.hits)
  const eligible = pool.filter(word => word.level === level && ninjaValue(word, mode))
  const request = pick(eligible, random)
  const noise = shuffle(eligible.filter(word => !ninjaMatches(word, request, mode)), random).slice(0, rules.count - 1)
  if (noise.length !== rules.count - 1) throw new Error('insufficient_ninja_choices')
  let nextId = board.nextId
  const entities = shuffle([request, ...noise], random).map((item, index) => {
    const x0 = 8 + (index + .5) * 84 / rules.count, vy = 104 + random() * 16, gravity = 80
    return { id: nextId++, item, bornAt: board.timeMs, x0, vx: (50 - x0) * .06 + (random() - .5), vy, gravity, speed: rules.speed, lifetimeMs: (2 * vy / gravity + .2) * 1000 / rules.speed, width: Math.min(31, 9 + item.word.length * 4.5), height: 12 }
  })
  return { ...board, request, entities, wave: board.wave + 1, nextId }
}
export function createNinja(pool: WordItem[], level: Level, difficulty: Difficulty, mode: AnswerMode, random: () => number): Ninja {
  const first = pool[0]
  if (!first) throw new Error('insufficient_ninja_data')
  return newNinjaWave({ request: first, entities: [], timeMs: 0, hits: 0, goal: ninjaRules(level, difficulty, 0).goal, wave: 0, nextId: 1 }, pool, level, difficulty, mode, random)
}
export function tickNinja(board: Ninja, ms: number, mode: AnswerMode): { board: Ninja; missed: number } {
  const timeMs = board.timeMs + ms, expired = board.entities.filter(entity => timeMs - entity.bornAt >= entity.lifetimeMs)
  return { board: { ...board, timeMs, entities: board.entities.filter(entity => timeMs - entity.bornAt < entity.lifetimeMs) }, missed: expired.filter(entity => ninjaMatches(entity.item, board.request, mode)).length }
}
export function swipeHits(entity: FlyingWord, points: SwipePoint[], nowMs: number): boolean {
  if (points.length < 2 || points.length > 256 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || (point.atMs !== undefined && (!Number.isFinite(point.atMs) || point.atMs > nowMs || point.atMs < 0)))) return false
  if (points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0) < 3) return false
  for (let i = 1; i < points.length; i++) {
    const originalA = points[i - 1], originalB = points[i]
    const originalStart = originalA.atMs ?? nowMs, originalEnd = originalB.atMs ?? nowMs
    if (originalEnd < originalStart) return false
    const clip = segmentRectInterval(originalA, originalB, { x: 0, y: 0, width: 100, height: 100 })
    if (!clip) continue
    const a = { x: originalA.x + (originalB.x - originalA.x) * clip[0], y: originalA.y + (originalB.y - originalA.y) * clip[0] }
    const b = { x: originalA.x + (originalB.x - originalA.x) * clip[1], y: originalA.y + (originalB.y - originalA.y) * clip[1] }
    const startMs = originalStart + (originalEnd - originalStart) * clip[0], endMs = originalStart + (originalEnd - originalStart) * clip[1]
    // Relative motion over short subsegments accounts for a word moving during the slash.
    for (let n = 0; n < 4; n++) {
      const f0 = n / 4, f1 = (n + 1) / 4, t0 = startMs + (endMs - startMs) * f0, t1 = startMs + (endMs - startMs) * f1
      if (t1 < entity.bornAt || t0 > entity.bornAt + entity.lifetimeMs) continue
      const c0 = flyingPosition(entity, t0), c1 = flyingPosition(entity, t1)
      const p0 = { x: a.x + (b.x - a.x) * f0 - c0.x, y: a.y + (b.y - a.y) * f0 - c0.y }
      const p1 = { x: a.x + (b.x - a.x) * f1 - c1.x, y: a.y + (b.y - a.y) * f1 - c1.y }
      if (segmentIntersectsRect(p0, p1, { x: -entity.width / 2, y: -entity.height / 2, width: entity.width, height: entity.height })) return true
    }
  }
  return false
}
export function slashNinja(board: Ninja, points: SwipePoint[], mode: AnswerMode): { board: Ninja; correct: number; wrong: number; points: number } {
  const hit = board.entities.filter(entity => swipeHits(entity, points, board.timeMs))
  const correct = hit.filter(entity => ninjaMatches(entity.item, board.request, mode))
  const pointsWon = correct.reduce((sum, entity) => sum + 50 + Math.round(100 * Math.max(0, 1 - (board.timeMs - entity.bornAt) / entity.lifetimeMs)), 0)
  return { board: { ...board, entities: board.entities.filter(entity => !hit.some(item => item.id === entity.id)), hits: board.hits + correct.length }, correct: correct.length, wrong: hit.length - correct.length, points: pointsWon }
}
