import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, Compass, MessageCircle, Pause, PenLine, Play, RotateCcw, Search, SkipBack, SkipForward } from 'lucide-react'
import KanjiCanvas from '../components/kanji/KanjiCanvas'
import KanjiInfoPanel from '../components/kanji/KanjiInfoPanel'
import KanjiStrokeOrder from '../components/kanji/KanjiStrokeOrder'
import PredictionResult from '../components/kanji/PredictionResult'
import { kanjiDataAPI, kanjiRecognitionAPI } from '../services/api'

function readableError(value, fallback = 'Kanji not recognized') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((item) => readableError(item, '')).filter(Boolean).join('; ') || fallback
  }
  if (typeof value === 'object') {
    if (typeof value.msg === 'string') return value.msg
    if (typeof value.message === 'string') return value.message
    if (typeof value.detail === 'string') return value.detail
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }
  return String(value)
}

const kanjiDictionary = [
  {
    kanji: '猫',
    meaning: 'cat',
    onyomi: 'ビョウ',
    kunyomi: 'ねこ',
    strokes: 11,
    jlpt: 'N4',
    examples: ['猫が好きです。', '子猫は小さいです。'],
    vocabulary: ['猫 - cat', '子猫 - kitten', '愛猫 - pet cat'],
  },
  {
    kanji: '日',
    meaning: 'sun, day',
    onyomi: 'ニチ / ジツ',
    kunyomi: 'ひ / か',
    strokes: 4,
    jlpt: 'N5',
    examples: ['今日は日曜日です。', '日本語を勉強します。'],
    vocabulary: ['日本 - Japan', '今日 - today', '日曜日 - Sunday'],
  },
  {
    kanji: '月',
    meaning: 'moon, month',
    onyomi: 'ゲツ / ガツ',
    kunyomi: 'つき',
    strokes: 4,
    jlpt: 'N5',
    examples: ['月がきれいです。', '来月日本へ行きます。'],
    vocabulary: ['月曜日 - Monday', '来月 - next month', '一月 - January'],
  },
  {
    kanji: '水',
    meaning: 'water',
    onyomi: 'スイ',
    kunyomi: 'みず',
    strokes: 4,
    jlpt: 'N5',
    examples: ['水を飲みます。', '水曜日に会いましょう。'],
    vocabulary: ['水 - water', '水曜日 - Wednesday', '水泳 - swimming'],
  },
  {
    kanji: '木',
    meaning: 'tree, wood',
    onyomi: 'モク / ボク',
    kunyomi: 'き',
    strokes: 4,
    jlpt: 'N5',
    examples: ['大きい木があります。', '木曜日は忙しいです。'],
    vocabulary: ['木 - tree', '木曜日 - Thursday', '木材 - lumber'],
  },
  {
    kanji: '火',
    meaning: 'fire',
    onyomi: 'カ',
    kunyomi: 'ひ',
    strokes: 4,
    jlpt: 'N5',
    examples: ['火を使います。', '火曜日にテストがあります。'],
    vocabulary: ['火 - fire', '火曜日 - Tuesday', '花火 - fireworks'],
  },
  {
    kanji: '人',
    meaning: 'person',
    onyomi: 'ジン / ニン',
    kunyomi: 'ひと',
    strokes: 2,
    jlpt: 'N5',
    examples: ['あの人は先生です。', '日本人です。'],
    vocabulary: ['人 - person', '日本人 - Japanese person', '一人 - one person'],
  },
  {
    kanji: '大',
    meaning: 'big, large',
    onyomi: 'ダイ / タイ',
    kunyomi: 'おおきい',
    strokes: 3,
    jlpt: 'N5',
    examples: ['大きい学校です。', '大学で勉強します。'],
    vocabulary: ['大きい - big', '大学 - university', '大人 - adult'],
  },
  {
    kanji: '小',
    meaning: 'small',
    onyomi: 'ショウ',
    kunyomi: 'ちいさい / こ',
    strokes: 3,
    jlpt: 'N5',
    examples: ['小さい猫です。', '小学校に行きます。'],
    vocabulary: ['小さい - small', '小学校 - elementary school', '小人 - child'],
  },
  {
    kanji: '学',
    meaning: 'study, learning',
    onyomi: 'ガク',
    kunyomi: 'まなぶ',
    strokes: 8,
    jlpt: 'N5',
    examples: ['日本語を学びます。', '学生です。'],
    vocabulary: ['学生 - student', '学校 - school', '大学 - university'],
  },
  {
    kanji: '先',
    meaning: 'ahead, previous',
    onyomi: 'セン',
    kunyomi: 'さき',
    strokes: 6,
    jlpt: 'N5',
    examples: ['先生に聞きます。', '先に行きます。'],
    vocabulary: ['先生 - teacher', '先週 - last week', '先月 - last month'],
  },
  {
    kanji: '生',
    meaning: 'life, birth',
    onyomi: 'セイ / ショウ',
    kunyomi: 'いきる / うまれる',
    strokes: 5,
    jlpt: 'N5',
    examples: ['学生です。', '日本で生まれました。'],
    vocabulary: ['学生 - student', '先生 - teacher', '生活 - life'],
  },
]

const modes = [
  { id: 'recognize', label: 'Recognize', icon: Search },
  { id: 'practice', label: 'Practice', icon: PenLine },
  { id: 'stroke', label: 'Stroke Order', icon: Play },
  { id: 'explore', label: 'Explore', icon: Compass },
]
const RECOGNITION_CONFIDENCE_THRESHOLD = 0.65

const chars = (...codes) => String.fromCharCode(...codes)
const kanjiAliases = new Map([
  [chars(0xe7, 0x0152, 0xab), '猫'],
  [chars(0xe6, 0x2014, 0xa5), '日'],
  [chars(0xe6, 0x0153, 0x02c6), '月'],
  [chars(0xe6, 0xb0, 0xb4), '水'],
  [chars(0xe6, 0x0153, 0xa8), '木'],
  [chars(0xe7, 0x0081, 0xab), '火'],
  [chars(0xe4, 0xba, 0xba), '人'],
  [chars(0xe5, 0xa4, 0xa7), '大'],
  [chars(0xe5, 0xb0, 0x008f), '小'],
  [chars(0xe5, 0xad, 0xa6), '学'],
  [chars(0xe5, 0x0085, 0x0088), '先'],
  [chars(0xe7, 0x201d, 0x0178), '生'],
])
kanjiAliases.set(chars(0xe7, 0x0152, 0xab), '\u732b')
kanjiAliases.set(chars(0xe6, 0x2014, 0xa5), '\u65e5')
kanjiAliases.set(chars(0xe6, 0x0153, 0x02c6), '\u6708')
kanjiAliases.set(chars(0xe6, 0xb0, 0xb4), '\u6c34')
kanjiAliases.set(chars(0xe6, 0x0153, 0xa8), '\u6728')
kanjiAliases.set(chars(0xe7, 0x0081, 0xab), '\u706b')
kanjiAliases.set(chars(0xe4, 0xba, 0xba), '\u4eba')
kanjiAliases.set(chars(0xe5, 0xa4, 0xa7), '\u5927')
kanjiAliases.set(chars(0xe5, 0xb0, 0x008f), '\u5c0f')
kanjiAliases.set(chars(0xe5, 0xad, 0xa6), '\u5b66')
kanjiAliases.set(chars(0xe5, 0x0085, 0x0088), '\u5148')
kanjiAliases.set(chars(0xe7, 0x201d, 0x0178), '\u751f')

function normalizeKanji(kanji) {
  return kanjiAliases.get(kanji) || kanji
}

function getKanjiInfo(kanji) {
  const normalized = normalizeKanji(kanji)
  const item = kanjiDictionary.find((entry) => normalizeKanji(entry.kanji) === normalized)
  return item ? { ...item, kanji: normalized } : {
    kanji: normalized,
    meaning: 'Unknown',
    onyomi: '-',
    kunyomi: '-',
    strokes: null,
    jlpt: '-',
    examples: [],
    vocabulary: [],
  }
}

function readingText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ') || '-'
  return value || '-'
}

function adaptKanjiEntry(entry, fallbackKanji = '') {
  if (!entry) return null
  const examples = Array.isArray(entry.examples) ? entry.examples : []
  const hasMeaning = Boolean(entry.meaning || entry.meaning_vi)
  return {
    kanji: normalizeKanji(entry.kanji || fallbackKanji),
    meaning: entry.meaning || entry.meaning_vi || 'Meaning metadata is not filled yet.',
    metadataComplete: Boolean(entry.metadata_complete && hasMeaning),
    onyomi: readingText(entry.onyomi),
    kunyomi: readingText(entry.kunyomi),
    onyomiList: Array.isArray(entry.onyomi) ? entry.onyomi : [],
    kunyomiList: Array.isArray(entry.kunyomi) ? entry.kunyomi : [],
    strokes: entry.strokes || entry.stroke_count || null,
    jlpt: entry.jlpt || '-',
    examples,
    vocabulary: examples.map((example) => `${example.word || ''}${example.reading ? ` (${example.reading})` : ''}${example.meaning ? ` - ${example.meaning}` : ''}`.trim()).filter(Boolean),
    has_handwriting_data: Boolean(entry.has_handwriting_data),
  }
}

function StrokeOrderViewer({ info, step, setStep }) {
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)
  const strokeQuery = useQuery(
    ['kanjivgStrokeOrder', info.kanji],
    () => kanjiDataAPI.getStrokeOrder(info.kanji).then((response) => response.data),
    {
      enabled: Boolean(info?.kanji),
      staleTime: 1000 * 60 * 60 * 24,
      cacheTime: 1000 * 60 * 60 * 24,
      retry: false,
    }
  )
  const supportedQuery = useQuery(
    'kanjivgSupported',
    () => kanjiDataAPI.getSupported().then((response) => response.data),
    {
      staleTime: 1000 * 60 * 60 * 24,
      cacheTime: 1000 * 60 * 60 * 24,
      retry: false,
    }
  )

  const strokeData = strokeQuery.data
  const strokes = strokeData?.available ? (strokeData?.strokes || []) : []
  const maxStep = strokes.length
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
    }
  }, [])

  const pause = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
  }

  const play = () => {
    if (!maxStep) return
    pause()
    setPlaying(true)
    let next = step >= maxStep ? 0 : step || 0
    timerRef.current = window.setInterval(() => {
      next += 1
      setStep(Math.min(next, maxStep))
      if (next >= maxStep) {
        pause()
        setPlaying(false)
      }
    }, 650)
  }

  const reset = () => {
    pause()
    setStep(0)
  }

  return (
    <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">KanjiVG stroke order</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">{info.kanji} stroke steps</h2>
          <p className="mt-1 text-sm text-gray-500">Verified SVG path data is loaded dynamically from KanjiVG. Supported now: {supportedQuery.data?.total ?? 'loading'}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={!maxStep || step === 0} className="btn btn-outline rounded-xl border-violet-200 px-3 text-violet-700">
            <SkipBack className="mr-2 h-4 w-4" /> Previous Stroke
          </button>
          <button type="button" onClick={() => setStep(Math.min(maxStep, step + 1))} disabled={!maxStep || step >= maxStep} className="btn btn-outline rounded-xl border-violet-200 px-3 text-violet-700">
            <SkipForward className="mr-2 h-4 w-4" /> Next Stroke
          </button>
          <button type="button" onClick={play} disabled={!maxStep || playing} className="btn btn-primary rounded-xl px-3 text-white">
            <Play className="mr-2 h-4 w-4" /> Auto Play
          </button>
          <button type="button" onClick={pause} disabled={!playing} className="btn btn-outline rounded-xl border-gray-200 px-3">
            <Pause className="mr-2 h-4 w-4" /> Pause
          </button>
          <button type="button" onClick={reset} disabled={!maxStep && step === 0} className="btn btn-outline rounded-xl border-gray-200 px-3">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <KanjiStrokeOrder kanji={info.kanji} strokeOrder={strokeData} strokes={strokes} step={step} viewBox={strokeData?.viewBox} />
        <div className="rounded-3xl bg-violet-50 p-5">
          <p className="font-japanese text-7xl font-bold text-gray-950">{info.kanji}</p>
          <div className="mt-5 space-y-2 text-sm">
            <p><span className="font-bold">Meaning:</span> {info.meaning}</p>
            <p><span className="font-bold">Onyomi:</span> {info.onyomi}</p>
            <p><span className="font-bold">Kunyomi:</span> {info.kunyomi}</p>
            <p><span className="font-bold">Stroke count:</span> {strokeData?.stroke_count || info.strokes || 'Unknown'}</p>
            <p><span className="font-bold">JLPT:</span> {strokeData?.jlpt || info.jlpt}</p>
          </div>
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-violet-800">
            {strokeQuery.isLoading ? 'Loading stroke data...' : `Step ${step} / ${maxStep || 'unavailable'}`}
          </p>
          {strokeData && (
            <p className="mt-3 text-xs font-semibold text-violet-700">
              Source: {strokeData.source}. {strokeData.license}. {strokeData.source_url}
            </p>
          )}
          {strokeQuery.isError && (
            <p className="mt-3 text-xs font-semibold text-red-600">
              No KanjiVG stroke order data available.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniDictionary({ info, onAsk, onPractice, onStroke }) {
  const handwritingQuery = useQuery(
    ['kanjiHandwritingSamples', info?.kanji],
    () => kanjiDataAPI.getHandwritingSamples(info.kanji, 5).then((response) => response.data),
    {
      enabled: Boolean(info?.kanji),
      staleTime: 1000 * 60 * 10,
      retry: false,
    }
  )
  if (!info?.kanji) return null

  return (
    <aside className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Mini dictionary</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-violet-50 font-japanese text-5xl font-bold text-gray-950">
          {info.kanji}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-950">{info.meaning}</h2>
          <p className="mt-1 text-xs font-bold text-orange-600">{info.jlpt} · {info.strokes || '-'} strokes</p>
          <p className="mt-2 text-sm text-gray-600">{info.onyomi} · {info.kunyomi}</p>
          <p className="mt-2 text-xs font-semibold text-gray-500">{info.has_handwriting_data ? 'ETL10 handwriting data available' : 'Synthetic training data only'}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4 text-sm">
        <div>
          <p className="font-bold text-gray-950">Examples</p>
          <div className="mt-2 space-y-2">
            {(info.examples || []).map((example, index) => (
              <p key={`${example.word || example}-${index}`} className="rounded-2xl bg-gray-50 px-4 py-2 font-japanese text-gray-700">
                {typeof example === 'string' ? example : `${example.word || ''}${example.reading ? ` (${example.reading})` : ''}${example.meaning ? ` - ${example.meaning}` : ''}`}
              </p>
            ))}
            {!(info.examples || []).length && <p className="rounded-2xl bg-gray-50 px-4 py-2 text-gray-500">Kanji data not found in local dictionary.</p>}
          </div>
        </div>
        <div>
          <p className="font-bold text-gray-950">ETL10 handwriting samples</p>
          {handwritingQuery.data?.items?.length ? (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {handwritingQuery.data.items.map((item) => (
                <img key={item.filename} src={item.image_data} alt={`${info.kanji} handwriting sample`} className="h-12 w-12 rounded-xl border border-gray-100 bg-white object-contain p-1" />
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-2xl bg-gray-50 px-4 py-2 text-gray-500">No handwriting samples available.</p>
          )}
        </div>
        <div>
          <p className="font-bold text-gray-950">Related vocabulary</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(info.vocabulary || []).map((item) => (
              <span key={item} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{item}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={onAsk} className="btn btn-primary rounded-xl px-4 text-white">
          <MessageCircle className="mr-2 h-4 w-4" /> Ask in Chat
        </button>
        <button type="button" onClick={onPractice} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700">Practice this Kanji</button>
        <button type="button" onClick={onStroke} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700">View stroke order</button>
      </div>
    </aside>
  )
}

function getStrokeBounds(strokes) {
  const points = strokes.flat()
  if (!points.length) return null
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  )
}

function scorePractice({ target, expectedStrokes, rawStrokes, normalizedStrokes }) {
  const userStrokes = normalizedStrokes.length
  const bounds = getStrokeBounds(normalizedStrokes)
  const strokeDiff = expectedStrokes ? Math.abs(userStrokes - expectedStrokes) : 0
  const strokeCountScore = expectedStrokes ? Math.max(0, 20 - strokeDiff * 8) : 10
  const aspect = bounds ? (bounds.maxX - bounds.minX) / Math.max(1, bounds.maxY - bounds.minY) : 1
  const centerX = bounds ? (bounds.minX + bounds.maxX) / 2 / 256 : 0.5
  const centerY = bounds ? (bounds.minY + bounds.maxY) / 2 / 256 : 0.5
  const centerOffset = Math.hypot(centerX - 0.5, centerY - 0.5)
  const sizeRatio = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 256 : 0
  const horizontalStrokes = normalizedStrokes.filter((stroke) => stroke.length > 1 && Math.abs(stroke.at(-1).x - stroke[0].x) > Math.abs(stroke.at(-1).y - stroke[0].y) * 1.25).length
  const verticalStrokes = normalizedStrokes.filter((stroke) => stroke.length > 1 && Math.abs(stroke.at(-1).y - stroke[0].y) > Math.abs(stroke.at(-1).x - stroke[0].x) * 1.25).length
  const isTsuki = target === '\u6708' || target === '月'
  const idealAspect = isTsuki ? 0.55 : 0.75
  const shapeScore = Math.max(8, Math.round(25 - Math.abs(aspect - idealAspect) * 18 - Math.abs(horizontalStrokes - (isTsuki ? 2 : horizontalStrokes)) * 3 - Math.abs(verticalStrokes - (isTsuki ? 2 : verticalStrokes)) * 2))
  const positionScore = Math.max(3, Math.round(15 - centerOffset * 28 - Math.abs(sizeRatio - 0.74) * 10))
  const proportionScore = Math.max(2, Math.round(10 - Math.abs(aspect - idealAspect) * 8))
  const smoothnessPenalty = rawStrokes.reduce((sum, stroke) => sum + (stroke.length < 5 ? 2 : 0), 0)
  const smoothnessScore = Math.max(3, 10 - smoothnessPenalty)
  const orderScore = expectedStrokes && userStrokes === expectedStrokes ? (isTsuki && verticalStrokes >= 1 && horizontalStrokes >= 2 ? 16 : 14) : 8
  const overall = Math.min(100, Math.round(strokeCountScore + orderScore + shapeScore + positionScore + proportionScore + smoothnessScore))
  const grade = overall >= 88 ? 'Excellent' : overall >= 72 ? 'Good' : overall >= 55 ? 'Fair' : 'Needs practice'
  const wide = aspect > idealAspect + 0.22
  const offCenter = centerOffset > 0.08

  return {
    target_kanji: target,
    overall_score: overall,
    grade,
    summary: isTsuki
      ? wide
        ? 'You used the correct general structure, but the right side is too wide, so it can look closer to 用.'
        : 'Your 月 is recognizable. Keep the inner horizontal strokes parallel and evenly spaced.'
      : 'Your kanji is recognizable, but compare the proportions and stroke order with the reference.',
    scores: {
      stroke_count: { score: strokeCountScore, max: 20, feedback: expectedStrokes ? `${strokeDiff === 0 ? 'Correct.' : 'Needs work.'} ${target} has ${expectedStrokes} strokes and you wrote ${userStrokes}.` : `You wrote ${userStrokes} strokes.` },
      stroke_order: { score: orderScore, max: 20, feedback: isTsuki ? 'For 月, draw the left vertical stroke first, then the top-right outer stroke, then the middle and lower horizontal strokes.' : 'Compare your stroke sequence with the expected stroke order.' },
      shape_similarity: { score: shapeScore, max: 25, feedback: wide ? 'The right side is too wide. Make the outer frame narrower.' : 'The overall shape is close to the target kanji.' },
      position_size: { score: positionScore, max: 15, feedback: offCenter ? 'The kanji is slightly off-center. Try placing it in the middle of the grid.' : 'The kanji is placed well inside the grid.' },
      proportion_balance: { score: proportionScore, max: 10, feedback: isTsuki ? 'Keep the middle and lower horizontal strokes evenly spaced and parallel.' : 'Keep stroke spacing and width-height balance consistent.' },
      stroke_smoothness: { score: smoothnessScore, max: 10, feedback: smoothnessScore < 8 ? 'Some strokes are shaky or too short. Write slightly slower.' : 'Stroke smoothness looks steady.' },
    },
    strengths: [strokeDiff === 0 ? 'Correct stroke count.' : 'You completed the main structure.', 'Overall structure is recognizable.', isTsuki ? 'The outer frame is close to 月.' : 'The drawing fits the practice grid.'],
    improvements: [wide ? 'Make the right side narrower.' : 'Keep the outer frame consistent.', 'Align the inner strokes more evenly.', 'Center the kanji in the grid.', 'Write each stroke slowly and deliberately.'],
    next_practice_tip: isTsuki ? 'Practice the second stroke slowly because it defines the outer shape of 月.' : 'Replay the stroke order once, then write the kanji again at a steady pace.',
  }
}

export default function Kanji() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('recognize')
  const [targetKanji, setTargetKanji] = useState('月')
  const [status, setStatus] = useState('idle')
  const [predictions, setPredictions] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [lastRecognitionPayload, setLastRecognitionPayload] = useState(null)
  const [correctionStatus, setCorrectionStatus] = useState('')
  const [recognitionMessage, setRecognitionMessage] = useState('')
  const [lowConfidence, setLowConfidence] = useState(false)
  const [selectedKanjiSource, setSelectedKanjiSource] = useState(null)
  const [practiceFeedback, setPracticeFeedback] = useState(null)
  const [feedbackTab, setFeedbackTab] = useState('overview')
  const [strokeStep, setStrokeStep] = useState(0)
  const [exploreSearch, setExploreSearch] = useState('')
  const [exploreJlpt, setExploreJlpt] = useState('all')

  const dictionaryQuery = useQuery(
    ['kanjiDictionary', exploreJlpt, exploreSearch],
    () => kanjiDataAPI.list({ jlpt: exploreJlpt, search: exploreSearch || undefined, limit: 300, offset: 0 }).then((response) => response.data),
    {
      staleTime: 1000 * 60 * 10,
      cacheTime: 1000 * 60 * 30,
      retry: false,
    }
  )
  const detailQuery = useQuery(
    ['kanjiDictionaryDetail', targetKanji],
    () => kanjiDataAPI.get(normalizeKanji(targetKanji)).then((response) => response.data),
    {
      enabled: Boolean(targetKanji),
      staleTime: 1000 * 60 * 10,
      cacheTime: 1000 * 60 * 30,
      retry: false,
    }
  )
  const dictionaryItems = useMemo(() => (dictionaryQuery.data?.items || []).map((entry) => adaptKanjiEntry(entry)).filter(Boolean), [dictionaryQuery.data])
  const selectedInfo = useMemo(() => {
    const fromDetail = adaptKanjiEntry(detailQuery.data, targetKanji)
    if (fromDetail) return fromDetail
    return dictionaryItems.find((entry) => entry.kanji === normalizeKanji(targetKanji)) || getKanjiInfo(targetKanji)
  }, [detailQuery.data, dictionaryItems, targetKanji])
  const metadataQuery = useQuery(
    ['kanjivgMetadata', selectedInfo.kanji],
    () => kanjiDataAPI.getMetadata(selectedInfo.kanji).then((response) => response.data),
    {
      enabled: Boolean(selectedInfo.kanji) && (mode === 'practice' || mode === 'stroke'),
      staleTime: 1000 * 60 * 60 * 24,
      cacheTime: 1000 * 60 * 60 * 24,
      retry: false,
    }
  )
  const practiceStrokeQuery = useQuery(
    ['kanjivgPracticeStrokes', selectedInfo.kanji],
    () => kanjiDataAPI.getStrokeOrder(selectedInfo.kanji).then((response) => response.data),
    {
      enabled: Boolean(selectedInfo.kanji) && mode === 'practice',
      staleTime: 1000 * 60 * 60 * 24,
      cacheTime: 1000 * 60 * 60 * 24,
      retry: false,
    }
  )
  const modelInfoQuery = useQuery(
    'kanjiModelInfo',
    () => kanjiRecognitionAPI.getModelInfo().then((response) => response.data),
    {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: false,
    }
  )
  const selectedStrokeCount = metadataQuery.data?.stroke_count || selectedInfo.strokes

  const updateSelectedKanji = (kanji, source = 'manual') => {
    setTargetKanji(normalizeKanji(kanji))
    setSelectedKanjiSource(source)
    setStrokeStep(0)
  }

  const checkPractice = () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setPracticeFeedback({ tone: 'error', overall_score: 0, grade: 'Needs practice', summary: 'You have not written anything yet.', scores: {}, strengths: [], improvements: ['Write the kanji inside the grid first.'], next_practice_tip: 'Start with the first stroke and keep it inside the guide box.' })
      return
    }

    const normalizedStrokes = canvasRef.current.getStrokes()
    const rawStrokes = canvasRef.current.getRawStrokes?.() || normalizedStrokes
    setFeedbackTab('overview')
    setPracticeFeedback(scorePractice({ target: selectedInfo.kanji, expectedStrokes: selectedStrokeCount, rawStrokes, normalizedStrokes }))
  }

  const recognize = async () => {
    if (mode === 'practice') {
      checkPractice()
      return
    }

    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setStatus('empty')
      setPredictions([])
      setSelectedKanjiSource(null)
      setError('')
      return
    }

    setStatus('loading')
    setError('')
    setCorrectionStatus('')
    setRecognitionMessage('')
    setLowConfidence(false)

    try {
      const payload = {
        image_data: canvasRef.current.getImage(),
        strokes: canvasRef.current.getStrokes() || [],
        target_kanji: selectedInfo.kanji || null,
        jlpt_level: selectedInfo.jlpt && selectedInfo.jlpt !== '-' ? selectedInfo.jlpt : 'N5',
      }
      setLastRecognitionPayload(payload)
      const response = await kanjiRecognitionAPI.recognize(payload)
      const nextPredictions = response.data?.predictions || []
      const recognitionSucceeded = response.data?.success !== false

      setIsDemo(Boolean(response.data?.isDemo))
      setRecognitionMessage(readableError(response.data?.message, ''))
      setLowConfidence(Boolean(response.data?.low_confidence))

      if (!recognitionSucceeded || !nextPredictions.length) {
        setStatus('error')
        setPredictions([])
        setSelectedKanjiSource(null)
        setError(readableError(response.data?.message, 'Kanji not recognized'))
        return
      }

      setPredictions(nextPredictions)
      setRecent((items) => [nextPredictions[0], ...items].slice(0, 8))
      if (Number(nextPredictions[0].confidence) >= RECOGNITION_CONFIDENCE_THRESHOLD) {
        updateSelectedKanji(nextPredictions[0].kanji, 'prediction')
        setStatus('success')
      } else {
        setSelectedKanjiSource(null)
        setStatus('low_confidence')
      }
    } catch (requestError) {
      setStatus('error')
      setPredictions([])
      setSelectedKanjiSource(null)
      setError(readableError(requestError?.response?.data?.detail || requestError?.message))
    }
  }

  const submitCorrection = async (correctKanji) => {
    const normalized = normalizeKanji(correctKanji).slice(0, 1)
    if (!lastRecognitionPayload?.image_data || !normalized) return
    try {
      await kanjiRecognitionAPI.correct({
        image_data: lastRecognitionPayload.image_data,
        strokes: lastRecognitionPayload.strokes || [],
        predicted_kanji: predictions[0]?.kanji || null,
        correct_kanji: normalized,
        jlpt_level: lastRecognitionPayload.jlpt_level || null,
      })
      setCorrectionStatus('Correction saved for future training.')
      updateSelectedKanji(normalized, 'manual')
    } catch (requestError) {
      setCorrectionStatus(readableError(requestError?.response?.data?.detail || requestError?.message, 'Could not save correction.'))
    }
  }

  const switchToPractice = (kanji = targetKanji) => {
    updateSelectedKanji(kanji, 'manual')
    setMode('practice')
    setPracticeFeedback(null)
    setStatus('idle')
    setPredictions([])
    requestAnimationFrame(() => canvasRef.current?.clear())
  }

  const switchToStroke = (kanji = targetKanji) => {
    updateSelectedKanji(kanji, 'manual')
    setMode('stroke')
  }

  const askInChat = () => {
    navigate('/chat', {
      state: {
        prefillMessage: `Explain the Kanji ${selectedInfo.kanji} with readings, meaning, examples, and common words.`,
      },
    })
  }

  const canvasMode = mode === 'practice' ? 'practice' : 'free'
  const canShowKanjiDetails =
    selectedInfo?.kanji &&
    (
      mode !== 'recognize' ||
      status === 'success' ||
      selectedKanjiSource === 'manual'
    )

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="space-y-6">
      <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">HineGoldAI handwriting lab</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-950">Kanji Canvas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Recognize handwriting, practice with feedback, explore kanji, and study verified stroke order.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 sm:grid-cols-4">
            {modes.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${mode === item.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'}`}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {mode === 'explore' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-white bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-violet-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-950">Explore JLPT Kanji</h2>
                <p className="text-sm text-gray-500">
                  {dictionaryQuery.isError ? 'Kanji dictionary is unavailable.' : `${dictionaryQuery.data?.total || 0} Kanji from the backend dictionary.`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={exploreSearch}
                onChange={(event) => setExploreSearch(event.target.value)}
                placeholder="Search kanji, meaning, reading, or example"
                className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
              <select
                value={exploreJlpt}
                onChange={(event) => setExploreJlpt(event.target.value)}
                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              >
                <option value="all">All JLPT</option>
                <option value="N5">N5</option>
                <option value="N4">N4</option>
              </select>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dictionaryQuery.isLoading && <p className="text-sm text-gray-500">Loading Kanji dictionary...</p>}
              {!dictionaryQuery.isLoading && !dictionaryItems.length && <p className="text-sm text-gray-500">No Kanji found.</p>}
              {dictionaryItems.map((item) => (
                <button key={item.kanji} type="button" onClick={() => updateSelectedKanji(item.kanji)} className="rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-50">
                  <div className="flex items-start justify-between">
                    <p className="font-japanese text-5xl font-bold text-gray-950">{normalizeKanji(item.kanji)}</p>
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">{item.jlpt}</span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-gray-950">{item.meaning}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.onyomi} · {item.kunyomi} · {item.strokes || '-'} strokes</p>
                  <p className="mt-2 text-xs font-semibold text-violet-700">{item.has_handwriting_data ? 'ETL10 data' : 'Synthetic data'}</p>
                </button>
              ))}
            </div>
          </div>
          <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} onStroke={() => switchToStroke()} />
        </div>
      ) : mode === 'stroke' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <StrokeOrderViewer info={selectedInfo} step={strokeStep} setStep={setStrokeStep} />
          <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} onStroke={() => switchToStroke()} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <KanjiInfoPanel recent={recent} onSelectSuggested={switchToPractice} />
          <section className="space-y-4">
            {mode === 'practice' ? (
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-violet-900">Practice target</p>
                    <p className="mt-1 text-sm text-violet-700">{selectedInfo.meaning} · {selectedInfo.onyomi} · {selectedInfo.kunyomi} · {selectedInfo.strokes || '-'} strokes · {selectedInfo.jlpt}</p>
                  </div>
                  <input value={selectedInfo.kanji} onChange={(event) => { updateSelectedKanji(event.target.value.slice(0, 1) || selectedInfo.kanji); setPracticeFeedback(null) }} className="h-12 w-24 rounded-2xl border border-violet-200 bg-white text-center font-japanese text-2xl font-bold text-gray-950 outline-none focus:ring-4 focus:ring-violet-100" aria-label="Practice kanji" />
                </div>
                {practiceFeedback && (
                  <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${practiceFeedback.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-white text-violet-900'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">Practice feedback</p>
                        <p className="mt-1 text-2xl font-black">{practiceFeedback.overall_score}/100 · {practiceFeedback.grade}</p>
                      </div>
                      <div className="flex rounded-xl bg-violet-50 p-1">
                        {['overview', 'scores', 'order', 'compare'].map((tab) => (
                          <button key={tab} type="button" onClick={() => setFeedbackTab(tab)} className={`rounded-lg px-3 py-1 text-xs font-bold capitalize ${feedbackTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-violet-500'}`}>
                            {tab === 'scores' ? 'Detailed Scores' : tab === 'order' ? 'Stroke Order' : tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {feedbackTab === 'overview' && (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="font-semibold">{practiceFeedback.summary}</p>
                          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">{practiceFeedback.next_practice_tip}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="font-bold">Strengths</p>
                            <ul className="mt-2 space-y-1 text-xs">
                              {practiceFeedback.strengths?.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="font-bold">Improvements</p>
                            <ul className="mt-2 space-y-1 text-xs">
                              {practiceFeedback.improvements?.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {feedbackTab === 'scores' && (
                      <div className="mt-4 grid gap-3">
                        {Object.entries(practiceFeedback.scores || {}).map(([key, value]) => (
                          <div key={key} className="rounded-xl bg-gray-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold capitalize">{key.replaceAll('_', ' ')}</p>
                              <p className="text-xs font-black text-violet-700">{value.score}/{value.max}</p>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-white">
                              <div className="h-2 rounded-full bg-violet-600" style={{ width: `${Math.round((value.score / value.max) * 100)}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-gray-600">{value.feedback}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {feedbackTab === 'order' && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-3">
                        <p className="font-bold">Expected stroke order</p>
                        <p className="mt-2 text-sm">For 月: 1. left vertical stroke, 2. top-right outer stroke, 3. middle horizontal stroke, 4. lower horizontal stroke.</p>
                        <p className="mt-3 text-xs font-semibold text-violet-700">User stroke order is estimated from the captured stroke sequence. Replay your strokes and compare with the reference order.</p>
                      </div>
                    )}

                    {feedbackTab === 'compare' && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-3">
                        <p className="font-bold">Compare</p>
                        <div className="mt-3 grid min-h-[180px] place-items-center rounded-xl bg-white">
                          <p className="font-japanese text-8xl font-black text-violet-100">{selectedInfo.kanji}</p>
                          <p className="-mt-16 text-xs font-semibold text-violet-700">Use the canvas replay over the faint reference to compare width, centering, and inner stroke spacing.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-5 py-4 text-sm font-medium text-violet-800">
                {modelInfoQuery.data?.message || `Recognition uses the custom CNN model plus stroke count and JLPT re-ranking. Model: ${modelInfoQuery.data?.model_loaded ? 'loaded' : 'not loaded'}; supports ${(modelInfoQuery.data?.supported_jlpt || ['N5', 'N4']).join('-')} (${modelInfoQuery.data?.total_classes ?? modelInfoQuery.data?.classes_count ?? 0} classes).`}
              </div>
            )}

            <KanjiCanvas ref={canvasRef} mode={canvasMode} templateKanji={selectedInfo.kanji} referenceStrokes={practiceStrokeQuery.data?.available ? (practiceStrokeQuery.data?.strokes || []) : []} disabled={status === 'loading'} onRecognize={recognize} onStrokeChange={() => status === 'empty' && setStatus('idle')} />
          </section>
          {mode === 'recognize' ? (
            <div className="space-y-5">
              <PredictionResult predictions={predictions} status={status} error={error} isDemo={isDemo} correctionStatus={correctionStatus} recognitionMessage={recognitionMessage} lowConfidence={lowConfidence} modelInfo={modelInfoQuery.data} onSelect={(prediction) => updateSelectedKanji(prediction.kanji, 'manual')} onCorrect={submitCorrection} />
              {canShowKanjiDetails && <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} onStroke={() => switchToStroke()} />}
            </div>
          ) : (
            canShowKanjiDetails && <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} onStroke={() => switchToStroke()} />
          )}
        </div>
      )}
    </motion.div>
  )
}
