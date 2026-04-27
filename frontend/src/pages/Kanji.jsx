import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { romkan } from 'romkan'
import kanjiDataset from '../data/kanji.json'

function normalizeKana(value) {
  return String(value || '')
    .replace(/\./g, '')
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '')
    .trim()
}

function normalizeReadingInput(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }

  const hasLatin = /[a-zA-Z]/.test(raw)
  const kana = hasLatin ? romkan(raw) : raw
  return normalizeKana(kana)
}

function buildExpectedReadings(item) {
  return [...item.onyomi, ...item.kunyomi]
    .map((reading) => normalizeKana(reading))
    .filter(Boolean)
}

function buildAudioText(item) {
  const readings = [...item.onyomi, ...item.kunyomi]
    .map((reading) => String(reading || '').replace(/\./g, '').trim())
    .filter(Boolean)

  return readings.join(' ')
}

function getRandomIndex(length, currentIndex) {
  if (length <= 1) {
    return 0
  }

  let nextIndex = currentIndex
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length)
  }

  return nextIndex
}

export default function Kanji() {
  const [mode, setMode] = useState('learn')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [readingInput, setReadingInput] = useState('')
  const [readingFeedback, setReadingFeedback] = useState(null)
  const [testInput, setTestInput] = useState('')
  const [testFeedback, setTestFeedback] = useState(null)

  const currentKanji = kanjiDataset[currentIndex]

  const expectedReadings = useMemo(() => {
    if (!currentKanji) {
      return []
    }
    return buildExpectedReadings(currentKanji)
  }, [currentKanji])

  const progress = useMemo(() => {
    if (!kanjiDataset.length) {
      return 0
    }
    return ((currentIndex + 1) / kanjiDataset.length) * 100
  }, [currentIndex])

  const handleSearch = (event) => {
    event.preventDefault()

    const trimmed = searchInput.trim()
    if (!trimmed) {
      setSearchMessage('Vui lòng nhập một chữ Kanji')
      return
    }

    const foundIndex = kanjiDataset.findIndex((item) => item.kanji === trimmed)

    if (foundIndex < 0) {
      setSearchMessage('Không có trong bộ học hiện tại')
      return
    }

    setCurrentIndex(foundIndex)
    setSearchMessage('')
    setReadingInput('')
    setReadingFeedback(null)
    setTestInput('')
    setTestFeedback(null)
  }

  const handlePlayAudio = () => {
    if (!currentKanji || typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    const speech = buildAudioText(currentKanji)
    if (!speech) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(speech)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.85

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const handleCheckReading = () => {
    const normalized = normalizeReadingInput(readingInput)

    if (!normalized) {
      setReadingFeedback({
        type: 'error',
        message: 'Vui lòng nhập cách đọc',
      })
      return
    }

    const isCorrect = expectedReadings.includes(normalized)

    setReadingFeedback({
      type: isCorrect ? 'success' : 'error',
      message: isCorrect ? 'Chính xác!' : 'Chưa đúng, hãy thử lại.',
    })
  }

  const handleNextKanji = () => {
    if (!kanjiDataset.length) {
      return
    }

    const nextIndex = getRandomIndex(kanjiDataset.length, currentIndex)
    setCurrentIndex(nextIndex)
    setSearchMessage('')
    setReadingInput('')
    setReadingFeedback(null)
    setTestInput('')
    setTestFeedback(null)
  }

  const handleCheckTestReading = () => {
    const normalized = normalizeReadingInput(testInput)

    if (!normalized) {
      setTestFeedback({
        type: 'error',
        message: 'Vui lòng nhập cách đọc',
        isCorrect: false,
      })
      return
    }

    const isCorrect = expectedReadings.includes(normalized)

    setTestFeedback({
      type: isCorrect ? 'success' : 'error',
      message: isCorrect ? '✅ Correct!' : '❌ Incorrect!',
      isCorrect,
    })
  }

  const handleSkipTest = () => {
    handleNextKanji()
  }

    const handleSwitchMode = (nextMode) => {
    setMode(nextMode)

    // reset test
    setTestInput('')
    setTestFeedback(null)

    // reset learn
    setReadingInput('')
    setReadingFeedback(null)

    // reset search (QUAN TRỌNG)
    setSearchInput('')
    setSearchMessage('')
    }

  if (!currentKanji) {
    return (
      <div className="rounded-3xl border border-orange-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
        Không có dữ liệu Kanji.
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6 shadow-sm sm:p-8"
    >
      <div className="pointer-events-none absolute -left-20 -top-16 h-52 w-52 rounded-full bg-orange-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-amber-200/60 blur-3xl" />

      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">Kanji Learning</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">
              {mode === 'learn' ? 'Learn by Recognition and Reading' : 'Practice Reading Memory'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'learn' ? (
              <button
                type="button"
                onClick={() => handleSwitchMode('test')}
                className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
              >
                Practice
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitchMode('learn')}
                className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
              >
                Back to Learn
              </button>
            )}
            <div className="rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-sm font-medium text-orange-700 backdrop-blur">
              {currentIndex + 1} / {kanjiDataset.length}
            </div>
          </div>
        </div>

    {mode === 'learn' && (
    <form onSubmit={handleSearch} className="rounded-2xl border border-orange-200 bg-white/90 p-4 sm:p-5">
        <p className="text-sm font-medium text-gray-700">Search Kanji</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ví dụ: 学 hoặc 国"
            className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
        />
        <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-orange-600 hover:to-amber-600"
        >
            Search
        </button>
        </div>
        {searchMessage && <p className="mt-3 text-sm text-red-600">{searchMessage}</p>}
    </form>
    )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentKanji.kanji}-${currentIndex}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6 rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-[0_24px_45px_-28px_rgba(194,65,12,0.5)] backdrop-blur sm:p-8"
          >
            <div className="flex justify-center">
              <div className="inline-flex min-h-44 min-w-44 items-center justify-center rounded-3xl border border-orange-100 bg-gradient-to-br from-white to-orange-50 px-10 py-6 text-center text-7xl font-bold text-gray-900 shadow-inner sm:min-h-52 sm:min-w-52 sm:text-8xl">
                {currentKanji.kanji}
              </div>
            </div>

            {mode === 'learn' ? (
              <>
                <div className="grid gap-3 rounded-2xl bg-orange-50/70 p-4 text-sm text-gray-700 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Onyomi</p>
                    <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.onyomi.join(', ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Kunyomi</p>
                    <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.kunyomi.join(', ') || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Meaning (Vietnamese)</p>
                    <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.meaning_vi || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Example sentence</p>
                    <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.example || '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handlePlayAudio}
                    className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    🔊 Play Audio
                  </button>
                </div>

                <div className="space-y-3">
                  <label htmlFor="reading" className="text-sm font-medium text-gray-700">
                    Type reading
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="reading"
                      value={readingInput}
                      onChange={(event) => setReadingInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleCheckReading()
                        }
                      }}
                      placeholder="Nhập hiragana hoặc romaji"
                      className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={handleCheckReading}
                      className="rounded-xl border border-orange-200 bg-orange-100 px-4 py-3 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
                    >
                      Check Reading
                    </button>
                  </div>

                  {readingFeedback && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                        readingFeedback.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {readingFeedback.message}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextKanji}
                    className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600"
                  >
                    Next Kanji
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-800">Type the reading!</p>
                </div>

                <div className="space-y-3">
                  <input
                    value={testInput}
                    onChange={(event) => setTestInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleCheckTestReading()
                      }
                    }}
                    placeholder="Enter reading (hiragana or romaji)"
                    className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  />

                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleCheckTestReading}
                      className="rounded-xl border border-orange-200 bg-orange-100 px-5 py-3 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
                    >
                      Check
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipTest}
                      className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Skip
                    </button>
                    {testFeedback?.isCorrect && (
                      <button
                        type="button"
                        onClick={handleNextKanji}
                        className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600"
                      >
                        Next Kanji
                      </button>
                    )}
                  </div>
                </div>

                {testFeedback && (
                  <div
                    className={`rounded-xl border px-4 py-4 text-sm ${
                      testFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    <p className="font-semibold">{testFeedback.message}</p>
                    <div className="mt-2 space-y-1 text-gray-800">
                      {!testFeedback.isCorrect && <p className="font-medium">Correct answer:</p>}
                      <p><span className="font-semibold">Onyomi:</span> {currentKanji.onyomi.join(', ') || '-'}</p>
                      <p><span className="font-semibold">Kunyomi:</span> {currentKanji.kunyomi.join(', ') || '-'}</p>
                      {testFeedback.isCorrect && (
                        <p><span className="font-semibold">Meaning:</span> {currentKanji.meaning_vi || '-'}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
