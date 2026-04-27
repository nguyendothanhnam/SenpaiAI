import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { getFlashcard } from '../services/api.js'

function normalizeCard(data) {
  if (Array.isArray(data?.cards) && data.cards[0]) {
    return data.cards[0]
  }

  if (Array.isArray(data) && data[0]) {
    return data[0]
  }

  if (data?.front && data?.back) {
    return data
  }

  return null
}

export default function FlashcardPlay() {
  const [card, setCard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardKey, setCardKey] = useState(0)

  const loadCard = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getFlashcard()
      const nextCard = normalizeCard(response.data)

      if (!nextCard) {
        setError('No flashcard data available right now.')
      }

      setCard(nextCard)
      setIsFlipped(false)
      setCardKey((prev) => prev + 1)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load flashcard data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCard()
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Flashcard Play</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Tap Card To Flip</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">Loading flashcard...</div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : card ? (
        <div className="mt-6 space-y-5">
          <AnimatePresence mode="wait">
            <motion.button
              key={cardKey}
              onClick={() => setIsFlipped((prev) => !prev)}
              className="relative h-64 w-full rounded-3xl border border-gray-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-8 text-left shadow-sm"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
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
                <div className={`absolute inset-0 flex items-center justify-center text-center text-3xl font-semibold text-gray-900 ${isFlipped ? 'invisible' : ''}`}>
                  {card.front}
                </div>
                <div
                  className={`absolute inset-0 flex items-center justify-center text-center text-2xl font-semibold text-sky-700 ${isFlipped ? '' : 'invisible'}`}
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  {card.back}
                </div>
              </motion.div>
            </motion.button>
          </AnimatePresence>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsFlipped((prev) => !prev)}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {isFlipped ? 'Show Front' : 'Show Back'}
            </button>
            <button
              onClick={loadCard}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Next Card
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">No flashcard found.</div>
      )}
    </motion.div>
  )
}
