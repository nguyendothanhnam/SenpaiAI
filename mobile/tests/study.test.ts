import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { getOptionKey, isCorrectQuizAnswer, isQuizChoiceCorrect, normalizeAnswer, normalizeText, shuffled, shuffleQuestion } from '../src/features/study/quizAnswers'
import { MAX_FILE_BYTES, MAX_ITEMS, StudyError, normalizeCards, normalizeQuizQuestions, parseQuizJson, utf8Bytes, validateFile, validateManual } from '../src/features/study/validation'
import { MAX_SETS, MAX_STORAGE_BYTES, StudyStore, studyStorageKey, type KeyValueStorage } from '../src/features/study/storage'
import { importIssues } from '../src/features/study/importErrors'
import { newSet, type QuizQuestion } from '../src/features/study/types'

const source = readFileSync(new URL('../../frontend/src/utils/quizAnswers.js', import.meta.url), 'utf8')
const web = vm.runInNewContext(`${source.replace(/export function/g, 'function')}; ({normalizeAnswer, normalizeText, isCorrectQuizAnswer})`) as { normalizeAnswer: typeof normalizeAnswer; normalizeText: typeof normalizeText; isCorrectQuizAnswer: typeof isCorrectQuizAnswer }
const uploadSource = readFileSync(new URL('../../frontend/src/pages/QuizUpload.jsx', import.meta.url), 'utf8').split('export default')[0].replace(/^import .*$/gm, '')
const webUpload = vm.runInNewContext(`${uploadSource}; normalizeAndValidateQuestions`, { normalizeAnswer: web.normalizeAnswer }) as (value: unknown) => unknown
const question = (): QuizQuestion => ({ question: '猫 nghĩa là gì?', options: ['Chó', 'Mèo', 'Cá', 'Chim'], answer: 'B', explanation: '猫 = mèo' })
const quiz = () => ({ ...newSet('quiz'), name: 'N5 quiz', questions: [question()] })
const flash = () => ({ ...newSet('flashcard'), name: 'N5 cards', cards: [{ front: '猫', back: 'mèo' }] })
function hasKey(key: string) { return (error: unknown) => error instanceof StudyError && error.key === key }
function memory() {
  const data = new Map<string, string>()
  const adapter: KeyValueStorage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value) }, removeItem: async key => { data.delete(key) } }
  return { data, adapter, store: new StudyStore(adapter) }
}
test('quiz grading and normalization match the actual web helper over answer aliases and whitespace', () => {
  const answers = ['A', 'B', 'b.', 'B)', 'B mèo', 'B. mèo', 'B) mèo', ' mèo ', 'MÈO', 'option_b', '2', '', 'A text', 'C) text']
  const selected = ['A', 'B', 'C', 'D', 'mèo', ' MÈO ', '  Chó ', '', 'b)', 'B.']
  for (const answer of answers) for (const user of selected) {
    const q = { ...question(), answer }
    assert.equal(isCorrectQuizAnswer(q, user), web.isCorrectQuizAnswer(q, user), `${answer}/${user}`)
    assert.equal(normalizeAnswer(answer), web.normalizeAnswer(answer))
    assert.equal(normalizeText(user), web.normalizeText(user))
  }
  const precedence = { ...question(), answer: 'A', correct_answer: 'C', correct: 'B', correctAnswer: 'D' }
  for (const user of selected) assert.equal(isCorrectQuizAnswer(precedence, user), web.isCorrectQuizAnswer(precedence, user))
})
test('Quiz JSON normalization matches web casing, aliases, object wrappers and optional metadata', () => {
  const cases: unknown[] = [question(), [question()], { questions: [question()] }, [{ Question: ' 犬? ', A: 'chó', B: 'mèo', C: 'cá', D: 'chim', 'Correct Answer': 'A)', Explanation: '犬', jlpt: 'N5', Category: 'Animals' }]]
  for (const input of cases) assert.equal(JSON.stringify(normalizeQuizQuestions(input)), JSON.stringify(webUpload(input)))
  // Preserve web behavior: "option_a" currently normalizes to O and is rejected.
  for (const answer of ['option_a', '', '2', 'invalid']) {
    const input = [{ ...question(), answer }]
    assert.throws(() => webUpload(input)); assert.throws(() => normalizeQuizQuestions(input))
  }
})
test('shuffling preserves answer identity, explanation, original data and all question membership', () => {
  for (const answer of ['B', 'b.', 'B) mèo', 'Mèo']) for (let n = 0; n < 12; n++) {
    const original = { ...question(), answer }, before = JSON.stringify(original)
    const result = shuffleQuestion(original, () => n / 12)
    assert.equal(result.options.find((_, i) => isQuizChoiceCorrect(result, getOptionKey(i))), 'Mèo')
    assert.equal(result.explanation, original.explanation); assert.equal(JSON.stringify(original), before)
  }
  const data = [1, 2, 3, 4]; assert.deepEqual(shuffled(data).sort(), data); assert.deepEqual(data, [1, 2, 3, 4])
  const duplicate = shuffleQuestion({ ...question(), options: ['Mèo', 'Mèo', 'Cá', 'Chim'], answer: 'Mèo' }, () => 0)
  assert.equal(duplicate.options.filter((_, i) => isQuizChoiceCorrect(duplicate, getOptionKey(i))).length, 2)
  const letters = shuffleQuestion({ ...question(), options: ['A', 'B', 'C', 'D'], answer: 'B' }, () => 0)
  assert.equal(letters.options.filter((_, i) => isQuizChoiceCorrect(letters, getOptionKey(i))).length, 1)
  assert.equal(letters.options.find((_, i) => isQuizChoiceCorrect(letters, getOptionKey(i))), 'B')
})
test('manual validation requires name, question, four options and a chosen answer; flashcards require two sides', () => {
  assert.equal(validateManual({ ...quiz(), name: '  Test  ' }).name, 'Test')
  assert.throws(() => validateManual({ ...quiz(), name: ' ' }), hasKey('nameRequired'))
  assert.throws(() => validateManual({ ...quiz(), questions: [{ ...question(), question: ' ' }] }), hasKey('rowQuestion'))
  assert.throws(() => validateManual({ ...quiz(), questions: [{ ...question(), options: ['a', '', 'c', 'd'] }] }), hasKey('rowOptions'))
  assert.throws(() => validateManual({ ...quiz(), questions: [{ ...question(), answer: '' }] }), hasKey('rowAnswer'))
  assert.throws(() => validateManual({ ...quiz(), questions: [] }), hasKey('emptyData'))
  assert.throws(() => validateManual({ ...flash(), cards: [{ front: '猫', back: ' ' }] }), hasKey('rowCard'))
  assert.equal(normalizeCards({ cards: [{ front: ' 猫 ', back: ' mèo ' }] })[0].back, 'mèo')
  assert.throws(() => normalizeQuizQuestions([{ ...question(), options: ['a', 'b', 'c', 'd', 'e'] }]), hasKey('rowFour'))
  assert.throws(() => normalizeQuizQuestions(Array.from({ length: MAX_ITEMS + 1 }, question)), hasKey('tooManyItems'))
  assert.throws(() => normalizeCards([{ front: 'x'.repeat(10001), back: 'x' }]), hasKey('textTooLong'))
})
test('file rules match web extensions, enforce size, and JSON is parsed without a server', () => {
  for (const kind of ['quiz', 'flashcard'] as const) for (const ext of ['xlsx', 'XLS', 'json']) validateFile(`test.${ext}`, 512, kind)
  validateFile('cards.csv', 10, 'flashcard')
  assert.throws(() => validateFile('quiz.csv', 10, 'quiz'), hasKey('fileType'))
  assert.throws(() => validateFile('q.exe', 10, 'quiz'), hasKey('fileType'))
  assert.throws(() => validateFile('q.xlsx', undefined, 'quiz'), hasKey('fileSizeUnknown'))
  assert.throws(() => validateFile('q.xlsx', MAX_FILE_BYTES + 1, 'quiz'), hasKey('fileTooLarge'))
  assert.throws(() => validateFile('q.json', 1024 * 1024 + 1, 'quiz'), hasKey('jsonTooLarge'))
  assert.throws(() => parseQuizJson('{'), hasKey('invalidJson'))
  assert.throws(() => parseQuizJson('[]'), hasKey('emptyData'))
  assert.equal(parseQuizJson(JSON.stringify([question()]))[0].question, question().question)
  assert.equal(utf8Bytes('猫 mèo 😀'), Buffer.byteLength('猫 mèo 😀'))
})
test('import errors retain authoritative Excel row numbers and handle timeout, offline and validation detail arrays', () => {
  const issues = importIssues({ response: { status: 400, data: { detail: 'Invalid file format: Row 2: Missing question; Row 4: Missing options, Invalid correct answer' } } })
  assert.equal(issues.length, 2); assert.equal(issues[0].raw, 'Row 2: Missing question'); assert.match(issues[1].raw!, /^Row 4:/)
  assert.equal(importIssues({ response: { status: 400, data: { detail: 'Invalid flashcard file: Missing required columns: front, back' } } })[0].raw, 'Missing required columns: front, back')
  assert.equal(importIssues({ code: 'ECONNABORTED' })[0].key, 'timeout')
  assert.equal(importIssues({ code: 'ERR_CANCELED' })[0].key, 'cancelled')
  assert.equal(importIssues(new Error('network'))[0].key, 'networkError')
  assert.equal(importIssues({ response: { status: 401 } })[0].key, 'unauthorized')
  assert.equal(importIssues({ response: { status: 422, data: { detail: [{ msg: 'Invalid file' }] } } })[0].raw, 'Invalid file')
})
test('versioned storage isolates two accounts and does not delete local sets on sign-out', async () => {
  const { store, data } = memory(), set = quiz()
  await store.save(1, set); await store.save(2, flash())
  assert.equal((await store.read(1)).sets[0].kind, 'quiz'); assert.equal((await store.read(2)).sets[0].kind, 'flashcard')
  assert.equal((await store.read(3)).sets.length, 0)
  assert.equal(JSON.parse(data.get(studyStorageKey(1))!).version, 1)
  const reopened = new StudyStore(memoryAdapter(data)); assert.equal((await reopened.read(1)).sets[0].id, set.id)
  await store.reset(1); assert.equal((await store.read(1)).sets.length, 0); assert.equal((await store.read(2)).sets.length, 1)
})
function memoryAdapter(data: Map<string, string>): KeyValueStorage { return { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value) }, removeItem: async key => { data.delete(key) } } }
test('corrupt, malformed, oversized and future storage is safe to read and never implicitly overwritten', async () => {
  const { store, data } = memory()
  for (const raw of ['{', 'null', '{"version":1,"sets":[{}]}', JSON.stringify({ version: 2, sets: [] }), 'x'.repeat(MAX_STORAGE_BYTES + 1)]) {
    data.set(studyStorageKey(1), raw)
    assert.equal((await store.read(1)).writable, false); assert.equal((await store.read(1)).sets.length, 0)
    await assert.rejects(store.save(1, quiz())); assert.equal(data.get(studyStorageKey(1)), raw)
  }
  const failed = new StudyStore({ getItem: async () => { throw new Error('disk') }, setItem: async () => { throw new Error('disk') }, removeItem: async () => { throw new Error('disk') } })
  assert.equal((await failed.read(1)).warning, 'storageUnavailable'); await assert.rejects(failed.save(1, quiz()), hasKey('storageUnavailable'))
})
test('serialized writes keep concurrent sets; rename, duplicate, stats and deletion stay within the account', async () => {
  const { store } = memory(), a = quiz(), b = flash()
  await Promise.all([store.save(1, a), store.save(1, b)])
  assert.equal((await store.read(1)).sets.length, 2)
  await store.rename(1, a.id, 'Renamed'); await store.duplicate(1, a.id, 'Copy')
  assert.equal((await store.read(1)).sets.length, 3)
  await store.record(1, b.id, true); await store.record(1, b.id, true); await store.record(1, b.id, false); await store.finish(1, b.id, 67)
  const saved = (await store.read(1)).sets.find(set => set.id === b.id)!
  assert.deepEqual(saved.stats, { correct: 2, wrong: 1, streak: 0, accuracy: 67 }); assert.equal(saved.last_accuracy, 67)
  await store.remove(1, a.id); assert.equal((await store.read(1)).sets.length, 2)
})
test('storage count and byte quotas reject writes without losing existing data', async () => {
  const { store, data } = memory()
  for (let i = 0; i < MAX_SETS; i++) await store.save(1, { ...quiz(), id: String(i) })
  const original = data.get(studyStorageKey(1))
  await assert.rejects(store.save(1, quiz()), hasKey('tooManySets')); assert.equal(data.get(studyStorageKey(1)), original)
  const huge = { ...flash(), cards: Array.from({ length: MAX_ITEMS }, () => ({ front: '猫'.repeat(1000), back: 'mèo'.repeat(1000) })) }
  await assert.rejects(store.save(2, huge), hasKey('storageFull')); assert.equal(data.has(studyStorageKey(2)), false)
})
test('failed local writes retain previous sets; retrying the same set never creates duplicates', async () => {
  const { store, data } = memory(), set = quiz()
  await store.save(1, set)
  const before = data.get(studyStorageKey(1))
  const fullDisk = new StudyStore({ ...memoryAdapter(data), setItem: async () => { throw new Error('full') } })
  await assert.rejects(fullDisk.save(1, { ...set, name: 'Changed' }), hasKey('storageUnavailable'))
  assert.equal(data.get(studyStorageKey(1)), before)
  await Promise.all([store.save(1, set), store.save(1, set)])
  assert.equal((await store.read(1)).sets.length, 1)
})
test('phase4 calls only the two import APIs and supports explicit cancellation and timeout', () => {
  const api = readFileSync(new URL('../src/api/studyImport.ts', import.meta.url), 'utf8')
  assert.match(api, /\/game\/quiz\/upload/); assert.match(api, /\/game\/flashcard\/import/)
  assert.doesNotMatch(api, /\/game\/(quiz|flashcard)\/(create|submit)/)
  assert.match(api, /timeout: 45000/); assert.match(api, /signal/)
})
