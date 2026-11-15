// Contract from frontend/src/components/kanji/KanjiCanvas.jsx.
export type InkPoint = { x: number; y: number; timestamp: number; pressure: number; strokeId: string }
export type InkStroke = InkPoint[]
export const MAX_POINTS = 256
export function normalizeStrokes(strokes: InkStroke[]): InkStroke[] {
  const points = strokes.flat()
  if (!points.length) return []
  const bounds = points.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
  const { minX, minY } = bounds
  const w = Math.max(1, bounds.maxX - minX), h = Math.max(1, bounds.maxY - minY)
  const scale = 256 * .74 / Math.max(w, h)
  return strokes.filter(s => s.length).map(s => s.map(p => ({ ...p, x: (p.x - minX) * scale + (256 - w * scale) / 2, y: (p.y - minY) * scale + (256 - h * scale) / 2 })))
}
export function reduceStroke(stroke: InkStroke): InkStroke {
  if (stroke.length <= MAX_POINTS) return stroke
  return Array.from({ length: MAX_POINTS }, (_, i) => stroke[Math.round(i * (stroke.length - 1) / (MAX_POINTS - 1))])
}
export function smoothPath(stroke: InkStroke): string {
  if (!stroke.length) return ''
  let d = `M${stroke[0].x},${stroke[0].y}`
  for (let i = 1; i < stroke.length - 1; i++) d += ` Q${stroke[i].x},${stroke[i].y} ${(stroke[i].x + stroke[i + 1].x) / 2},${(stroke[i].y + stroke[i + 1].y) / 2}`
  const last = stroke[stroke.length - 1]
  return `${d} L${last.x + (stroke.length === 1 ? .01 : 0)},${last.y}`
}
// A small binary PNG encoder keeps export independent of native snapshots, grid and theme.
function crc(bytes: number[]) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0) } return (c ^ 0xffffffff) >>> 0 }
function u32(n: number) { return [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255] }
function chunk(name: string, data: number[]) { const body = [...Array.from(name, c => c.charCodeAt(0)), ...data]; return [...u32(data.length), ...body, ...u32(crc(body))] }
export function recognitionImage(strokes: InkStroke[]): string {
  const pixels = new Uint8Array(256 * 256).fill(255)
  for (const stroke of strokes) {
    if (!stroke.length) continue
    const radius = 9 * (.82 + stroke.reduce((a, p) => a + (p.pressure || .5), 0) / stroke.length * .36)
    const dot = (x: number, y: number) => { for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(255, y + radius); yy++) for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(255, x + radius); xx++) if ((xx + .5 - x) ** 2 + (yy + .5 - y) ** 2 <= radius ** 2) pixels[yy * 256 + xx] = 0 }
    let from = stroke[0]; dot(from.x, from.y)
    for (let i = 1; i < stroke.length; i++) {
      const control = stroke[i], next = stroke[i + 1]
      const end = next ? { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 } : control
      const steps = Math.max(1, Math.ceil((Math.hypot(control.x - from.x, control.y - from.y) + Math.hypot(end.x - control.x, end.y - control.y)) * 2))
      for (let j = 1; j <= steps; j++) { const t = j / steps, a = 1 - t; dot(a * a * from.x + 2 * a * t * control.x + t * t * end.x, a * a * from.y + 2 * a * t * control.y + t * t * end.y) }
      from = { ...control, ...end }
    }
  }
  const raw: number[] = []
  for (let y = 0; y < 256; y++) { raw.push(0); for (let x = 0; x < 256; x++) raw.push(pixels[y * 256 + x]) }
  const z = [0x78, 0x01]
  for (let offset = 0; offset < raw.length; offset += 65535) { const block = raw.slice(offset, offset + 65535), n = block.length; z.push(offset + n === raw.length ? 1 : 0, n & 255, n >>> 8, ~n & 255, ~n >>> 8 & 255); for (const b of block) z.push(b) }
  let a = 1, b = 0; for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521 } z.push(...u32(b * 65536 + a))
  const png = [137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [...u32(256), ...u32(256), 8, 0, 0, 0, 0]), ...chunk('IDAT', z), ...chunk('IEND', [])]
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let encoded = ''
  for (let i = 0; i < png.length; i += 3) { const n = png[i] * 65536 + (png[i + 1] || 0) * 256 + (png[i + 2] || 0); encoded += alphabet[n >>> 18] + alphabet[n >>> 12 & 63] + (i + 1 < png.length ? alphabet[n >>> 6 & 63] : '=') + (i + 2 < png.length ? alphabet[n & 63] : '=') }
  return `data:image/png;base64,${encoded}`
}
export function recognitionPayload(raw: InkStroke[], target?: string, level?: string) {
  const normalized = normalizeStrokes(raw)
  return { image_data: recognitionImage(normalized), strokes: normalized.map(reduceStroke), target_kanji: target || null, jlpt_level: level || null }
}
