import assert from 'node:assert/strict'
import test from 'node:test'
import type { DailyItem, DailyOverview, DailyAnswerResult } from '../src/api/types'
import { DailySubmission } from '../src/features/daily/submission'
import { elapsedAnswerTime, mixedLevels, nextUnanswered, toggleToken } from '../src/features/daily/logic'
import { formatCountdown, recentServerDates, remainingToServerMidnight } from '../src/utils/date'

const item: DailyItem = { id: 1, position: 1, item_type: 'grammar', question_type: 'fill_blank', payload: { options: ['は', 'が'], level: 'N4' }, answered: false }
const task = (): DailyOverview => ({ task_id: 12, date: '2026-11-05', status: 'in_progress', items: [{ ...item }], progress: { total_items: 1, answered_items: 0, correct_count: 0, all_answered: false } })
const result: DailyAnswerResult = { is_correct: true, correct_answer: 'は', explanation: '説明', all_answered: true }

test('all daily answer types preserve the server contract without client grading', async () => {
  const cases = [
    ['grammar', 'fill_blank', 'は'], ['grammar', 'reorder', ['私', 'は', '学生', 'です']],
    ['grammar', 'true_false', false], ['grammar', 'conjugation', '食べました'],
    ['kanji', 'kanji_reading', 'ひと'], ['vocab', 'vocab_meaning', 'person'], ['flashcard', 'self_recall', true],
  ] as const
  for (const [kind, type, answer] of cases) {
    const current = task()
    current.items[0] = { ...item, item_type: kind, question_type: type }
    const sent: unknown[] = []
    const submission = new DailySubmission({ today: async () => current, answer: async (id, value, time) => { sent.push({ id, value, time }); return result } })
    assert.deepEqual(await submission.submit(current, 1, answer, 4321), result)
    assert.deepEqual(sent, [{ id: 1, value: answer, time: 4321 }])
  }
})

test('repeated taps share a single pending answer request', async () => {
  const current = task()
  let posts = 0
  const submission = new DailySubmission({ today: async () => current, answer: async () => { posts++; await new Promise((resolve) => setTimeout(resolve, 10)); return result } })
  await Promise.all([submission.submit(current, 1, 'は', 100), submission.submit(current, 1, 'は', 100)])
  assert.equal(posts, 1)
})

test('lost answer response recovers persisted feedback without sending again', async () => {
  let stored = task()
  let posts = 0
  const submission = new DailySubmission({ today: async () => stored, answer: async () => {
    posts++
    stored = { ...stored, items: [{ ...item, answered: true, is_correct: true, correct_answer: 'は', explanation: '説明' }], progress: { total_items: 1, answered_items: 1, correct_count: 1, all_answered: true } }
    throw new Error('response lost')
  } })
  const expected = { ...result, examples: [] }
  assert.deepEqual(await submission.submit(task(), 1, 'は', 100), expected)
  assert.deepEqual(await submission.submit(task(), 1, 'は', 100), expected)
  assert.equal(posts, 1)
})

test('offline preflight and an expired task cannot post an answer', async () => {
  let posts = 0
  const offline = new DailySubmission({ today: async () => { throw new Error('offline') }, answer: async () => { posts++; return result } })
  await assert.rejects(offline.submit(task(), 1, 'は', 1))
  const expired = new DailySubmission({ today: async () => ({ ...task(), task_id: 13, date: '2026-11-06' }), answer: async () => { posts++; return result } })
  await assert.rejects(expired.submit(task(), 1, 'は', 1), /task_expired/)
  assert.equal(posts, 0)
})

test('resume chooses the first unanswered server item; duplicate tokens retain identity', () => {
  const current = task()
  current.items = [{ ...item, answered: true }, { ...item, id: 2, position: 2 }]
  assert.equal(nextUnanswered(current)?.id, 2)
  assert.equal(mixedLevels(current, 'N5'), true)
  assert.deepEqual(toggleToken(toggleToken([], 1), 2), [1, 2])
  assert.deepEqual(toggleToken([1, 2], 1), [2])
  assert.equal(elapsedAnswerTime(100, 300), 200)
  assert.equal(elapsedAnswerTime(100, 50), 0)
  assert.equal(elapsedAnswerTime(0, 4000000), 3600000)
})

test('calendar uses server dates and countdown reaches midnight in UTC+07', () => {
  assert.deepEqual(recentServerDates('2026-01-02', 3), ['2025-12-31', '2026-01-01', '2026-01-02'])
  const now = Date.parse('2026-11-05T16:59:30Z')
  assert.equal(remainingToServerMidnight('2026-11-05', now, 1000, 1000), 30000)
  assert.equal(remainingToServerMidnight('2026-11-05', now, 1000, 31000), 0)
  assert.equal(remainingToServerMidnight('2026-11-05', undefined, 1000, 1000), null)
  assert.equal(formatCountdown(30000), '00:00:30')
})
