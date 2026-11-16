import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { inflateSync } from 'node:zlib'
import { test } from 'node:test'
import { MAX_POINTS, normalizeStrokes, recognitionPayload, reduceStroke, smoothPath, type InkStroke } from '../src/features/kanji/handwriting'

const point = (x: number, y: number, strokeId = '123-1') => ({ x, y, strokeId, timestamp: 123, pressure: .5 })
// Execute the actual, unchanged web normalization functions to detect contract drift.
const source = readFileSync(new URL('../../frontend/src/components/kanji/KanjiCanvas.jsx', import.meta.url), 'utf8')
const getBounds = source.slice(source.indexOf('function getBounds('), source.indexOf('function drawSmoothStroke('))
const transform = source.slice(source.indexOf('function transformStrokesToSquare('), source.indexOf('function createRecognitionImage('))
const web = vm.runInNewContext(`${getBounds}\n${transform}\ntransformStrokesToSquare`) as (strokes: InkStroke[], size: number, padding: number) => InkStroke[]
for (const [label, strokes] of Object.entries({ empty: [], dot: [[point(200, 300)]], horizontal: [[point(20, 360), point(700, 360)]], vertical: [[point(360, 10), point(360, 710)]], multi: [[point(90, 90), point(500, 250)], [point(190, 140, '123-2'), point(400, 620, '123-2')]] } satisfies Record<string, InkStroke[]>)) {
  test(`web normalization parity: ${label}`, () => {
    const expected = web(strokes, 256, .13), actual = normalizeStrokes(strokes)
    assert.equal(actual.length, expected.length)
    actual.forEach((s, i) => s.forEach((p, j) => { assert.ok(Math.abs(p.x - expected[i][j].x) < 1e-10); assert.ok(Math.abs(p.y - expected[i][j].y) < 1e-10); assert.equal(p.strokeId, expected[i][j].strokeId); assert.equal(p.timestamp, 123); assert.equal(p.pressure, .5) }))
  })
}
test('decimation preserves short strokes, sequence, endpoints and metadata', () => {
  const short = [point(0, 0), point(1, 1)]; assert.equal(reduceStroke(short), short)
  const long = Array.from({ length: 4096 }, (_, i) => point(i, i * .5))
  const reduced = reduceStroke(long); assert.equal(reduced.length, MAX_POINTS)
  assert.equal(reduced[0], long[0]); assert.equal(reduced.at(-1), long.at(-1))
  assert.ok(reduced.every((p, i) => !i || p.x > reduced[i - 1].x))
})
test('payload is a decodable binary 256-square PNG, no guides or theme colors', () => {
  const payload = recognitionPayload([[point(0, 0), point(720, 720)]], '一', 'N5')
  assert.equal(payload.target_kanji, '一'); assert.equal(payload.jlpt_level, 'N5')
  const png = Buffer.from(payload.image_data.split(',')[1], 'base64')
  assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 256); assert.equal(png.readUInt32BE(20), 256)
  let offset = 8; const blocks: Buffer[] = []
  while (offset < png.length) { const size = png.readUInt32BE(offset); if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') blocks.push(png.subarray(offset + 8, offset + 8 + size)); offset += size + 12 }
  const raw = inflateSync(Buffer.concat(blocks)); assert.equal(raw.length, 257 * 256)
  assert.ok([...raw].every(p => p === 0 || p === 255)); assert.equal(raw[1], 255); assert.equal(raw[128 * 257 + 129], 0)
  assert.equal(recognitionPayload([]).target_kanji, null)
})
test('smoothing matches web midpoint quadratic construction and renders taps', () => {
  assert.equal(smoothPath([point(0, 0), point(10, 20), point(30, 40)]), 'M0,0 Q10,20 20,30 L30,40')
  assert.match(smoothPath([point(10, 20)]), /L10.01,20$/); assert.equal(smoothPath([]), '')
})
