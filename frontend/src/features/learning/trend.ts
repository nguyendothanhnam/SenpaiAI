import type { TrendPoint } from '../../services/learning'

/** Missing accuracy is never converted to zero or included as a measured point. */
export function trendGeometry(points: TrendPoint[]) {
  const maximum = Math.max(0, ...points.map(point => point.lessons))
  const rawStep = Math.max(5, maximum / 4)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= rawStep)!
  const ceiling = step * 4
  const left = 96, right = 904, top = 56, bottom = 350
  // Leave room for endpoint bars so they never cover either axis or its labels.
  const x = (index: number) => points.length === 1 ? (left + right) / 2 : left + 32 + index * (right - left - 64) / Math.max(1, points.length - 1)
  const accuracyY = (value: number) => bottom - Math.max(0, Math.min(100, value)) / 100 * (bottom - top)
  const barWidth = Math.min(44, 600 / Math.max(1, points.length))
  const rows = points.map((point, index) => {
    const center = x(index), barY = bottom - point.lessons / ceiling * (bottom - top)
    const a = center - barWidth / 2, b = center + barWidth / 2, r = Math.min(4, (bottom - barY) / 2)
    return { ...point, x: center, barY, accuracyY: point.accuracy === null ? null : accuracyY(point.accuracy), barPath: `M${a},${bottom} V${barY + r} Q${a},${barY} ${a + r},${barY} H${b - r} Q${b},${barY} ${b},${barY + r} V${bottom} Z` }
  })
  const segments: { path: string; gap: boolean }[] = []
  let previous: number | null = null
  rows.forEach((row, index) => {
    if (row.accuracyY === null) return
    if (previous !== null) segments.push({ path: `M${rows[previous].x},${rows[previous].accuracyY} L${row.x},${row.accuracyY}`, gap: index - previous > 1 })
    previous = index
  })
  return { rows, segments, ceiling, left, right, top, bottom, barWidth, ticks: Array.from({ length: 5 }, (_, index) => ({ lessons: index * step, accuracy: index * 25, y: bottom - index / 4 * (bottom - top) })) }
}
