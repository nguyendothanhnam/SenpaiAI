import type { KanjiPage, KanjiQuestion } from '../../api/phase3Types'
import { hasTheme } from '../shop/catalog'
export function kanjiNextPage(page: KanjiPage): number | undefined {
  const next = page.offset + page.items.length
  return page.items.length > 0 && next < page.total ? next : undefined
}
export function quizScore(questions: KanjiQuestion[], answers: (string | undefined)[]) {
  return questions.reduce((score, q, index) => score + Number(answers[index] === q.correct_answer), 0)
}
export const isSupportedTheme = hasTheme
