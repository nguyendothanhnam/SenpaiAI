import { normalizeAnswer } from './quizAnswers'
import type { FlashCard, QuizQuestion, StudyKind, StudySet } from './types'

export const MAX_ITEMS = 500
export const MAX_FIELD = 10000
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_JSON_BYTES = 1024 * 1024
export class StudyError extends Error {
  constructor(public key: string, public values: Record<string, string | number> = {}) { super(key) }
}
export function utf8Bytes(value: string) {
  let size = 0
  for (const char of value) { const n = char.codePointAt(0)!; size += n <= 0x7f ? 1 : n <= 0x7ff ? 2 : n <= 0xffff ? 3 : 4 }
  return size
}
export function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function readValue(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (item[key] !== undefined && item[key] !== null) return String(item[key]).trim()
  return ''
}
function list(data: unknown, key: string, single: string): unknown[] {
  if (Array.isArray(data)) return data
  const record = asRecord(data)
  if (Array.isArray(record[key])) return record[key] as unknown[]
  return record[single] ? [record] : []
}
function checkCount(items: unknown[]) {
  if (!items.length) throw new StudyError('emptyData')
  if (items.length > MAX_ITEMS) throw new StudyError('tooManyItems', { count: MAX_ITEMS })
}
export function checkText(value: string) { if (value.length > MAX_FIELD) throw new StudyError('textTooLong', { count: MAX_FIELD }) }

// Same names, precedence and answer alias behavior as QuizUpload.jsx, including
// its treatment of option_a aliases. Server Excel parsing has its own rules.
export function normalizeQuizQuestions(data: unknown): QuizQuestion[] {
  const items = list(data, 'questions', 'question'); checkCount(items)
  return items.map((value, index) => {
    const item = asRecord(value)
    const question = readValue(item, ['question', 'Question', 'QUESTION'])
    const options = Array.isArray(item.options) ? item.options.map(option => String(option || '').trim()) : ['a', 'b', 'c', 'd'].map(key => readValue(item, [`option_${key}`, `option${key.toUpperCase()}`, `Option ${key.toUpperCase()}`, key.toUpperCase()]))
    const raw = readValue(item, ['correct_answer', 'correctAnswer', 'Correct Answer', 'answer', 'correct'])
    const normalized = normalizeAnswer(raw), alias = normalized.toLowerCase().replace(/[\s_]/g, '')
    const prefixed = ['A', 'B', 'C', 'D'].find(key => normalized.startsWith(`${key} `))
    const answer = ['a', 'optiona', 'b', 'optionb', 'c', 'optionc', 'd', 'optiond'].includes(alias) ? normalized[0] : prefixed || raw
    if (!question) throw new StudyError('rowQuestion', { row: index + 1 })
    if (options.length < 4 || options.some(option => !option)) throw new StudyError('rowOptions', { row: index + 1 })
    if (!answer || (!['A', 'B', 'C', 'D'].includes(normalizeAnswer(answer)) && !options.includes(answer))) throw new StudyError('rowAnswer', { row: index + 1 })
    if (options.length !== 4) throw new StudyError('rowFour', { row: index + 1 })
    const result = { question, options, answer, correct_answer: answer, explanation: readValue(item, ['explanation', 'Explanation']), jlpt_level: readValue(item, ['jlpt_level', 'jlptLevel', 'JLPT Level', 'jlpt']), category: readValue(item, ['category', 'Category']) }
    for (const text of [question, ...options, ...Object.values(result).filter((v): v is string => typeof v === 'string')]) checkText(text)
    return result
  })
}
export function normalizeCards(data: unknown): FlashCard[] {
  const items = list(data, 'cards', 'front'); checkCount(items)
  return items.map((value, index) => {
    const item = asRecord(value)
    const front = readValue(item, ['front']), back = readValue(item, ['back'])
    if (!front || !back) throw new StudyError('rowCard', { row: index + 1 })
    const card = { front, back, jlpt_level: readValue(item, ['jlpt_level', 'jlptLevel', 'jlpt']), category: readValue(item, ['category']) }
    Object.values(card).forEach(checkText)
    return card
  })
}
export function validateManual(set: StudySet): StudySet {
  if (!set.name.trim()) throw new StudyError('nameRequired')
  if (set.name.trim().length > 120) throw new StudyError('nameTooLong')
  checkText(set.category)
  if (set.jlpt_level && !['N1', 'N2', 'N3', 'N4', 'N5', 'Mixed'].includes(set.jlpt_level)) throw new StudyError('invalidLevel')
  if (set.kind === 'flashcard') return { ...set, name: set.name.trim(), category: set.category.trim(), cards: normalizeCards(set.cards) }
  checkCount(set.questions)
  // Manual web requires nonblank text, 4 nonblank options and a nonblank answer.
  // Answer matching is enforced by choosing an option instead of free typing.
  for (const [index, question] of set.questions.entries()) {
    if (!question.question.trim()) throw new StudyError('rowQuestion', { row: index + 1 })
    if (question.options.length !== 4 || question.options.some(o => !o.trim())) throw new StudyError('rowOptions', { row: index + 1 })
    if (!question.answer.trim()) throw new StudyError('rowAnswer', { row: index + 1 })
  }
  return { ...set, name: set.name.trim(), category: set.category.trim(), questions: normalizeQuizQuestions(set.questions.map(q => ({ ...q, correct_answer: q.answer.trim() }))) }
}
export function validateFile(name: string, size: number | undefined, kind: StudyKind) {
  const extension = name.split('.').pop()?.toLowerCase()
  if (!(kind === 'quiz' ? ['xlsx', 'xls', 'json'] : ['xlsx', 'xls', 'csv', 'json']).includes(extension || '')) throw new StudyError('fileType')
  if (size === undefined || !Number.isFinite(size) || size < 0) throw new StudyError('fileSizeUnknown')
  if (size > MAX_FILE_BYTES) throw new StudyError('fileTooLarge', { count: 5 })
  if (extension === 'json' && size > MAX_JSON_BYTES) throw new StudyError('jsonTooLarge')
}
export function parseQuizJson(text: string) {
  if (utf8Bytes(text) > MAX_JSON_BYTES) throw new StudyError('jsonTooLarge')
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new StudyError('invalidJson') }
  return normalizeQuizQuestions(data)
}
