import assert from 'node:assert/strict'
import test from 'node:test'
import { answerLines, inlineParts } from '../src/features/phase2/messageFormatting'

test('AI answers render emphasis and headings without exposing markdown markers', () => {
  const lines = answerLines('**Intent: grammar**\r\n## Cách dùng\n- **食べる**: __ăn__\nVí dụ: `ご飯を食べる`')
  assert.equal(lines.length, 3)
  assert.deepEqual(lines[0], { heading: true, text: 'Cách dùng' })
  assert.deepEqual(inlineParts(lines[1].text), [{ text: '• ' }, { text: '食べる', bold: true }, { text: ': ' }, { text: 'ăn', bold: true }])
  assert.deepEqual(inlineParts(lines[2].text), [{ text: 'Ví dụ: ' }, { text: 'ご飯を食べる', code: true }])
})

test('unfinished bold markers do not leak into replies and Japanese remains intact', () => {
  assert.equal(inlineParts('**日本語を勉強します。').map(p => p.text).join(''), '日本語を勉強します。')
  assert.equal(inlineParts('2 * 3 = 6').map(p => p.text).join(''), '2 * 3 = 6')
  assert.deepEqual(inlineParts('\\*\\*漢字\\*\\*'), [{ text: '漢字', bold: true }])
  assert.equal(inlineParts('<script>alert(1)</script>')[0].text, '<script>alert(1)</script>')
})
