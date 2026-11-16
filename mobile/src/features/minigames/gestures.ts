import { lineCells, type Cell } from '@games/wordsearch'
import type { Point } from '@games/geometry'
export function cellAt(point: Point, width: number, size: number): Cell | null {
  if (width <= 0 || point.x < 0 || point.y < 0 || point.x >= width || point.y >= width) return null
  return { row: Math.floor(point.y * size / width), col: Math.floor(point.x * size / width) }
}
/** Snap a free finger drag to the nearest horizontal, vertical or diagonal ray. */
export function snappedPath(start: Cell, end: Cell, size: number): Cell[] {
  const dr = end.row - start.row, dc = end.col - start.col, ar = Math.abs(dr), ac = Math.abs(dc)
  const diagonal = Math.min(ar, ac) >= Math.max(ar, ac) * .5
  let length = Math.max(ar, ac)
  const row = diagonal || ar > ac ? Math.sign(dr) : 0, col = diagonal || ac >= ar ? Math.sign(dc) : 0
  while (length && (start.row + row * length < 0 || start.row + row * length >= size || start.col + col * length < 0 || start.col + col * length >= size)) length--
  return lineCells(start, { row: start.row + row * length, col: start.col + col * length })
}
