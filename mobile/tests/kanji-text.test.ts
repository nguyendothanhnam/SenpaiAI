import assert from 'node:assert/strict'
import test from 'node:test'
import { splitKanjiText } from '../../shared-games/kanjiText'

test('mixed Japanese, Latin, punctuation and supplementary Han retain exact text', () => {
  const input = '日本語かなABC、𠮷😀\n𪚥 Việt'
  const parts = splitKanjiText(input)
  assert.equal(parts.map(part => part.text).join(''), input)
  assert.deepEqual(parts.filter(part => part.han).map(part => part.text), ['日', '本', '語', '𠮷', '𪚥'])
  assert.ok(parts.some(part => part.text === 'かなABC、'))
})

test('empty input and long text stay linear in generated runs', () => {
  assert.deepEqual(splitKanjiText(''), [])
  const text = 'Latin 😀 '.repeat(10000) + '日'
  const parts = splitKanjiText(text)
  assert.equal(parts.length, 2)
  assert.equal(parts.map(part => part.text).join(''), text)
})
