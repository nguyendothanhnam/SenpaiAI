export interface Point { x: number; y: number }
export interface SwipePoint extends Point { atMs?: number }
export interface Rect { x: number; y: number; width: number; height: number }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export function segmentRectInterval(a: Point, b: Point, rect: Rect): [number, number] | null {
  if (![a.x, a.y, b.x, b.y, rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0) return null
  let low = 0, high = 1
  for (const [origin, delta, min, max] of [[a.x, b.x - a.x, rect.x, rect.x + rect.width], [a.y, b.y - a.y, rect.y, rect.y + rect.height]]) {
    if (Math.abs(delta) < 1e-10) { if (origin < min || origin > max) return null; continue }
    const t1 = (min - origin) / delta, t2 = (max - origin) / delta
    low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2))
    if (low > high) return null
  }
  return [low, high]
}
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean { return segmentRectInterval(a, b, rect) !== null }

/** Sample KanjiVG's M/L/H/V/C/S/Q/T/Z paths without SVG, DOM or native dependencies. */
export function samplePath(path: string): Point[] {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []
  const points: Point[] = []
  let i = 0, command = '', current: Point = { x: 0, y: 0 }, start = current, control = current, previous = ''
  const counts: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 }
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++]
    const upper = command.toUpperCase(), relative = command !== upper
    if (upper === 'Z') { current = { ...start }; points.push(current); previous = upper; command = ''; continue }
    const count = counts[upper]
    if (!count || i + count > tokens.length || tokens.slice(i, i + count).some(token => /^[a-zA-Z]$/.test(token))) throw new Error('unsupported_stroke_path')
    const values = tokens.slice(i, i + count).map(Number); i += count
    const base = { ...current }
    const point = (offset: number): Point => ({ x: values[offset] + (relative ? base.x : 0), y: values[offset + 1] + (relative ? base.y : 0) })
    if (upper === 'M' || upper === 'L') {
      current = point(0); points.push(current)
      if (upper === 'M') { start = current; command = relative ? 'l' : 'L' }
    } else if (upper === 'H' || upper === 'V') {
      current = upper === 'H' ? { x: values[0] + (relative ? base.x : 0), y: base.y } : { x: base.x, y: values[0] + (relative ? base.y : 0) }
      points.push(current)
    } else {
      const cubic = upper === 'C' || upper === 'S'
      const reflected = { x: 2 * base.x - control.x, y: 2 * base.y - control.y }
      const first = upper === 'C' || upper === 'Q' ? point(0) : ((cubic && ['C', 'S'].includes(previous)) || (!cubic && ['Q', 'T'].includes(previous))) ? reflected : base
      const second = upper === 'C' ? point(2) : upper === 'S' ? point(0) : first
      const end = point(count - 2)
      for (let n = 1; n <= 12; n++) {
        const t = n / 12, u = 1 - t
        points.push(cubic ? { x: u ** 3 * base.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x, y: u ** 3 * base.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y } : { x: u ** 2 * base.x + 2 * u * t * first.x + t ** 2 * end.x, y: u ** 2 * base.y + 2 * u * t * first.y + t ** 2 * end.y })
      }
      current = end; control = cubic ? second : first
    }
    previous = upper
  }
  if (!points.length || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('invalid_stroke_path')
  return points
}
export function resamplePath(path: string, count = 12): Point[] {
  const points = samplePath(path), lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]))
  const total = lengths[lengths.length - 1]
  return Array.from({ length: count }, (_, n) => {
    const target = total * n / (count - 1)
    const right = Math.max(1, lengths.findIndex(length => length >= target))
    if (right >= points.length) return points[points.length - 1]
    const fraction = (target - lengths[right - 1]) / (lengths[right] - lengths[right - 1] || 1)
    return { x: points[right - 1].x + (points[right].x - points[right - 1].x) * fraction, y: points[right - 1].y + (points[right].y - points[right - 1].y) * fraction }
  })
}
