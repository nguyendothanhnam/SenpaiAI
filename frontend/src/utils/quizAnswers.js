const OPTION_KEYS = ['A', 'B', 'C', 'D']

export function normalizeAnswer(answer) {
  return String(answer)
    .trim()
    .toUpperCase()
    .replace('.', '')
    .replace(')', '')
}

export function normalizeText(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
}

export function getOptionKey(index) {
  return OPTION_KEYS[index] || ''
}

export function getQuestionOptions(question) {
  return Array.isArray(question?.options) ? question.options : []
}

export function getQuestionCorrectAnswer(question) {
  return question?.correct_answer || question?.answer || question?.correct || question?.correctAnswer || ''
}

export function getAnswerTextByKey(question, key) {
  const normalizedKey = normalizeAnswer(key)
  const index = OPTION_KEYS.indexOf(normalizedKey)
  if (index < 0) {
    return ''
  }

  return getQuestionOptions(question)[index] || ''
}

export function getAnswerKeyByText(question, answerText) {
  const normalized = normalizeText(answerText)
  const index = getQuestionOptions(question).findIndex((option) => normalizeText(option) === normalized)
  return getOptionKey(index)
}

export function isCorrectQuizAnswer(question, userAnswer) {
  const selected = normalizeAnswer(userAnswer)
  const correctAnswer = getQuestionCorrectAnswer(question)
  const correct = normalizeAnswer(correctAnswer)

  if (OPTION_KEYS.includes(correct)) {
    if (selected === correct) {
      return true
    }

    return normalizeText(userAnswer) === normalizeText(getAnswerTextByKey(question, correct))
  }

  if (correct.startsWith('A ')) return selected === 'A'
  if (correct.startsWith('B ')) return selected === 'B'
  if (correct.startsWith('C ')) return selected === 'C'
  if (correct.startsWith('D ')) return selected === 'D'

  if (OPTION_KEYS.includes(selected)) {
    return normalizeText(getAnswerTextByKey(question, selected)) === normalizeText(correctAnswer)
  }

  return normalizeText(userAnswer) === normalizeText(correctAnswer)
}
