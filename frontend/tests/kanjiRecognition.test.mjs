import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// Execute the actual page callback with state/API seams, without rendering a
// canvas or making recognition requests that would save user training samples.
const source = ts.createSourceFile('Kanji.jsx', readFileSync(new URL('../src/pages/Kanji.jsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX)
let callback
function inspect(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'recognize' && node.initializer && ts.isArrowFunction(node.initializer)) callback = node.initializer.getText(source)
  ts.forEachChild(node, inspect)
}
inspect(source)
assert.ok(callback)
function setup(character, empty = false) {
  const calls = [], statuses = [], errors = []
  const noop = () => undefined
  const context = {
    mode: 'recognize', selectedKanjiSource: 'manual',
    // No thumbnails is not evidence that CNN classes or reference strokes are absent.
    selectedHandwritingQuery: { data: { items: [], total: 0 } },
    selectedInfo: { kanji: character, jlpt: 'N5' },
    canvasRef: { current: { isEmpty: () => empty, getImage: () => 'test-png', getStrokes: () => [] } },
    kanjiRecognitionAPI: { recognize: async payload => { calls.push(payload); return { data: { success: true, predictions: [{ kanji: character, confidence: .99 }] } } } },
    setStatus: status => statuses.push(status), setError: error => errors.push(error),
    setPredictions: noop, setSelectedKanjiSource: noop, setCorrectionStatus: noop,
    setRecognitionMessage: noop, setLowConfidence: noop, setLastRecognitionPayload: noop,
    setIsDemo: noop, setRecent: noop, updateSelectedKanji: noop,
    checkPractice: noop, RECOGNITION_CONFIDENCE_THRESHOLD: .65,
    readableError: (value, fallback) => value || fallback || '', t: key => key,
  }
  return { recognize: vm.runInNewContext(`(${callback})`, context), calls, statuses, errors }
}
for (const character of ['語', '東']) test(`${character}: manually selected trained kanji reaches recognition even with zero ETL10 thumbnails`, async () => {
  const page = setup(character)
  await page.recognize()
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].target_kanji, character)
  assert.equal(page.statuses.at(-1), 'success')
  assert.ok(!page.errors.includes('unsupportedCharacter'))
})
test('blank handwriting still prevents a recognition request', async () => {
  const page = setup('語', true)
  await page.recognize()
  assert.equal(page.calls.length, 0)
  assert.equal(page.statuses.at(-1), 'empty')
})
