import { kanjiText as k } from '../utils/kanjiLocale'
import { useMemo, useRef, useState } from 'react'
import { useQuery } from 'react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, Compass, MessageCircle, PenLine, Search } from 'lucide-react'
import KanjiCanvas from '../components/kanji/KanjiCanvas'
import KanjiInfoPanel from '../components/kanji/KanjiInfoPanel'
import KanjiStudy from '../components/kanji/KanjiStudy'
import KanjiWriting from '../components/kanji/KanjiWriting'
import PredictionResult from '../components/kanji/PredictionResult'
import { kanjiDataAPI, kanjiRecognitionAPI } from '../services/api'
import { useTranslation } from 'react-i18next'
import { KANJI_DICTIONARY_LEVELS } from '../constants/jlptLevels'
import { useAuth } from '../services/auth'
import { placementDefault } from '../utils/placementDefaults'

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
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'recognize', label: 'Recognize', icon: Search },
  { id: 'practice', label: 'Practice', icon: PenLine },
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
  const hasMeaning = Boolean(entry.meaning_vi || entry.meaning)
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
    vocabulary: examples.map((example) => `${example.word || ''}${example.reading ? ` (${example.reading})` : ''}${example.meaning ? ` - ${k(example.meaning)}` : ''}`.trim()).filter(Boolean),
    has_handwriting_data: Boolean(entry.has_handwriting_data),
    has_stroke_data: Boolean(entry.has_stroke_data),
  }
}

function MiniDictionary({ info, onAsk, onPractice }) {
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
    <aside className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">{k("Mini dictionary")}</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[color:var(--accent)] font-japanese text-5xl font-bold text-[color:var(--text)]">
          {info.kanji}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[color:var(--text)]">{k(info.meaning)}</h2>
          <p className="mt-1 text-xs font-bold text-[color:var(--primary)]">{info.jlpt} · {info.strokes || '-'}{k("strokes")}</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{info.onyomi} · {info.kunyomi}</p>
          <p className="mt-2 text-xs font-semibold text-[color:var(--text-muted)]">{info.has_handwriting_data ? k("ETL10 handwriting data available") : k("Synthetic training data only")}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4 text-sm">
        <div>
          <p className="font-bold text-[color:var(--text)]">{k("Examples")}</p>
          <div className="mt-2 space-y-2">
            {(info.examples || []).map((example, index) => (
              <p key={`${example.word || example}-${index}`} className="rounded-2xl bg-[color:var(--bg-elevated)] px-4 py-2 font-japanese text-[color:var(--text)]">
                {typeof example === 'string' ? k(example) : `${example.word || ''}${example.reading ? ` (${example.reading})` : ''}${example.meaning ? ` - ${example.meaning}` : ''}`}
              </p>
            ))}
            {!(info.examples || []).length && <p className="rounded-2xl bg-[color:var(--bg-elevated)] px-4 py-2 text-[color:var(--text-muted)]">{k("Kanji data not found in local dictionary.")}</p>}
          </div>
        </div>
        <div>
          <p className="font-bold text-[color:var(--text)]">{k("ETL10 handwriting samples")}</p>
          {handwritingQuery.data?.items?.length ? (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {handwritingQuery.data.items.map((item) => (
                <img key={item.filename} src={item.image_data} alt={k('Handwriting sample for {{kanji}}', { kanji: info.kanji })} className="h-12 w-12 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] object-contain p-1" />
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-2xl bg-[color:var(--bg-elevated)] px-4 py-2 text-[color:var(--text-muted)]">{k("No handwriting samples available.")}</p>
          )}
        </div>
        <div>
          <p className="font-bold text-[color:var(--text)]">{k("Related vocabulary")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(info.vocabulary || []).map((item) => (
              <span key={item} className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]">{k(item)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={onAsk} className="btn btn-primary rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] px-4 text-[color:var(--text)] shadow-sm hover:bg-[color:var(--primary)] hover:text-[color:var(--primary-contrast)]">
          <MessageCircle className="mr-2 h-4 w-4" />{k("Ask in Chat")}</button>
        <button type="button" onClick={onPractice} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)]">{k("Practice this Kanji")}</button>
      </div>
    </aside>
  )
}

export default function Kanji() {
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('kanjiStatus')
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [mode, setMode] = useState(() => ['study', 'practice'].includes(params.get('mode')) ? params.get('mode') : 'recognize')
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
  const [exploreSearch, setExploreSearch] = useState('')
  const [exploreJlpt, setExploreJlpt] = useState(() => placementDefault(params.toString(), user?.current_jlpt_level, [...KANJI_DICTIONARY_LEVELS, 'all'], 'all'))

  const dictionaryQuery = useQuery(
    ['kanjiDictionary', exploreJlpt, exploreSearch],
    () => kanjiDataAPI.list({ jlpt: exploreJlpt, search: exploreSearch || undefined, limit: 500, offset: 0 }).then((response) => response.data),
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
  const modelInfoQuery = useQuery(
    'kanjiModelInfo',
    () => kanjiRecognitionAPI.getModelInfo().then((response) => response.data),
    {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: false,
    }
  )

  const updateSelectedKanji = (kanji, source = 'manual') => {
    setTargetKanji(normalizeKanji(kanji))
    setSelectedKanjiSource(source)
  }

  const recognize = async () => {
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
    setStatus('idle')
    setPredictions([])
    requestAnimationFrame(() => canvasRef.current?.clear())
  }

  const askInChat = () => {
    navigate('/chat', {
      state: {
        prefillMessage: k('Explain kanji {{kanji}}', { kanji: selectedInfo.kanji }),
      },
    })
  }

  const canShowKanjiDetails =
    selectedInfo?.kanji &&
    (
      mode !== 'recognize' ||
      status === 'success' ||
      selectedKanjiSource === 'manual'
    )

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.35, ease: 'easeOut' }} className="kanji-page space-y-6">
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">{k("SenpaiAI handwriting lab")}</p>
            <h1 className="mt-2 text-3xl font-bold text-[color:var(--text)]">{k("Kanji Canvas")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">{k("Recognize handwriting, practice with feedback, and explore kanji.")}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[color:var(--bg-elevated)] p-1 sm:grid-cols-3 xl:grid-cols-4">
            {modes.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${mode === item.id ? 'bg-[color:var(--card)] text-[color:var(--primary)] shadow-sm' : 'text-[color:var(--text-muted)]'}`}>
                  <Icon className="h-4 w-4" />
                  {k(item.label)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {mode === 'study' ? <KanjiStudy /> : mode === 'practice' ? <KanjiWriting initialKanji={selectedInfo.kanji} /> : mode === 'explore' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-[color:var(--primary)]" />
              <div>
                <h2 className="text-xl font-bold text-[color:var(--text)]">{k("Explore JLPT Kanji")}</h2>
                <p className="text-sm text-[color:var(--text-muted)]">
                  {dictionaryQuery.isError ? k("Kanji dictionary is unavailable.") : k('{{count}} Kanji in the dictionary', { count: dictionaryQuery.data?.total || 0 })}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={exploreSearch}
                onChange={(event) => setExploreSearch(event.target.value)}
                placeholder={k("Search kanji, meaning, reading, or example")}
                className="h-11 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm outline-none focus:border-[color:var(--border)] focus:ring-4 focus:ring-[color:var(--primary)]"
              />
              <select
                value={exploreJlpt}
                onChange={(event) => setExploreJlpt(event.target.value)}
                className="h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--border)] focus:ring-4 focus:ring-[color:var(--primary)]"
              >
                <option value="all">{k("All JLPT")}</option>
                {KANJI_DICTIONARY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dictionaryQuery.isLoading && <p className="text-sm text-[color:var(--text-muted)]">{k("Loading Kanji dictionary...")}</p>}
              {!dictionaryQuery.isLoading && !dictionaryItems.length && <div className="rounded-xl bg-[color:var(--accent)] p-4 text-sm text-[color:var(--primary)]"><p>{t('emptyLevel', { level: exploreJlpt })}</p>{exploreJlpt !== 'N4' && <button type="button" onClick={() => setExploreJlpt('N4')} className="mt-3 rounded-lg bg-[color:var(--card)] px-3 py-2 font-bold text-[color:var(--primary)]">{t('switchLevel', { level: 'N4' })}</button>}</div>}
              {dictionaryItems.map((item) => (
                <button key={item.kanji} type="button" onClick={() => updateSelectedKanji(item.kanji)} className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-[color:var(--border)] hover:bg-[color:var(--accent)]">
                  <div className="flex items-start justify-between">
                    <p className="font-japanese text-5xl font-bold text-[color:var(--text)]">{normalizeKanji(item.kanji)}</p>
                    <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{item.jlpt}</span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-[color:var(--text)]">{k(item.meaning)}</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">{item.onyomi} · {item.kunyomi} · {item.strokes || '-'} {k("strokes")}</p>
                  <p className="mt-2 text-xs font-semibold text-[color:var(--primary)]">{item.has_handwriting_data ? k('ETL10 handwriting data available') : k("Synthetic data")}</p>
                </button>
              ))}
            </div>
          </div>
          <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <KanjiInfoPanel recent={recent} onSelectSuggested={switchToPractice} />
          <section className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-glass)] px-5 py-4 text-sm font-medium text-[color:var(--text)] shadow-sm">
                {k('Model: {{state}}; {{count}} classes.', { state: k(modelInfoQuery.data?.available || modelInfoQuery.data?.model_loaded ? 'loaded' : 'not loaded'), count: modelInfoQuery.data?.total_classes ?? modelInfoQuery.data?.classes_count ?? 0 })}
                <p className="mt-2 text-xs">{t('modelCoverage', { levels: modelInfoQuery.data?.supported_jlpt?.join(', ') || t('noTrainedLevels') })}</p>
                {modelInfoQuery.data?.available && modelInfoQuery.data?.dictionary_classes > modelInfoQuery.data?.classes_count && <p className="mt-2 text-xs" role="status">{t('coverageGap', { count: modelInfoQuery.data.classes_count, total: modelInfoQuery.data.dictionary_classes })}</p>}
              </div>

            <KanjiCanvas ref={canvasRef} mode="free" templateKanji={selectedInfo.kanji} disabled={status === 'loading'} onRecognize={recognize} onStrokeChange={() => status === 'empty' && setStatus('idle')} />
          </section>
          {mode === 'recognize' ? (
            <div className="space-y-5">
              <PredictionResult predictions={predictions} status={status} error={error} isDemo={isDemo} correctionStatus={correctionStatus} recognitionMessage={recognitionMessage} lowConfidence={lowConfidence} modelInfo={modelInfoQuery.data} onSelect={(prediction) => updateSelectedKanji(prediction.kanji, 'manual')} onCorrect={submitCorrection} />
              {canShowKanjiDetails && <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} />}
            </div>
          ) : (
            canShowKanjiDetails && <MiniDictionary info={selectedInfo} onAsk={askInChat} onPractice={() => switchToPractice()} />
          )}
        </div>
      )}
    </motion.div>
  )
}
