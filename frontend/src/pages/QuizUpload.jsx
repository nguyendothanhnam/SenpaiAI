import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadQuiz } from '../services/api.js'
import { saveQuizSet } from '../utils/storage.js'
import { normalizeAnswer } from '../utils/quizAnswers.js'

function normalizeQuizQuestions(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.questions)) {
    return data.questions
  }

  if (data?.question) {
    return [data]
  }

  return []
}

function readValue(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return String(item[key]).trim()
    }
  }
  return ''
}

function normalizeQuestion(item, index) {
  const question = readValue(item, ['question', 'Question', 'QUESTION'])
  const options = Array.isArray(item?.options)
    ? item.options.map((option) => String(option || '').trim())
    : [
        readValue(item, ['option_a', 'optionA', 'Option A', 'A']),
        readValue(item, ['option_b', 'optionB', 'Option B', 'B']),
        readValue(item, ['option_c', 'optionC', 'Option C', 'C']),
        readValue(item, ['option_d', 'optionD', 'Option D', 'D']),
      ]
  const answerRaw = readValue(item, ['correct_answer', 'correctAnswer', 'Correct Answer', 'answer', 'correct'])
  const answerAliases = { a: 0, optiona: 0, b: 1, optionb: 1, c: 2, optionc: 2, d: 3, optiond: 3 }
  const normalizedAnswer = normalizeAnswer(answerRaw)
  const alias = normalizedAnswer.toLowerCase().replace(/[\s_]/g, '')
  const prefixedLetter = ['A', 'B', 'C', 'D'].find((key) => normalizedAnswer.startsWith(`${key} `))
  const answer = alias in answerAliases ? normalizedAnswer[0] : prefixedLetter || answerRaw
  const errors = []

  if (!question) {
    errors.push('Missing question')
  }
  if (options.length < 4 || options.some((option) => !option)) {
    errors.push('Missing options')
  }
  if (!answer || (!['A', 'B', 'C', 'D'].includes(normalizeAnswer(answer)) && !options.includes(answer))) {
    errors.push('Invalid correct answer')
  }
  if (errors.length) {
    throw new Error(`Row ${index + 1}: ${errors.join(', ')}`)
  }

  return {
    question,
    options,
    answer,
    correct_answer: answer,
    explanation: readValue(item, ['explanation', 'Explanation']),
    jlpt_level: readValue(item, ['jlpt_level', 'jlptLevel', 'JLPT Level', 'jlpt']),
    category: readValue(item, ['category', 'Category']),
  }
}

function normalizeAndValidateQuestions(data) {
  return normalizeQuizQuestions(data).map(normalizeQuestion)
}

export default function QuizUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const parseJsonFile = async (selectedFile) => {
    const text = await selectedFile.text()
    const parsed = JSON.parse(text)
    const questions = normalizeAndValidateQuestions(parsed)

    if (!questions.length) {
      throw new Error('JSON has no valid quiz questions.')
    }

    return questions
  }

  const handleUpload = async (event) => {
    event.preventDefault()

    if (!file) {
      setError('Please choose a file first.')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccessMsg('')

    try {
      const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json'
      const questions = isJson
        ? await parseJsonFile(file)
        : normalizeAndValidateQuestions((await uploadQuiz(file)).data)

      if (!questions.length) {
        throw new Error('No valid quiz questions found in uploaded file.')
      }

      const quizSet = saveQuizSet({
        title: file.name.replace(/\.[^.]+$/, ''),
        questions,
        source: 'uploaded',
        fileName: file.name,
      })

      setSuccessMsg(`Successfully loaded ${questions.length} question(s).`)
      setTimeout(() => {
        navigate('/quiz/play', { state: { quizSet } })
      }, 500)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Upload failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 px-6 py-8 text-white">
        <h1 className="text-3xl font-semibold">Upload Quiz File</h1>
        <p className="mt-2 text-sm text-white/90">Upload Excel or JSON and save it as a quiz set.</p>
      </div>

      <form onSubmit={handleUpload} className="space-y-5 px-6 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMsg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
          <label className="mb-3 block text-sm font-medium text-gray-700">Choose file</label>
          <input
            type="file"
            accept=".xlsx,.xls,.json"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
          />
          <p className="mt-3 text-xs text-gray-500">Supported columns: question, option_a-d, correct_answer, explanation, jlpt_level, category.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Uploading...' : 'Upload And Play'}
        </button>
      </form>
    </motion.div>
  )
}
