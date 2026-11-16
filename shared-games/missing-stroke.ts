import raw from './stroke-catalog.json'
import { resamplePath, distance, type Point } from './geometry'
import { shuffle } from './random'
import type { Difficulty, Level, StrokeGlyph } from './types'
import { missingEligible } from './phase2-data'
export { missingEligible } from './phase2-data'
export const strokeGlyphs = raw.glyphs as StrokeGlyph[]
export interface StrokeChoice { id: string; path: string; viewBox: string }
export interface MissingStroke { glyph: StrokeGlyph; hidden: number; choices: StrokeChoice[]; targetId: string; ageMs: number; questionId: number; used: string[] }
const cache = /* @__PURE__ */ new Map<string, Point[]>()
const samples = (path: string) => {
  let value = cache.get(path)
  if (!value) { value = resamplePath(path); cache.set(path, value) }
  return value
}
export function strokeDifference(a: string, b: string): number {
  const x = samples(a), y = samples(b)
  return Math.min(x.reduce((sum, point, i) => sum + distance(point, y[i]), 0), x.reduce((sum, point, i) => sum + distance(point, y[y.length - 1 - i]), 0)) / x.length
}
export function createMissingStroke(level: Level, difficulty: Difficulty, random: () => number, used: string[] = [], questionId = 1, source: StrokeGlyph[] = strokeGlyphs): MissingStroke | null {
  const sameLevel = source.filter(glyph => glyph.level === level)
  const eligible = shuffle(sameLevel.filter(glyph => missingEligible(glyph.paths.length, difficulty) && !used.includes(glyph.id)), random)
  for (const glyph of eligible) {
    for (const hidden of shuffle(glyph.paths.map((_, index) => index), random)) {
      const path = glyph.paths[hidden]
      if (glyph.paths.some((other, index) => index !== hidden && strokeDifference(path, other) < 3)) continue
      const pool = [...new Set(sameLevel.filter(item => item.viewBox === glyph.viewBox).flatMap(item => item.paths))]
        .filter(other => strokeDifference(path, other) >= 5)
        .map(other => ({ path: other, difference: strokeDifference(path, other) }))
        .sort((a, b) => a.difference - b.difference).slice(0, 80)
      const noise: string[] = []
      for (const candidate of shuffle(pool, random)) {
        if (noise.every(other => strokeDifference(candidate.path, other) >= 5)) noise.push(candidate.path)
        if (noise.length === 3) break
      }
      if (noise.length < 3) continue
      const targetId = `${questionId}:target`
      const choices = shuffle([{ id: targetId, path, viewBox: glyph.viewBox }, ...noise.map((other, index) => ({ id: `${questionId}:noise:${index}`, path: other, viewBox: glyph.viewBox }))], random)
      return { glyph, hidden, choices, targetId, ageMs: 0, questionId, used: [...used] }
    }
  }
  return null
}
export const missingPoints = (ageMs: number) => Math.max(30, 200 - Math.floor(Math.max(0, ageMs) / 80))
