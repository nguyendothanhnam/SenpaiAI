import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getQuiz } from '../services/api.js'
import { getStoredQuizList } from '../utils/storage.js'

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

function getCorrectAnswer(question) {
  return question.answer || question.correct || question.correctAnswer || ''
}

export default function QuizPlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    const fromState = normalizeQuizQuestions(location.state?.questions)

    if (fromState.length) {
      setQuestions(fromState)
      setIsLoading(false)
      return
    }

    const fetchQuiz = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await getQuiz()
        const data = normalizeQuizQuestions(response.data)

        if (!data.length) {
          // Fallback to local storage
          const stored = getStoredQuizList()
          if (stored.length) {
            setQuestions(stored)
            setIsLoading(false)
            return
          }
          setError('No quiz data available right now.')
        } else {
          setQuestions(data)
        }
      } catch (err) {
        // Fallback to local storage on API error
        const stored = getStoredQuizList()
        if (stored.length) {
          setQuestions(stored)
          setIsLoading(false)
          return
        }
        setError(err?.response?.data?.detail || 'Failed to load quiz data.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuiz()
  }, [location.state])

  const total = questions.length
  const progress = useMemo(() => {
    if (!total) {
      return 0
    }

    return ((currentIndex + (showResult ? 1 : 0)) / total) * 100
  }, [currentIndex, showResult, total])

  const currentQuestion = questions[currentIndex]

  const handleSelect = (option) => {
    if (showResult) {
      return
    }

    const isCorrect = option === getCorrectAnswer(currentQuestion)
    setSelected(option)
    setShowResult(true)

    if (isCorrect) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNext = () => {
    if (currentIndex + 1 >= total) {
      return
    }

    setCurrentIndex((prev) => prev + 1)
    setSelected('')
    setShowResult(false)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelected('')
    setScore(0)
    setShowResult(false)
  }

  if (isLoading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading quiz...</div>
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
  }

  if (!currentQuestion) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No quiz questions found.</div>
  }

  const isLast = currentIndex + 1 === total
  const correctAnswer = getCorrectAnswer(currentQuestion)

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Quiz Play</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            Question {currentIndex + 1} / {total}
          </h1>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
          Score: {score} / {total}
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 60 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentIndex}-${currentQuestion.question}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900">{currentQuestion.question}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(currentQuestion.options || []).map((option, index) => {
              const isSelected = selected === option
              const isCorrect = option === correctAnswer

              let colorClass = 'border-gray-200 bg-white text-gray-800 hover:border-sky-400'

              if (showResult && isCorrect) {
                colorClass = 'border-green-200 bg-green-50 text-green-700'
              } else if (showResult && isSelected && !isCorrect) {
                colorClass = 'border-red-200 bg-red-50 text-red-700'
              }

              return (
                <motion.button
                  key={`${option}-${index}`}
                  whileHover={!showResult ? { scale: 1.01 } : {}}
                  whileTap={!showResult ? { scale: 0.99 } : {}}
                  onClick={() => handleSelect(option)}
                  disabled={showResult}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${colorClass} disabled:cursor-not-allowed`}
                >
                  {option}
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap gap-3">
        {!isLast ? (
          <button
            onClick={handleNext}
            disabled={!showResult}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next Question
          </button>
        ) : (
          <button
            onClick={handleRestart}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-green-600"
          >
            Restart Quiz
          </button>
        )}
        <button
          onClick={() => navigate('/quiz')}
          className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Back To Setup
        </button>
      </div>
    </motion.div>
  )
}
