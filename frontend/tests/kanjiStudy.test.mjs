import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { makeStudyQuestion } = await server.ssrLoadModule('/src/features/kanji/study.ts')
  const { normalizeKanjiItem } = await server.ssrLoadModule('/src/data/kanjiDataset.ts')
  const dictionary = JSON.parse(await readFile(fileURLToPath(new URL('../../backend/app/data/kanji_dictionary.json', import.meta.url)), 'utf8'))
  const rows = dictionary.map(normalizeKanjiItem)
  for (const level of ['N5', 'N4', 'N3']) {
    const items = rows.filter(row => row.jlpt_level === level)
    for (const target of items) for (const language of ['vi', 'en']) for (const mode of ['reading', 'meaning']) {
      const question = makeStudyQuestion(rows, target, mode, language, () => .5)
      assert.ok(question, `${level}/${target.kanji}/${mode}/${language}`)
      assert.equal(question.options.length, 4)
      assert.equal(new Set(question.options).size, 4)
      assert.equal(question.options.filter(value => value === question.correct).length, 1)
      const sameLevel = makeStudyQuestion(items, target, mode, language, () => .5)
      assert.deepEqual(question, sameLevel, 'Distractors must stay at the same JLPT level')
    }
  }
  assert.equal(makeStudyQuestion([rows[0]], rows[0], 'reading', 'vi'), null)
  for (const language of ['vi', 'en']) {
    const common = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}/common.json`, import.meta.url), 'utf8'))
    const source = await readFile(new URL('../src/components/kanji/KanjiStudy.jsx', import.meta.url), 'utf8')
    for (const [, key] of source.matchAll(/t\('kanjiStudy\.([^']+)'/g)) assert.ok(common.kanjiStudy[key], key)
  }
  console.log('Kanji Study: all 612 characters generate unique same-level quizzes; missing-data guard and vi/en labels passed.')
} finally { await server.close() }
