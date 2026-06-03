import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { createQuiz } from '../services/api.js'
import { saveQuizSet } from '../utils/storage.js'

const initialQuestion = { question: '', options: ['', '', '', ''], answer: '' }

export default function QuizManual() {
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([
    { question: '', options: ['', '', '', ''], answer: '' },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const isDisabled = useMemo(() => {
    return (
      questions.length === 0 ||
      questions.some(
        (item) =>
          !item.question.trim() ||
          item.options.some((option) => !option.trim()) ||
          !item.answer.trim(),
      ) ||
      isSubmitting
    )
  }, [questions, isSubmitting])

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, { ...initialQuestion }])
  }

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleQuestionChange = (qIndex, field, value) => {
    setQuestions((prev) => {
      const next = [...prev]
      next[qIndex] = { ...next[qIndex], [field]: value }
      return next
    })
  }

  const handleOptionChange = (qIndex, oIndex, value) => {
    setQuestions((prev) => {
      const next = [...prev]
      const nextOptions = [...next[qIndex].options]
      nextOptions[oIndex] = value
      next[qIndex] = { ...next[qIndex], options: nextOptions }
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMsg('')

    const payload = {
      questions: questions.map((item) => ({
        question: item.question.trim(),
        options: item.options.map((option) => option.trim()),
        answer: item.answer.trim(),
      })),
    }

    try {
      const response = await createQuiz(payload)
      const savedQuestions = response?.data?.questions || payload.questions
      const quizSet = saveQuizSet({
        title: `Manual quiz ${new Date().toLocaleDateString()}`,
        questions: savedQuestions,
        source: 'manual',
      })
      setSuccessMsg('✅ Saved successfully!')
      setTimeout(() => {
        setSuccessMsg('')
        navigate('/quiz/play', { state: { quizSet } })
      }, 500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create quiz. Please try again.')
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
      <div className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-6 py-8 text-white">
        <h1 className="text-3xl font-semibold">Create Quiz Manually</h1>
        <p className="mt-2 text-sm text-white/90">Add one or more questions with four options each.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMsg && <p className="text-center mt-2 text-green-500">{successMsg}</p>}

        <AnimatePresence mode="popLayout">
          {questions.map((question, qIndex) => (
            <motion.div
              key={`question-${qIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Question {qIndex + 1}</h3>
                {questions.length > 1 && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemoveQuestion(qIndex)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </motion.button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Question text</label>
              <input
                  value={question.question}
                  onChange={(event) => handleQuestionChange(qIndex, 'question', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="Example: What does 猫 mean?"
              />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {question.options.map((option, oIndex) => (
                  <div key={`option-${qIndex}-${oIndex}`}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Option {oIndex + 1}</label>
                    <input
                      value={option}
                      onChange={(event) => handleOptionChange(qIndex, oIndex, event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                      placeholder={`Option ${oIndex + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Correct answer</label>
              <input
                  value={question.answer}
                  onChange={(event) => handleQuestionChange(qIndex, 'answer', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="Must match one of the options"
              />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-wrap gap-3 pt-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddQuestion}
            className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-100"
          >
            + Add Question
          </motion.button>
          <motion.button
            type="submit"
            disabled={isDisabled}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : `Save ${questions.length} Question${questions.length !== 1 ? 's' : ''} & Play`}
          </motion.button>
        </div>

      </form>
    </motion.div>
  )
}
