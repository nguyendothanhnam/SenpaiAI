import type { DailyAnswerResult, DailyItem, DailyOverview } from '../../api/types'

export function detailCode(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return detail && typeof detail === 'object' && 'code' in detail ? String(detail.code) : undefined
}
export function dailyStateError(code: string): Error {
  return Object.assign(new Error(code), { response: { status: 409, data: { detail: { code } } } })
}
export function nextUnanswered(task: DailyOverview) { return task.items.find((item) => !item.answered) }
export function mixedLevels(task: DailyOverview, userLevel: string | undefined) {
  return task.items.some((item) => (item.payload.level || item.payload.jlpt_level) && (item.payload.level || item.payload.jlpt_level) !== userLevel)
}
export function resultFromItem(task: DailyOverview, item: DailyItem): DailyAnswerResult {
  return { is_correct: item.is_correct === true, correct_answer: item.correct_answer, explanation: item.explanation ?? '', examples: item.examples ?? [], all_answered: task.progress.all_answered }
}
export function toggleToken(indexes: number[], index: number) {
  return indexes.includes(index) ? indexes.filter((value) => value !== index) : [...indexes, index]
}
export function elapsedAnswerTime(startedAt: number, now: number) {
  return Math.min(3600000, Math.max(0, Math.round(now - startedAt)))
}
