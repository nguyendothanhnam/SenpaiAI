import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getFlashcard } from '../services/api.js'
import { getStoredFlashcardList } from '../utils/storage.js'

function normalizeCards(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.cards)) {
    return data.cards
  }

  if (data?.front && data?.back) {
    return [data]
  }

  return []
}

export default function FlashcardPlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    const fromState = normalizeCards(location.state?.cards)

    if (fromState.length) {
      setCards(fromState)
      setIsLoading(false)
      return
    }

    const fetchCards = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await getFlashcard()
        const data = normalizeCards(response.data)

        if (!data.length) {
          // Fallback to local storage
          const stored = getStoredFlashcardList()
          if (stored.length) {
            setCards(stored)
            setIsLoading(false)
            return
          }
          setError('No flashcard data available right now.')
        } else {
          setCards(data)
        }
      } catch (err) {
        // Fallback to local storage on API error
        const stored = getStoredFlashcardList()
        if (stored.length) {
          setCards(stored)
          setIsLoading(false)
          return
        }
        setError(err?.response?.data?.detail || 'Failed to load flashcard data.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCards()
  }, [location.state])

  const total = cards.length
  const currentCard = cards[currentIndex]

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setIsFlipped(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsFlipped(false)
    }
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  if (isLoading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading flashcards...</div>
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
  }

  if (!currentCard) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No flashcards found.</div>
  }

  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < total - 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Flashcard Learning</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            Card {currentIndex + 1} / {total}
          </h1>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
          {(((currentIndex + 1) / total) * 100).toFixed(0)}% Complete
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          transition={{ type: 'spring', stiffness: 60 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.button
          key={currentIndex}
          onClick={() => setIsFlipped((prev) => !prev)}
          className="relative mt-8 h-64 w-full rounded-3xl border border-gray-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-8 text-left shadow-sm transition hover:shadow-md sm:h-80"
          initial={{ opacity: 0, scale: 0.98, rotateY: isFlipped ? 180 : 0 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.45 }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative h-full"
          >
            <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${isFlipped ? 'invisible' : ''}`}>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-gray-500">Front</p>
              <p className="mt-3 text-3xl font-semibold text-gray-900 sm:text-4xl">{currentCard.front}</p>
            </div>
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center text-center ${isFlipped ? '' : 'invisible'}`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-sky-600">Back</p>
              <p className="mt-3 text-2xl font-semibold text-sky-700 sm:text-3xl">{currentCard.back}</p>
            </div>
          </motion.div>

          <div className="pointer-events-none absolute bottom-4 right-4 text-xs font-medium text-gray-400 uppercase tracking-[0.05em]">
            Tap to flip
          </div>
        </motion.button>
      </AnimatePresence>

      <div className="mt-8 flex flex-wrap gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePrevious}
          disabled={!canGoPrev}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={!canGoNext}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsFlipped((prev) => !prev)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          {isFlipped ? 'Show Front' : 'Show Back'}
        </motion.button>

        {!canGoNext && currentIndex > 0 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReset}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-sky-600"
          >
            Start Over
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/flashcard')}
          className="ml-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Back to Hub
        </motion.button>
      </div>
    </motion.div>
  )
}
