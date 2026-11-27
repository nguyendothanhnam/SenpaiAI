import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('removed stroke viewer has no entry while writing remains available', () => {
  const web = readFileSync(new URL('../src/pages/Kanji.jsx', import.meta.url), 'utf8')
  const mobile = readFileSync(new URL('../../mobile/src/screens/KanjiDetailScreen.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(web, /StrokeOrderViewer|switchToStroke|id: 'stroke'|viewStrokeOrder/)
  assert.match(web, /KanjiWriting/)
  assert.doesNotMatch(mobile, /kanjiAPI\.strokes|StrokeAnimation|phase3\.strokeOrder/)
  assert.match(mobile, /kanji-write/)
})
