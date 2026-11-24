import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { hasCorruptedTranslation } from '../scripts/i18n-text-integrity.mjs'

test('lossy encodings and replacement characters are rejected', () => {
  for (const text of ['H?y ho?n th?nh', 'Ch?a ??nh gi?', '??ng xu?t', '\uFFFD']) {
    assert.equal(hasCorruptedTranslation(text), true, text)
  }
})

test('Vietnamese, Japanese and ordinary question punctuation remain valid', () => {
  for (const text of ['Chưa đánh giá', 'Hãy hoàn thành bài kiểm tra đầu vào.', 'Bạn muốn tiếp tục không?', 'Continue?', 'これは何ですか？']) {
    assert.equal(hasCorruptedTranslation(text), false, text)
  }
})

for (const namespace of ['placement', 'profile', 'errors']) {
  test(`Vietnamese ${namespace} locale contains no corrupted translations`, () => {
    const data = JSON.parse(readFileSync(new URL(`../src/i18n/locales/vi/${namespace}.json`, import.meta.url), 'utf8'))
    const visit = (node, path = '') => {
      for (const [key, value] of Object.entries(node)) {
        const current = path ? `${path}.${key}` : key
        if (typeof value === 'object' && value !== null) visit(value, current)
        else if (typeof value === 'string') assert.equal(hasCorruptedTranslation(value), false, current)
      }
    }
    visit(data)
    if (namespace === 'placement') {
      assert.equal(data.unassessed, 'Chưa đánh giá')
      assert.equal(data.signOut, 'Đăng xuất, tiếp tục sau')
      assert.equal(data.continue, 'Vào ứng dụng')
    }
  })
}
