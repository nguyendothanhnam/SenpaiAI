import assert from 'node:assert/strict'
import test from 'node:test'
import { groupConversations, nearestLevel, publicSources, relativeTime, timeGroup, unique } from '../src/features/phase2/logic'
import type { Conversation, Pattern } from '../src/api/phase2'
import vi from '../src/i18n/locales/vi.json'
import en from '../src/i18n/locales/en.json'
import { GrammarSubmission } from '../src/features/phase2/grammarSubmission'

const pattern: Pattern = { id: 1, rule_name: 'test', japanese_pattern: 'は', meaning: '', question_counts: { fill_blank: 1, reorder: 0, true_false: 0, conjugation: 0 } }
test('grammar fallback selects the nearest populated bank; empty levels cannot start', () => {
  assert.equal(nearestLevel('N1', { N5: [pattern], N3: [pattern] }), 'N3')
  assert.equal(nearestLevel('N4', { N5: [pattern], N3: [pattern] }), 'N5')
  assert.equal(nearestLevel('N2', { N2: [{ ...pattern, question_counts: { fill_blank: 0, reorder: 0, true_false: 0, conjugation: 0 } }] }), undefined)
})
test('chat never displays internal sources but retains library document identities', () => {
  assert.deepEqual(publicSources([{ type: 'internal_prompt', title: 'secret' }, { type: 'deterministic_chat' }, { title: 'Intent rules' }, { title: 'Lesson', document_id: 7 }]), [{ title: 'Lesson', document_id: 7 }])
})
test('conversation grouping respects local calendar days, pin and folder precedence', () => {
  const now = new Date('2026-11-05T12:00:00Z')
  assert.equal(timeGroup('2026-11-05T01:00:00Z', now), 'today')
  assert.equal(timeGroup('2026-09-01T00:00:00Z', now), 'older')
  const item: Conversation = { id: 'a', title: '', folder_id: 'b', is_pinned: true, mode: 'text', last_activity_at: now.toISOString() }
  assert.equal(groupConversations([item], now)[0].group, 'pinned')
  assert.equal(groupConversations([{ ...item, is_pinned: false }], now)[0].group, 'folder:b')
})
test('offset pages deduplicate overlapping IDs without removing repeated text', () => {
  assert.deepEqual(unique([{ id: 2, answer: 'same' }, { id: 1, answer: 'same' }, { id: 2, answer: 'updated' }]), [{ id: 2, answer: 'updated' }, { id: 1, answer: 'same' }])
})
test('relative time uses translation keys without requiring Intl.RelativeTimeFormat', () => {
  assert.equal(relativeTime('2026-11-05T10:00:00Z', (key, values) => `${key}:${values?.count}`, Date.parse('2026-11-05T12:00:00Z')), 'phase2.hoursAgo:2')
})
test('phase2 Vietnamese content remains Unicode and every key has an English counterpart', () => {
  assert.deepEqual(Object.keys(vi.phase2).sort(), Object.keys(en.phase2).sort())
  assert.equal(vi.phase2.grammar, 'Ngữ pháp')
  assert.ok(vi.phase2.starter1.includes('は'))
  assert.ok(!Object.values(vi.phase2).some(s => s.includes('??')))
})

test('grammar rapid taps share a request and successful answers are never submitted twice', async () => {
  let posts = 0
  const response = { is_correct: true, correct_answer: 'は', explanation_vi: 'Giải thích', examples: [] }
  const submission = new GrammarSubmission(async () => { posts++; await new Promise(resolve => setTimeout(resolve, 10)); return response })
  assert.deepEqual(await Promise.all([submission.submit(1, 'は', 100), submission.submit(1, 'が', 200)]), [response, response])
  await submission.submit(1, 'が', 400)
  assert.equal(posts, 1)
})
test('grammar unknown delivery blocks resending even when the network returns later', async () => {
  let posts = 0
  const submission = new GrammarSubmission(async () => { posts++; throw new Error('response lost after commit') })
  await assert.rejects(submission.submit(1, true, 100))
  await assert.rejects(submission.submit(1, true, 100), /uncertain_grammar_answer/)
  assert.equal(posts, 1)
})
test('grammar definitive validation rejection allows a corrected answer', async () => {
  let posts = 0
  const submission = new GrammarSubmission(async () => { if (++posts === 1) throw { response: { status: 422 } }; return { is_correct: true, correct_answer: false, explanation_vi: '', examples: [] } })
  await assert.rejects(submission.submit(1, 'invalid', 100))
  assert.equal((await submission.submit(1, false, 200)).is_correct, true)
  assert.equal(posts, 2)
})
