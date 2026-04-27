import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createQuiz } from '../services/api.js'

const initialState = {
  question: '',
  options: ['', '', '', ''],
  answer: '',
}

export default function QuizManual() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDisabled = useMemo(() => {
    const optionsFilled = form.options.every((option) => option.trim())
    return !form.question.trim() || !optionsFilled || !form.answer.trim() || isSubmitting
  }, [form, isSubmitting])

  const handleOptionChange = (index, value) => {
    const nextOptions = [...form.options]
    nextOptions[index] = value
    setForm((prev) => ({ ...prev, options: nextOptions }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const payload = {
      questions: [
        {
          question: form.question.trim(),
          options: form.options.map((item) => item.trim()),
          answer: form.answer.trim(),
        },
      ],
    }

    try {
      const response = await createQuiz(payload)
      const questions = response?.data?.questions || payload.questions
      navigate('/quiz/play', { state: { questions } })
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
        <p className="mt-2 text-sm text-white/90">Add a question, four options, and a correct answer.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-6 py-8">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Question</label>
          <input
            value={form.question}
            onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
            placeholder="Example: What does 猫 mean?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {form.options.map((option, index) => (
            <div key={`option-${index}`}>
              <label className="mb-2 block text-sm font-medium text-gray-700">Option {index + 1}</label>
              <input
                value={option}
                onChange={(event) => handleOptionChange(index, event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                placeholder={`Option ${index + 1}`}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Correct answer</label>
          <input
            value={form.answer}
            onChange={(event) => setForm((prev) => ({ ...prev, answer: event.target.value }))}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
            placeholder="Must match one of the options"
          />
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Save And Play'}
        </button>
      </form>
    </motion.div>
  )
}
