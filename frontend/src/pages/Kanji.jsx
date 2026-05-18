import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Compass, PenLine, Search } from 'lucide-react'
import KanjiCanvas from '../components/kanji/KanjiCanvas'
import KanjiInfoPanel from '../components/kanji/KanjiInfoPanel'
import PredictionResult from '../components/kanji/PredictionResult'
import { kanjiRecognitionAPI } from '../services/api'

const practiceKanji = [
  { kanji: '猫', meaning: 'cat', onyomi: 'ビョウ', kunyomi: 'ねこ', strokes: 11, jlpt: 'N4' },
  { kanji: '水', meaning: 'water', onyomi: 'スイ', kunyomi: 'みず', strokes: 4, jlpt: 'N5' },
  { kanji: '語', meaning: 'language', onyomi: 'ゴ', kunyomi: 'かたる', strokes: 14, jlpt: 'N5' },
  { kanji: '書', meaning: 'write', onyomi: 'ショ', kunyomi: 'かく', strokes: 10, jlpt: 'N5' },
  { kanji: '駅', meaning: 'station', onyomi: 'エキ', kunyomi: '-', strokes: 14, jlpt: 'N5' },
  { kanji: '描', meaning: 'draw', onyomi: 'ビョウ', kunyomi: 'えがく', strokes: 11, jlpt: 'N2' },
]

const modes = [
  { id: 'recognize', label: 'Recognize', icon: Search },
  { id: 'practice', label: 'Practice', icon: PenLine },
  { id: 'explore', label: 'Explore', icon: Compass },
]

export default function Kanji() {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('recognize')
  const [targetKanji, setTargetKanji] = useState(practiceKanji[0].kanji)
  const [status, setStatus] = useState('idle')
  const [predictions, setPredictions] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState('')

  const targetInfo = useMemo(
    () => practiceKanji.find((item) => item.kanji === targetKanji) || practiceKanji[0],
    [targetKanji]
  )

  const recognize = async () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setStatus('empty')
      setPredictions([])
      setError('')
      return
    }

    if (mode === 'practice') {
      const strokeCount = canvasRef.current.getStrokes().length
      const difference = Math.abs(strokeCount - targetInfo.strokes)
      setPracticeFeedback(
        difference <= 2
          ? `Good practice for ${targetInfo.kanji}. Stroke count looks close.`
          : `Keep practicing ${targetInfo.kanji}. Try to use around ${targetInfo.strokes} strokes.`
      )
      return
    }

    setStatus('loading')
    setError('')
    setPracticeFeedback('')

    try {
      const response = await kanjiRecognitionAPI.recognize({
        image_base64: canvasRef.current.getImage(),
        strokes: canvasRef.current.getStrokes(),
        width: 720,
        height: 520,
      })
      const nextPredictions = response.data?.predictions || []

      setIsDemo(Boolean(response.data?.isDemo))

      if (!nextPredictions.length) {
        setStatus('error')
        setPredictions([])
        setError('Kanji not recognized')
        return
      }

      setPredictions(nextPredictions)
      setRecent((items) => [nextPredictions[0], ...items].slice(0, 8))
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setPredictions([])
      setError(requestError?.response?.data?.detail || 'Kanji not recognized')
    }
  }

  const selectPracticeKanji = (kanji) => {
    setTargetKanji(kanji)
    setMode('practice')
    setPracticeFeedback('')
    setStatus('idle')
    setPredictions([])
    requestAnimationFrame(() => canvasRef.current?.clear())
  }

  const canvasMode = mode === 'practice' ? 'practice' : 'free'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">HineGoldAI handwriting lab</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-950">Kanji Canvas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Recognize handwriting, practice a target kanji, or explore JLPT suggestions. Chat can open this as a compact handwriting input.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1">
            {modes.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                    mode === item.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {mode === 'explore' ? (
        <div className="rounded-3xl border border-white bg-white/90 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-violet-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-950">Explore JLPT Kanji</h2>
              <p className="text-sm text-gray-500">Select a card to practice it with a canvas template.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {practiceKanji.map((item) => (
              <button
                key={item.kanji}
                type="button"
                onClick={() => selectPracticeKanji(item.kanji)}
                className="rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-50"
              >
                <div className="flex items-start justify-between">
                  <p className="font-japanese text-5xl font-bold text-gray-950">{item.kanji}</p>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">{item.jlpt}</span>
                </div>
                <p className="mt-4 text-sm font-bold text-gray-950">{item.meaning}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.onyomi} · {item.kunyomi} · {item.strokes} strokes
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <KanjiInfoPanel recent={recent} onSelectSuggested={selectPracticeKanji} />
          <section className="space-y-4">
            {mode === 'practice' ? (
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-violet-900">Practice target</p>
                    <p className="mt-1 text-sm text-violet-700">
                      {targetInfo.meaning} · {targetInfo.onyomi} · {targetInfo.kunyomi} · {targetInfo.strokes} strokes · {targetInfo.jlpt}
                    </p>
                  </div>
                  <input
                    value={targetKanji}
                    onChange={(event) => {
                      setTargetKanji(event.target.value.slice(0, 1) || targetInfo.kanji)
                      setPracticeFeedback('')
                    }}
                    className="h-12 w-24 rounded-2xl border border-violet-200 bg-white text-center font-japanese text-2xl font-bold text-gray-950 outline-none focus:ring-4 focus:ring-violet-100"
                    aria-label="Practice kanji"
                  />
                </div>
                {practiceFeedback && (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-violet-800">
                    {practiceFeedback}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 text-sm font-medium text-violet-800">
                Blank canvas recognition uses demo predictions until a real handwriting model is connected.
              </div>
            )}

            <KanjiCanvas
              ref={canvasRef}
              mode={canvasMode}
              templateKanji={targetKanji}
              disabled={status === 'loading'}
              onRecognize={recognize}
              onStrokeChange={() => status === 'empty' && setStatus('idle')}
            />
          </section>
          <PredictionResult predictions={predictions} status={status} error={error} isDemo={isDemo} />
        </div>
      )}
    </motion.div>
  )
}
