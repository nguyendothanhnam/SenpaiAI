import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { createFlashcard } from '../services/api.js'
import { saveFlashcardList } from '../utils/storage.js'

const initialCard = {
  front: '',
  back: '',
}

export default function FlashcardManual() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([{ ...initialCard }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const isSubmitDisabled = useMemo(() => {
    return (
      cards.length === 0 ||
      cards.some((card) => !card.front.trim() || !card.back.trim()) ||
      isSubmitting
    )
  }, [cards, isSubmitting])

  const handleCardChange = (index, field, value) => {
    const nextCards = [...cards]
    nextCards[index][field] = value
    setCards(nextCards)
  }

  const handleAddCard = () => {
    setCards((prev) => [...prev, { ...initialCard }])
  }

  const handleRemoveCard = (index) => {
    if (cards.length > 1) {
      setCards((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMsg('')

    const payload = {
      cards: cards.map((card) => ({
        front: card.front.trim(),
        back: card.back.trim(),
      })),
    }

    try {
      const response = await createFlashcard(payload)
      const savedCards = response?.data?.cards || payload.cards
      // Save to local storage
      saveFlashcardList(savedCards)
      setSuccessMsg(`✓ Successfully saved ${savedCards.length} card${savedCards.length !== 1 ? 's' : ''}!`)
      setTimeout(() => {
        navigate('/flashcard/play', { state: { cards: savedCards } })
      }, 500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create flashcards. Please try again.')
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
      <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 px-6 py-8 text-white">
        <h1 className="text-3xl font-semibold">Create Flashcards</h1>
        <p className="mt-2 text-sm text-white/90">Add one or more cards with front and back content.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMsg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => (
            <motion.div
              key={`card-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Card {index + 1}</h3>
                {cards.length > 1 && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemoveCard(index)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </motion.button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Front</label>
                <input
                  value={card.front}
                  onChange={(event) => handleCardChange(index, 'front', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="Example: 犬"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Back</label>
                <input
                  value={card.back}
                  onChange={(event) => handleCardChange(index, 'back', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                  placeholder="Example: Dog"
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
            onClick={handleAddCard}
            className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-100"
          >
            + Add Card
          </motion.button>
          <motion.button
            type="submit"
            disabled={isSubmitDisabled}
            whileTap={!isSubmitDisabled ? { scale: 0.98 } : {}}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : `Save ${cards.length} Card${cards.length !== 1 ? 's' : ''} & Learn`}
          </motion.button>
        </div>
      </form>
    </motion.div>
  )
}
