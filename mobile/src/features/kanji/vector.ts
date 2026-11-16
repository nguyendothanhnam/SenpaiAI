export interface Point { x: number; y: number }
export interface Segment { x: number; y: number; length: number; angle: string }
// KanjiVG in this project uses M/m and C/c/S/s. Handle lines as well; reject
// unknown commands instead of silently drawing an incorrect stroke diagram.
export function samplePath(path: string): Point[] {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []
  let i = 0, command = '', p: Point = { x: 0, y: 0 }, control: Point | null = null
  const points: Point[] = []
  const number = () => { const n = Number(tokens[i++]); if (!Number.isFinite(n)) throw new Error('invalid_vector'); return n }
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++]
    const relative = command === command.toLowerCase()
    const point = (): Point => ({ x: number() + (relative ? p.x : 0), y: number() + (relative ? p.y : 0) })
    const kind = command.toUpperCase()
    if (kind === 'M' || kind === 'L') {
      p = point(); points.push(p); control = null
      if (kind === 'M') command = relative ? 'l' : 'L'
    } else if (kind === 'C' || kind === 'S') {
      const a: Point = kind === 'C' ? point() : control ? { x: p.x * 2 - control.x, y: p.y * 2 - control.y } : p
      const b = point(), end = point(), start = p
      for (let step = 1; step <= 16; step++) {
        const t = step / 16, s = 1 - t
        points.push({ x: s ** 3 * start.x + 3 * s * s * t * a.x + 3 * s * t * t * b.x + t ** 3 * end.x, y: s ** 3 * start.y + 3 * s * s * t * a.y + 3 * s * t * t * b.y + t ** 3 * end.y })
      }
      p = end; control = b
    } else throw new Error('unsupported_vector')
    if (points.length > 2000) throw new Error('vector_limit')
  }
  return points
}
export function vectorSegments(path: string, viewBox = '0 0 109 109', size = 260): Segment[] {
  const box = viewBox.split(/[ ,]+/).map(Number)
  if (box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) throw new Error('invalid_viewbox')
  const scale = size / Math.max(box[2], box[3])
  const points = samplePath(path).map(p => ({ x: (p.x - box[0]) * scale, y: (p.y - box[1]) * scale }))
  return points.slice(1).flatMap((p, i) => {
    const a = points[i], length = Math.hypot(p.x - a.x, p.y - a.y)
    return length > 0 ? [{ x: (p.x + a.x) / 2 - length / 2, y: (p.y + a.y) / 2 - 1.5, length, angle: `${Math.atan2(p.y - a.y, p.x - a.x)}rad` }] : []
  })
}
