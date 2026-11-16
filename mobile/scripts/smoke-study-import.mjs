import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// These two endpoints only parse files. Do not call create/list/submit or create
// test accounts: phase 4 keeps personal sets exclusively on the device.
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
assert.ok(base, 'Set EXPO_PUBLIC_API_URL before running this check.')
const cases = [
  ['quiz-valid.xlsx', '/game/quiz/upload', 'questions', 2],
  ['quiz-invalid-rows.xlsx', '/game/quiz/upload', null, ['Row 2:', 'Row 3:']],
  ['quiz-missing-columns.xlsx', '/game/quiz/upload', null, ['Missing required columns:']],
  ['flashcard-valid.xlsx', '/game/flashcard/import', 'cards', 2],
  ['flashcard-invalid-rows.xlsx', '/game/flashcard/import', null, ['Row 2:', 'Row 3:']],
  ['flashcard-missing-columns.xlsx', '/game/flashcard/import', null, ['Missing required columns: front, back']],
  ['flashcard-valid.csv', '/game/flashcard/import', 'cards', 2],
  ['flashcard-valid.json', '/game/flashcard/import', 'cards', 1],
]
for (const [name, endpoint, field, expected] of cases) {
  const content = await readFile(new URL(`../docs/samples/study/${name}`, import.meta.url))
  const form = new FormData()
  form.append('file', new Blob([content]), name)
  const response = await fetch(`${base}${endpoint}`, { method: 'POST', body: form, signal: AbortSignal.timeout(45000) })
  const data = await response.json()
  if (field) {
    assert.equal(response.status, 200, `${name}: ${JSON.stringify(data)}`)
    assert.equal(data[field]?.length, expected, name)
    if (field === 'questions') assert.equal(data.questions[1].correct_answer, 'A', 'Excel numeric alias 1 must be parsed to A')
  } else {
    assert.equal(response.status, 400, name)
    for (const message of expected) assert.ok(String(data.detail).includes(message), `${name}: ${message}`)
  }
  console.log(`PASS HTTP ${response.status}: ${name}`)
}
console.log('8 live import checks passed. No shared sets or accounts were created.')
