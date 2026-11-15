import type { QuizQuestion } from './types'

// Port of frontend/src/utils/quizAnswers.js. Keep precedence and text matching.
const OPTION_KEYS = ['A', 'B', 'C', 'D']
export function normalizeAnswer(answer: unknown) { return String(answer).trim().toUpperCase().replace('.', '').replace(')', '') }
export function normalizeText(value: unknown) { return String(value).trim().replace(/\s+/g, ' ').toLowerCase() }
export function getOptionKey(index: number) { return OPTION_KEYS[index] || '' }
type QuestionLike = Partial<QuizQuestion> & { correct?: string; correctAnswer?: string }
export function getQuestionOptions(question?: QuestionLike) { return Array.isArray(question?.options) ? question.options : [] }
export function getQuestionCorrectAnswer(question?: QuestionLike) { return question?.correct_answer || question?.answer || question?.correct || question?.correctAnswer || '' }
export function getAnswerTextByKey(question: QuestionLike, key: unknown) {
  const index = OPTION_KEYS.indexOf(normalizeAnswer(key))
  return index < 0 ? '' : getQuestionOptions(question)[index] || ''
}
export function getAnswerKeyByText(question: QuestionLike, text: unknown) { return getOptionKey(getQuestionOptions(question).findIndex(option => normalizeText(option) === normalizeText(text))) }
export function isCorrectQuizAnswer(question: QuestionLike, userAnswer: unknown) {
  const selected = normalizeAnswer(userAnswer), answer = getQuestionCorrectAnswer(question), correct = normalizeAnswer(answer)
  if (OPTION_KEYS.includes(correct)) return selected === correct || normalizeText(userAnswer) === normalizeText(getAnswerTextByKey(question, correct))
  for (const key of OPTION_KEYS) if (correct.startsWith(`${key} `)) return selected === key
  if (OPTION_KEYS.includes(selected)) return normalizeText(getAnswerTextByKey(question, selected)) === normalizeText(answer)
  return normalizeText(userAnswer) === normalizeText(answer)
}
export function isQuizChoiceCorrect(question: QuizQuestion, key: string) {
  // A shuffled session retains the original web verdict for each option.
  // Regrading remapped letter answers against letter-valued option TEXT can
  // otherwise introduce an extra correct choice through the web's fallback.
  return question.choice_correct ? question.choice_correct[['A', 'B', 'C', 'D'].indexOf(key)] === true : isCorrectQuizAnswer(question, key)
}

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
// Resolve the original key BEFORE rearranging options. Never shuffle a letter answer as text.
export function shuffleQuestion(question: QuizQuestion, random: () => number = Math.random): QuizQuestion {
  const options = shuffled(question.options.map((text, index) => ({ text, correct: isQuizChoiceCorrect(question, getOptionKey(index)) })), random)
  const key = getOptionKey(options.findIndex(option => option.correct))
  return { ...question, options: options.map(option => option.text), answer: key, correct_answer: key, choice_correct: options.map(option => option.correct) }
}
export function correctAnswerText(question: QuizQuestion) {
  return question.options.filter((_, index) => isQuizChoiceCorrect(question, getOptionKey(index))).join(' / ')
}
