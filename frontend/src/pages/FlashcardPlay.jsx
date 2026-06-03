import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getStoredFlashcardSets, recordFlashcardStudyResult } from '../utils/storage.js'

export default function FlashcardPlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sets, setSets] = useState(() => getStoredFlashcardSets())
  const initialSetId = location.state?.setId || sets[0]?.id || ''
  const [activeSetId, setActiveSetId] = useState(initialSetId)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  const activeSet = useMemo(() => sets.find((set) => set.id === activeSetId), [activeSetId, sets])
  const cards = activeSet?.cards || []
  const total = cards.length
  const currentCard = cards[currentIndex]
  const stats = activeSet?.stats || { correct: 0, wrong: 0, streak: 0, accuracy: 0 }

  const changeSet = (setId) => {
    setActiveSetId(setId)
    setCurrentIndex(0)
    setIsFlipped(false)
  }

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

  const recordResult = (isCorrect) => {
    const updated = recordFlashcardStudyResult(activeSetId, isCorrect)
    if (updated) setSets(getStoredFlashcardSets())
    if (currentIndex < total - 1) handleNext()
  }

  if (!sets.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        No flashcard sets found. Create or import a set first.
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <select value={activeSetId} onChange={(event) => changeSet(event.target.value)} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
          {sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select>
        <p>This flashcard set has no cards.</p>
      </div>
    )
  }

  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < total - 1

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Flashcard Learning</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{activeSet?.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Card {currentIndex + 1} / {total}</p>
        </div>
        <select value={activeSetId} onChange={(event) => changeSet(event.target.value)} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
          {sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800">Accuracy {stats.accuracy || 0}%</div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Correct {stats.correct || 0}</div>
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Wrong {stats.wrong || 0}</div>
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">Streak {stats.streak || 0}</div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
        <motion.div className="h-full rounded-full bg-orange-500" initial={{ width: 0 }} animate={{ width: `${((currentIndex + 1) / total) * 100}%` }} transition={{ type: 'spring', stiffness: 60 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.button
          key={`${activeSetId}-${currentIndex}`}
          onClick={() => setIsFlipped((prev) => !prev)}
          className="mt-8 flex h-64 w-full flex-col items-center justify-center rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 text-center shadow-sm transition hover:shadow-md sm:h-80"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">{isFlipped ? 'Back' : 'Front'}</p>
          <p className="mt-4 text-3xl font-black text-gray-950 sm:text-4xl">{isFlipped ? currentCard.back : currentCard.front}</p>
          <p className="mt-6 text-xs font-semibold text-gray-400">Tap to {isFlipped ? 'show front' : 'show back'}</p>
        </motion.button>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => recordResult(true)} className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">
          <CheckCircle2 className="mr-2 h-4 w-4" /> Correct
        </button>
        <button onClick={() => recordResult(false)} className="inline-flex items-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700">
          <XCircle className="mr-2 h-4 w-4" /> Wrong
        </button>
        <button onClick={handlePrevious} disabled={!canGoPrev} className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-40">
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </button>
        <button onClick={handleNext} disabled={!canGoNext} className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-40">
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </button>
        <button onClick={handleReset} className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
          <RotateCcw className="mr-2 h-4 w-4" /> Start Over
        </button>
        <button onClick={() => navigate('/flashcard')} className="ml-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800">
          Back to Sets
        </button>
      </div>
    </motion.div>
  )
}
