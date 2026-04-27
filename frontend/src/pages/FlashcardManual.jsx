import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFlashcard } from '../services/api.js'

export default function FlashcardManual() {
  const navigate = useNavigate()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDisabled = useMemo(() => {
    return !front.trim() || !back.trim() || isSubmitting
  }, [front, back, isSubmitting])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const payload = {
      cards: [
        {
          front: front.trim(),
          back: back.trim(),
        },
      ],
    }

    try {
      await createFlashcard(payload)
      navigate('/flashcard/play')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create flashcard. Please try again.')
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
        <h1 className="text-3xl font-semibold">Create Flashcard</h1>
        <p className="mt-2 text-sm text-white/90">Add one card quickly and begin learning.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-6 py-8">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Front</label>
          <input
            value={front}
            onChange={(event) => setFront(event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
            placeholder="Example: 犬"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Back</label>
          <input
            value={back}
            onChange={(event) => setBack(event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
            placeholder="Example: Dog"
          />
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Save Flashcard'}
        </button>
      </form>
    </motion.div>
  )
}
