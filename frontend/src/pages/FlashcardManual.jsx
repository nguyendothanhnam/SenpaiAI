import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { createFlashcard } from '../services/api.js'
import { getStoredFlashcardSets, saveFlashcardSet, updateFlashcardSet } from '../utils/storage.js'

const initialCard = { front: '', back: '', jlpt_level: '', category: '' }

export default function FlashcardManual() {
  const navigate = useNavigate()
  const location = useLocation()
  const editSetId = location.state?.editSetId
  const existingSet = editSetId ? getStoredFlashcardSets().find((set) => set.id === editSetId) : null

  const [setName, setSetName] = useState(existingSet?.name || 'User Custom Set')
  const [jlptLevel, setJlptLevel] = useState(existingSet?.jlpt_level === 'Mixed' ? '' : existingSet?.jlpt_level || '')
  const [category, setCategory] = useState(existingSet?.category === 'Mixed' ? '' : existingSet?.category || '')
  const [cards, setCards] = useState(existingSet?.cards?.length ? existingSet.cards : [{ ...initialCard }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const isSubmitDisabled = useMemo(() => {
    return !setName.trim() || cards.length === 0 || cards.some((card) => !card.front.trim() || !card.back.trim()) || isSubmitting
  }, [cards, isSubmitting, setName])

  const handleCardChange = (index, field, value) => {
    const nextCards = [...cards]
    nextCards[index] = { ...nextCards[index], [field]: value }
    setCards(nextCards)
  }

  const handleAddCard = () => setCards((prev) => [...prev, { ...initialCard }])

  const handleRemoveCard = (index) => {
    if (cards.length > 1) setCards((prev) => prev.filter((_, i) => i !== index))
  }

  const normalizedCards = () => cards.map((card) => ({
    ...card,
    front: card.front.trim(),
    back: card.back.trim(),
    jlpt_level: card.jlpt_level || jlptLevel,
    category: card.category || category,
  }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMsg('')

    const payload = { cards: normalizedCards() }

    try {
      await createFlashcard(payload)
      const savedSet = existingSet
        ? updateFlashcardSet(existingSet.id, {
            name: setName.trim(),
            cards: payload.cards,
            jlpt_level: jlptLevel || undefined,
            category: category || undefined,
          })
        : saveFlashcardSet({
            name: setName.trim(),
            cards: payload.cards,
            source: 'user',
          })
      setSuccessMsg(`Successfully saved ${payload.cards.length} card${payload.cards.length !== 1 ? 's' : ''}.`)
      setTimeout(() => navigate('/flashcard/play', { state: { setId: savedSet?.id } }), 500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save flashcards. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-6 py-8 text-white">
        <h1 className="text-3xl font-semibold">{existingSet ? 'Edit Flashcard Set' : 'Create Flashcard Set'}</h1>
        <p className="mt-2 text-sm text-white/90">Manage one organized collection of flashcards.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMsg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Set Name</label>
            <input value={setName} onChange={(event) => setSetName(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">JLPT Level</label>
            <select value={jlptLevel} onChange={(event) => setJlptLevel(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm">
              <option value="">Mixed</option>
              {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
            <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Food, Travel, Verbs..." className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm" />
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => (
            <motion.div key={card.id || `card-${index}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Card {index + 1}</h3>
                {cards.length > 1 && (
                  <button type="button" onClick={() => handleRemoveCard(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Card
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Front</label>
                  <input value={card.front} onChange={(event) => handleCardChange(index, 'front', event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm" placeholder="例: 犬" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Back</label>
                  <input value={card.back} onChange={(event) => handleCardChange(index, 'back', event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm" placeholder="VD: chó" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" onClick={handleAddCard} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100">+ Add Card</button>
          <button type="submit" disabled={isSubmitDisabled} className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Saving...' : `Save Set & Study`}
          </button>
        </div>
      </form>
    </motion.div>
  )
}
