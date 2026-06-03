import assert from 'node:assert/strict'
import { isCorrectQuizAnswer } from '../src/utils/quizAnswers.js'

const question = {
  question: 'いつ食べますか。',
  options: ['ご飯を食べる前', 'ご飯を食べた後', '学校へ行く', '水を飲む'],
}

assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'A' }, 'A'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'A' }, 'a'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'A' }, 'A.'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'A' }, 'ご飯を食べる前'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'ご飯を食べる前' }, 'A'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'A. ご飯を食べる前' }, 'A)'), true)
assert.equal(isCorrectQuizAnswer({ ...question, correct_answer: 'B' }, 'A'), false)

console.log('quiz answer validation tests passed')
