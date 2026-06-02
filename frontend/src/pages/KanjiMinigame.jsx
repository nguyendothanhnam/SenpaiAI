import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Search, Shuffle, Volume2, XCircle } from 'lucide-react'
import { kanjiDataAPI, libraryAPI } from '../services/api'
import {
  builtInKanjiDataset,
  checkKanjiReadingAnswer,
  extractLibraryKanjiItems,
  isCompleteKanjiItem,
  kanaToBasicRomaji,
  mergeKanjiSources,
  searchKanjiDataset,
  toHiragana,
} from '../data/kanjiDataset'

const kanjiModes = [
  { value: 'study', label: 'Kanji Study' },
  { value: 'quiz', label: 'Kanji Quiz' },
  { value: 'search', label: 'Kanji Search' },
  { value: 'vocabulary', label: 'Vocabulary Grid' },
]

const jlptLevels = ['all', 'N5', 'N4', 'N3', 'N2', 'N1']

const vocabularyModes = [
  { value: 'word_meaning', label: 'Word - Meaning' },
  { value: 'word_reading', label: 'Word - Reading' },
  { value: 'reading_meaning', label: 'Reading - Meaning' },
  { value: 'kanji_meaning', label: 'Kanji - Meaning' },
  { value: 'kanji_reading', label: 'Kanji - Reading' },
  { value: 'sentence_translation', label: 'Sentence - Translation' },
]

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function getItemMeaning(item) {
  return item.meaning_vi || item.meaning_en || ''
}

function useSpeak() {
  return (text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }
}

function AudioButton({ text, label = 'Play', className = '' }) {
  const speak = useSpeak()
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      className={`inline-flex h-7 items-center gap-1 rounded-full border border-orange-200 bg-white px-2 text-xs font-bold text-orange-700 hover:bg-orange-50 ${className}`}
      aria-label={label}
    >
      <Volume2 className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function ReadingChip({ reading, romaji, label }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2">
      <div>
        <p className="font-japanese text-lg font-black leading-5 text-gray-950">{reading}</p>
        <p className="text-xs font-semibold text-gray-500">{romaji || kanaToBasicRomaji(reading)}</p>
      </div>
      <AudioButton text={reading} label={label} />
    </div>
  )
}

function ExampleCard({ example }) {
  const text = example.word || example.sentence
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-japanese text-base font-black leading-6 text-gray-950">
            {text}
            {example.reading && <span className="ml-1 text-sm font-semibold text-gray-500">({example.reading})</span>}
          </p>
          <p className="text-sm font-semibold text-gray-700">{example.meaning_vi || example.meaning}</p>
        </div>
        <AudioButton text={text || example.reading} label="Example" />
      </div>
    </div>
  )
}

function ProgressPanel({ index, total }) {
  const learned = Math.min(index + 1, total)
  const percent = total ? Math.round((learned / total) * 100) : 0

  return (
    <div className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Progress</p>
          <p className="mt-1 text-2xl font-black text-gray-950">{percent}%</p>
          <p className="text-xs font-semibold text-gray-500">Learned</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-gray-950">{learned} Learned</p>
          <p className="text-xs font-semibold text-gray-500">{total} Total</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-100">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function QuickQuizPanel({ onOpenQuiz }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Quick Quiz</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onOpenQuiz} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white">
          Reading Quiz
        </button>
        <button type="button" onClick={onOpenQuiz} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
          Meaning Quiz
        </button>
      </div>
    </div>
  )
}

function StudyMode({ item, index, total, onPrevious, onNext, onRandom, onOpenQuiz }) {
  const [showAllExamples, setShowAllExamples] = useState(false)
  const visibleExamples = showAllExamples ? item.examples : item.examples.slice(0, 3)
  const readingRows = (readings) => readings.map((reading, readingIndex) => ({
    reading,
    romaji: item.romaji?.[readingIndex] || kanaToBasicRomaji(reading),
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-950">Kanji Study</h2>
              <p className="text-xs font-bold text-orange-600">Kanji {index + 1} / {total}</p>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{item.jlpt_level}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="rounded-xl bg-orange-50 px-4 py-5 text-center ring-1 ring-orange-100">
              <p className="font-japanese text-8xl font-black leading-none text-gray-950">{item.kanji}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={onPrevious} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700" aria-label="Previous Kanji">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={onRandom} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700" aria-label="Random Kanji">
                  <Shuffle className="h-4 w-4" />
                </button>
                <button type="button" onClick={onNext} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white" aria-label="Next Kanji">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Meaning</p>
              <h3 className="mt-1 text-2xl font-black leading-tight text-gray-950">{item.meaning_vi}</h3>
              {item.meaning_en && <p className="mt-1 text-sm font-semibold text-gray-500">{item.meaning_en}</p>}
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Romaji</p>
              <p className="mt-1 text-sm font-bold text-gray-800">{item.romaji?.join(', ')}</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Radical', item.radical || 'N/A'],
                  ['Stroke Count', item.stroke_count],
                  ['JLPT', item.jlpt_level],
                  ['Frequency', item.frequency || 'N/A'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">{label}</p>
                    <p className="mt-0.5 text-sm font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Onyomi</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {readingRows(item.onyomi).map((entry) => <ReadingChip key={`on-${entry.reading}`} reading={entry.reading} romaji={entry.romaji} label="Onyomi" />)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Kunyomi</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {readingRows(item.kunyomi).map((entry) => <ReadingChip key={`kun-${entry.reading}`} reading={entry.reading} romaji={entry.romaji} label="Kunyomi" />)}
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-gray-950">Examples</h3>
            <AudioButton text={item.kanji} label="Kanji" />
          </div>
          <div className="mt-3 grid gap-2">
            {visibleExamples.map((example) => (
              <ExampleCard key={`${item.kanji}-${example.word}-${example.reading}`} example={example} />
            ))}
          </div>
          {item.examples.length > 3 && (
            <button type="button" onClick={() => setShowAllExamples((current) => !current)} className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-800">
              {showAllExamples ? 'View Less' : 'View More'}
            </button>
          )}
        </div>

        <QuickQuizPanel onOpenQuiz={onOpenQuiz} />
        <ProgressPanel index={index} total={total} />
      </aside>
    </div>
  )
}

function QuizMode({ items, currentItem }) {
  const [quizKind, setQuizKind] = useState('reading')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [typedReading, setTypedReading] = useState('')
  const [typedResult, setTypedResult] = useState(null)

  useEffect(() => {
    setSelectedAnswer('')
    setTypedReading('')
    setTypedResult(null)
  }, [currentItem?.kanji, quizKind])

  const readingOptions = useMemo(() => {
    if (!currentItem) return []
    const correct = toHiragana(currentItem.onyomi[0] || currentItem.kunyomi[0])
    const distractors = shuffle(items.flatMap((item) => [...item.onyomi, ...item.kunyomi]).map(toHiragana).filter((reading) => reading && reading !== correct)).slice(0, 3)
    return shuffle([correct, ...distractors])
  }, [currentItem, items])

  const meaningOptions = useMemo(() => {
    if (!currentItem) return []
    const correct = getItemMeaning(currentItem)
    const distractors = shuffle(items.map(getItemMeaning).filter((meaning) => meaning && meaning !== correct)).slice(0, 3)
    return shuffle([correct, ...distractors])
  }, [currentItem, items])

  const options = quizKind === 'meaning' ? meaningOptions : readingOptions
  const correctAnswer = quizKind === 'meaning' ? getItemMeaning(currentItem) : toHiragana(currentItem.onyomi[0] || currentItem.kunyomi[0])
  const hasReadings = currentItem?.onyomi?.length || currentItem?.kunyomi?.length

  const checkTypedReading = () => {
    setTypedResult(checkKanjiReadingAnswer(currentItem, typedReading))
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-2xl border border-orange-100 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">{currentItem.jlpt_level} Kanji Quiz</p>
        <div className="mx-auto mt-5 flex h-48 w-48 items-center justify-center rounded-3xl bg-orange-50 font-japanese text-9xl font-black text-gray-950 ring-1 ring-orange-100">
          {currentItem.kanji}
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-500">
          {quizKind === 'meaning' ? 'What does this Kanji mean?' : quizKind === 'typed' ? 'Type any valid reading.' : 'Read this Kanji.'}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-white p-3">
          {[
            ['reading', 'Reading Quiz'],
            ['meaning', 'Meaning Quiz'],
            ['typed', 'Typed Reading'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={value !== 'meaning' && !hasReadings}
              onClick={() => setQuizKind(value)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${quizKind === value ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700 disabled:opacity-40'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {!hasReadings && quizKind !== 'meaning' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Reading data is missing, so reading quiz is hidden for this Kanji.
          </div>
        )}

        {quizKind !== 'typed' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const selected = selectedAnswer === option
              const correct = option === correctAnswer
              return (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  onClick={() => setSelectedAnswer(option)}
                  className={`rounded-2xl border p-4 text-left text-sm font-bold ${
                    selected
                      ? correct ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-700'
                      : 'border-orange-100 bg-white text-gray-900 hover:bg-orange-50'
                  }`}
                >
                  <span className="mr-2 text-orange-500">{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              )
            })}
            {selectedAnswer && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-gray-700 sm:col-span-2">
                Correct answer: <span className="font-black text-gray-950">{correctAnswer}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-orange-100 bg-white p-5">
            <label className="text-sm font-bold text-gray-700" htmlFor="typed-reading">Typed reading</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="typed-reading"
                value={typedReading}
                onChange={(event) => setTypedReading(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') checkTypedReading() }}
                placeholder="にち, ニチ, nichi"
                className="min-w-0 flex-1 rounded-xl border border-orange-100 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-300"
              />
              <button type="button" onClick={checkTypedReading} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">Check Answer</button>
            </div>
            {typedResult && (
              <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${typedResult.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                {typedResult.correct ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <XCircle className="mr-2 inline h-4 w-4" />}
                {typedResult.message}
                {typedResult.matchedReading && <span> Matched: {typedResult.matchedReading} ({typedResult.readingType})</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function buildVocabularyItems(kanjiItems, libraryPairs, mode) {
  const fromExamples = kanjiItems.flatMap((item) =>
    item.examples.map((example, index) => ({
      id: `${item.kanji}-${example.word || index}-${mode}`,
      kanji: item.kanji,
      word: example.word || item.kanji,
      reading: example.reading || toHiragana(item.onyomi[0] || item.kunyomi[0] || ''),
      meaning: example.meaning_vi || getItemMeaning(item),
      sentence: example.sentence || example.word || item.kanji,
      translation: example.meaning_vi || getItemMeaning(item),
    }))
  )
  const fromLibrary = libraryPairs.map((pair, index) => ({
    id: `library-${pair.id || index}-${mode}`,
    word: pair.left,
    reading: pair.reading || '',
    meaning: pair.meaning || pair.right,
    sentence: pair.left,
    translation: pair.meaning || pair.right,
    kanji: pair.left,
  }))
  return shuffle([...fromLibrary, ...fromExamples]).slice(0, 8).map((item) => {
    const fields = {
      word_meaning: [item.word, item.meaning],
      word_reading: [item.word, item.reading],
      reading_meaning: [item.reading, item.meaning],
      kanji_meaning: [item.kanji, item.meaning],
      kanji_reading: [item.kanji, item.reading],
      sentence_translation: [item.sentence, item.translation],
    }
    const [left, right] = fields[mode] || fields.word_meaning
    return { ...item, left, right }
  }).filter((item) => item.left && item.right)
}

function VocabularyGrid({ jlpt, kanjiItems }) {
  const [gridMode, setGridMode] = useState('word_meaning')
  const [cards, setCards] = useState([])
  const [selected, setSelected] = useState([])
  const [matchedIds, setMatchedIds] = useState([])
  const [wrongIds, setWrongIds] = useState([])
  const [feedback, setFeedback] = useState('')
  const [attempts, setAttempts] = useState({ correct: 0, wrong: 0, streak: 0 })

  const query = useQuery(
    ['vocabularyGridPairs', jlpt],
    () => libraryAPI.quiz({ mode: 'vocabulary_matching_grid', jlpt, count: 8 }).then((response) => response.data),
    { staleTime: 1000 * 30, retry: false }
  )

  const pairs = useMemo(
    () => buildVocabularyItems(kanjiItems, query.data?.pairs || [], gridMode),
    [kanjiItems, query.data?.pairs, gridMode]
  )

  const reset = () => {
    const deck = shuffle(pairs.flatMap((pair) => [
      { id: `${pair.id}:left`, pairId: pair.id, text: pair.left, type: 'left', pair },
      { id: `${pair.id}:right`, pairId: pair.id, text: pair.right, type: 'right', pair },
    ]))
    setCards(deck)
    setSelected([])
    setMatchedIds([])
    setWrongIds([])
    setFeedback('')
    setAttempts({ correct: 0, wrong: 0, streak: 0 })
  }

  useEffect(() => {
    reset()
  }, [pairs])

  const chooseCard = (card) => {
    if (selected.some((item) => item.id === card.id) || matchedIds.includes(card.pairId) || selected.length >= 2) return
    const nextSelected = [...selected, card]
    setSelected(nextSelected)
    setFeedback('')
    if (nextSelected.length !== 2) return

    const [first, second] = nextSelected
    if (first.pairId === second.pairId && first.type !== second.type) {
      setMatchedIds((items) => [...items, first.pairId])
      setAttempts((current) => ({ ...current, correct: current.correct + 1, streak: current.streak + 1 }))
      setFeedback('Correct')
      setSelected([])
      return
    }

    setWrongIds([first.id, second.id])
    setAttempts((current) => ({ ...current, wrong: current.wrong + 1, streak: 0 }))
    setFeedback('Wrong')
    window.setTimeout(() => {
      setSelected([])
      setWrongIds([])
    }, 750)
  }

  const totalAttempts = attempts.correct + attempts.wrong
  const accuracy = totalAttempts ? Math.round((attempts.correct / totalAttempts) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-950">Vocabulary Grid</h2>
            <p className="text-sm text-gray-500">Correct {attempts.correct} · Wrong {attempts.wrong} · Accuracy {accuracy}% · Streak {attempts.streak}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={gridMode} onChange={(event) => setGridMode(event.target.value)} className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
              {vocabularyModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            <button type="button" onClick={reset} className="inline-flex items-center rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </button>
          </div>
        </div>
      </div>

      {!cards.length ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-600">No kanji found for current filter.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((card) => {
            const visible = selected.some((item) => item.id === card.id) || matchedIds.includes(card.pairId) || wrongIds.includes(card.id)
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => chooseCard(card)}
                disabled={matchedIds.includes(card.pairId)}
                className={`min-h-[118px] rounded-2xl border bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  matchedIds.includes(card.pairId) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : wrongIds.includes(card.id) ? 'border-red-300 bg-red-50 text-red-700' : 'border-orange-100'
                }`}
              >
                {visible ? (
                  <span className={`${card.type === 'left' ? 'font-japanese text-2xl font-black' : 'text-base font-semibold'} leading-snug text-gray-900`}>
                    {card.text}
                  </span>
                ) : (
                  <span className="text-2xl font-black text-orange-300">?</span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {feedback && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${feedback === 'Correct' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{feedback}</div>}
    </div>
  )
}

function SearchMode({ items }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.length ? items.map((item) => (
        <div key={item.kanji} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-orange-50 font-japanese text-6xl font-black text-gray-950">{item.kanji}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{item.jlpt_level}</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{item.stroke_count} strokes</span>
              </div>
              <h3 className="mt-2 text-lg font-black text-gray-950">{item.meaning_vi}</h3>
              <p className="mt-2 text-sm text-gray-600">Onyomi: <span className="font-japanese font-bold text-gray-950">{item.onyomi.join(' / ')}</span></p>
              <p className="text-sm text-gray-600">Kunyomi: <span className="font-japanese font-bold text-gray-950">{item.kunyomi.join(' / ')}</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AudioButton text={item.onyomi[0]} label="Onyomi" />
                <AudioButton text={item.kunyomi[0]} label="Kunyomi" />
                {item.examples[0] && <AudioButton text={item.examples[0].word} label="Example" />}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {item.examples.slice(0, 3).map((example) => <ExampleCard key={`${item.kanji}-${example.word}-${example.reading}`} example={example} />)}
          </div>
        </div>
      )) : (
        <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-600 lg:col-span-2">No kanji found for current filter.</div>
      )}
    </div>
  )
}

export default function KanjiMinigame() {
  const [mode, setMode] = useState('study')
  const [jlpt, setJlpt] = useState('N5')
  const [search, setSearch] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  const dictionaryQuery = useQuery(
    ['kanjiDictionaryForGames'],
    () => kanjiDataAPI.list({ jlpt: 'all', limit: 300 }).then((response) => response.data),
    { staleTime: 1000 * 60, retry: false }
  )
  const libraryKanjiQuery = useQuery(
    ['libraryKanjiForGames'],
    () => libraryAPI.getDocuments({ limit: 100 }).then((response) => response.data),
    { staleTime: 1000 * 60, retry: false }
  )

  const allKanji = useMemo(
    () => mergeKanjiSources(dictionaryQuery.data?.items || [], extractLibraryKanjiItems(libraryKanjiQuery.data?.items || []), builtInKanjiDataset).filter(isCompleteKanjiItem),
    [dictionaryQuery.data?.items, libraryKanjiQuery.data?.items]
  )
  const filteredByJlpt = useMemo(
    () => allKanji.filter((item) => jlpt === 'all' || item.jlpt_level === jlpt),
    [allKanji, jlpt]
  )
  const visibleKanji = useMemo(
    () => searchKanjiDataset(filteredByJlpt, search),
    [filteredByJlpt, search]
  )
  const currentItem = visibleKanji[currentIndex % Math.max(visibleKanji.length, 1)]

  useEffect(() => {
    setCurrentIndex(0)
  }, [jlpt, search, mode])

  const previousCard = () => {
    setCurrentIndex((index) => (visibleKanji.length ? (index - 1 + visibleKanji.length) % visibleKanji.length : 0))
  }
  const nextCard = () => {
    setCurrentIndex((index) => (visibleKanji.length ? (index + 1) % visibleKanji.length : 0))
  }
  const randomCard = () => {
    setCurrentIndex((index) => {
      if (visibleKanji.length <= 1) return 0
      let nextIndex = index
      while (nextIndex === index) nextIndex = Math.floor(Math.random() * visibleKanji.length)
      return nextIndex
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm sm:p-5"
    >
      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">Games / Kanji</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">JLPT Kanji Learning</h1>
            <p className="mt-1 text-sm text-gray-500">{visibleKanji.length} complete cards available.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={jlpt} onChange={(event) => setJlpt(event.target.value)} className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
              {jlptLevels.map((level) => <option key={level} value={level}>{level === 'all' ? 'All JLPT' : level}</option>)}
            </select>
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
              {kanjiModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search kanji, meaning, onyomi, kunyomi, romaji, or example word"
              className="w-full rounded-xl border border-orange-100 bg-orange-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none focus:border-orange-300 focus:bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {kanjiModes.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === item.value ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!currentItem && mode !== 'vocabulary' && (
        <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-600">No kanji found for current filter.</div>
      )}

      {mode === 'study' && currentItem && (
        <StudyMode
          item={currentItem}
          index={currentIndex}
          total={visibleKanji.length}
          onPrevious={previousCard}
          onNext={nextCard}
          onRandom={randomCard}
          onOpenQuiz={() => setMode('quiz')}
        />
      )}
      {mode === 'quiz' && currentItem && <QuizMode items={visibleKanji} currentItem={currentItem} />}
      {mode === 'search' && <SearchMode items={visibleKanji} />}
      {mode === 'vocabulary' && <VocabularyGrid jlpt={jlpt} kanjiItems={visibleKanji.length ? visibleKanji : filteredByJlpt} />}

      {dictionaryQuery.isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Backend kanji dictionary is unavailable, so Library and built-in JLPT fallback data are being used.
        </div>
      )}
    </motion.div>
  )
}
