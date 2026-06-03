import { AnimatePresence, motion } from 'framer-motion'
import { PlayCircle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getQuiz } from '../services/api.js'
import { deleteQuizSet, getStoredQuizSets } from '../utils/storage.js'
import { getOptionKey, getQuestionCorrectAnswer, isCorrectQuizAnswer, normalizeAnswer } from '../utils/quizAnswers.js'

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

function formatDate(value) {
  if (!value) {
    return 'Unknown date'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleDateString()
}

export default function QuizPlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState([])
  const [activeSet, setActiveSet] = useState(null)
  const [savedSets, setSavedSets] = useState([])
  const [filters, setFilters] = useState({ jlpt: 'all', category: 'all', fileName: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const startQuiz = (quizSet) => {
    const nextQuestions = normalizeQuizQuestions(quizSet?.questions)
    if (!nextQuestions.length) {
      return
    }

    setActiveSet(quizSet)
    setQuestions(nextQuestions)
    setCurrentIndex(0)
    setSelected('')
    setScore(0)
    setShowResult(false)
    setError('')
    setIsLoading(false)
  }

  useEffect(() => {
    setSavedSets(getStoredQuizSets())
    const fromStateSet = location.state?.quizSet
    const fromStateQuestions = normalizeQuizQuestions(location.state?.questions)

    if (fromStateSet?.questions?.length) {
      startQuiz(fromStateSet)
      return
    }

    if (fromStateQuestions.length) {
      startQuiz({
        id: 'session',
        title: 'Current quiz',
        source: 'session',
        jlpt_level: 'Mixed',
        category: 'Session',
        created_at: new Date().toISOString(),
        questions: fromStateQuestions,
      })
      return
    }

    const fetchGeneratedQuiz = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await getQuiz()
        const data = normalizeQuizQuestions(response.data)

        if (!data.length) {
          setError('No generated quiz data available right now.')
          return
        }

        startQuiz({
          id: 'generated',
          title: 'Default generated quiz',
          source: 'generated',
          jlpt_level: 'Mixed',
          category: 'Generated',
          created_at: new Date().toISOString(),
          questions: data,
        })
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load generated quiz data.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGeneratedQuiz()
  }, [location.state])

  const filterOptions = useMemo(() => {
    const levels = [...new Set(savedSets.map((set) => set.jlpt_level).filter(Boolean))]
    const categories = [...new Set(savedSets.map((set) => set.category).filter(Boolean))]
    return { levels, categories }
  }, [savedSets])

  const filteredSets = useMemo(() => {
    return savedSets.filter((set) => {
      const matchesJlpt = filters.jlpt === 'all' || set.jlpt_level === filters.jlpt
      const matchesCategory = filters.category === 'all' || set.category === filters.category
      const fileQuery = filters.fileName.trim().toLowerCase()
      const matchesFile = !fileQuery || (set.file_name || '').toLowerCase().includes(fileQuery)
      return matchesJlpt && matchesCategory && matchesFile
    })
  }, [filters, savedSets])

  const handleDeleteSet = (quizSet) => {
    const confirmed = window.confirm(`Delete "${quizSet.title}"? This only removes this saved quiz set. Quiz history will not be deleted.`)
    if (!confirmed) {
      return
    }

    const nextSets = deleteQuizSet(quizSet.id)
    setSavedSets(nextSets)
    if (activeSet?.id === quizSet.id) {
      setActiveSet(null)
      setQuestions([])
      setCurrentIndex(0)
      setSelected('')
      setScore(0)
      setShowResult(false)
    }
  }

  const total = questions.length
  const progress = useMemo(() => {
    if (!total) {
      return 0
    }

    return ((currentIndex + (showResult ? 1 : 0)) / total) * 100
  }, [currentIndex, showResult, total])

  const currentQuestion = questions[currentIndex]

  const handleSelect = (optionKey) => {
    if (showResult) {
      return
    }

    const isCorrect = isCorrectQuizAnswer(currentQuestion, optionKey)
    setSelected(optionKey)
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

  const isLast = currentIndex + 1 === total
  const correctAnswer = currentQuestion ? getQuestionCorrectAnswer(currentQuestion) : ''
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer)

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Saved Quiz Sets</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">Uploaded And Manual Quizzes</h1>
          </div>
          <button
            onClick={() => navigate('/quiz/upload')}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Upload New Set
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <select
            value={filters.jlpt}
            onChange={(event) => setFilters((current) => ({ ...current, jlpt: event.target.value }))}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All JLPT levels</option>
            {filterOptions.levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All categories</option>
            {filterOptions.categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input
            value={filters.fileName}
            onChange={(event) => setFilters((current) => ({ ...current, fileName: event.target.value }))}
            placeholder="Filter by uploaded file name"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredSets.length ? filteredSets.map((quizSet) => (
            <div key={quizSet.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{quizSet.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">{quizSet.file_name || quizSet.source || 'Saved quiz set'}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">{quizSet.jlpt_level || 'Mixed'}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div>
                  <p className="font-semibold text-gray-900">{quizSet.questions?.length || 0}</p>
                  <p>Questions</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{quizSet.category || 'General'}</p>
                  <p>Category</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{formatDate(quizSet.created_at)}</p>
                  <p>Created</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => startQuiz(quizSet)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <PlayCircle className="h-4 w-4" />
                  Play
                </button>
                <button
                  onClick={() => handleDeleteSet(quizSet)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
              No saved quiz sets match the current filters.
            </div>
          )}
        </div>
      </motion.section>

      {isLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading quiz...</div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      )}

      {!isLoading && !error && !currentQuestion && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Choose a saved quiz set or upload a new one.</div>
      )}

      {!isLoading && !error && currentQuestion && (
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{activeSet?.source === 'generated' ? 'Default Generated Quiz' : 'Saved Quiz Play'}</p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900">
                {activeSet?.title || 'Quiz'}: Question {currentIndex + 1} / {total}
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
                  const optionKey = getOptionKey(index)
                  const isSelected = selected === optionKey
                  const isCorrect = isCorrectQuizAnswer(currentQuestion, optionKey)

                  let colorClass = 'border-gray-200 bg-white text-gray-800 hover:border-sky-400'

                  if (showResult && isCorrect) {
                    colorClass = 'border-green-200 bg-green-50 text-green-700'
                  } else if (showResult && isSelected && !isCorrect) {
                    colorClass = 'border-red-200 bg-red-50 text-red-700'
                  }

                  return (
                    <motion.button
                      key={`${optionKey}-${option}`}
                      whileHover={!showResult ? { scale: 1.01 } : {}}
                      whileTap={!showResult ? { scale: 0.99 } : {}}
                      onClick={() => handleSelect(optionKey)}
                      disabled={showResult}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${colorClass} disabled:cursor-not-allowed`}
                    >
                      <span className="font-semibold">{optionKey}.</span> {option}
                    </motion.button>
                  )
                })}
              </div>
              {showResult && !['A', 'B', 'C', 'D'].includes(normalizedCorrectAnswer) && (
                <p className="mt-3 text-xs text-gray-500">Correct answer: {correctAnswer}</p>
              )}
              {showResult && currentQuestion.explanation && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  {currentQuestion.explanation}
                </div>
              )}
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
        </motion.section>
      )}
    </div>
  )
}
