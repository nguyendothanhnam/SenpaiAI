import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { gameAPI } from '../services/api.js'

const FALLBACK_KANJI = [
  {
    kanji: '日',
    onyomi: ['ニチ', 'ジツ'],
    kunyomi: ['ひ', 'び', 'か'],
    meaning: 'ngay, mặt trời',
    exampleSentence: '今日は日曜日です。',
  },
  {
    kanji: '学',
    onyomi: ['ガク'],
    kunyomi: ['まな.ぶ'],
    meaning: 'học',
    exampleSentence: '毎日日本語を学びます。',
  },
  {
    kanji: '水',
    onyomi: ['スイ'],
    kunyomi: ['みず'],
    meaning: 'nước',
    exampleSentence: '水を一杯ください。',
  },
  {
    kanji: '食',
    onyomi: ['ショク'],
    kunyomi: ['た.べる'],
    meaning: 'ăn, thực phẩm',
    exampleSentence: '朝ご飯を食べました。',
  },
]

function toArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[、,;/]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }

  return []
}

function katakanaToHiragana(text) {
  return String(text || '').replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
}

function toRomaji(raw) {
  const hiragana = katakanaToHiragana(String(raw || '').replace(/\./g, '').toLowerCase())
  const chars = [...hiragana]

  const digraphMap = {
    きゃ: 'kya',
    きゅ: 'kyu',
    きょ: 'kyo',
    しゃ: 'sha',
    しゅ: 'shu',
    しょ: 'sho',
    ちゃ: 'cha',
    ちゅ: 'chu',
    ちょ: 'cho',
    にゃ: 'nya',
    にゅ: 'nyu',
    にょ: 'nyo',
    ひゃ: 'hya',
    ひゅ: 'hyu',
    ひょ: 'hyo',
    みゃ: 'mya',
    みゅ: 'myu',
    みょ: 'myo',
    りゃ: 'rya',
    りゅ: 'ryu',
    りょ: 'ryo',
    ぎゃ: 'gya',
    ぎゅ: 'gyu',
    ぎょ: 'gyo',
    じゃ: 'ja',
    じゅ: 'ju',
    じょ: 'jo',
    びゃ: 'bya',
    びゅ: 'byu',
    びょ: 'byo',
    ぴゃ: 'pya',
    ぴゅ: 'pyu',
    ぴょ: 'pyo',
  }

  const map = {
    あ: 'a',
    い: 'i',
    う: 'u',
    え: 'e',
    お: 'o',
    か: 'ka',
    き: 'ki',
    く: 'ku',
    け: 'ke',
    こ: 'ko',
    さ: 'sa',
    し: 'shi',
    す: 'su',
    せ: 'se',
    そ: 'so',
    た: 'ta',
    ち: 'chi',
    つ: 'tsu',
    て: 'te',
    と: 'to',
    な: 'na',
    に: 'ni',
    ぬ: 'nu',
    ね: 'ne',
    の: 'no',
    は: 'ha',
    ひ: 'hi',
    ふ: 'fu',
    へ: 'he',
    ほ: 'ho',
    ま: 'ma',
    み: 'mi',
    む: 'mu',
    め: 'me',
    も: 'mo',
    や: 'ya',
    ゆ: 'yu',
    よ: 'yo',
    ら: 'ra',
    り: 'ri',
    る: 'ru',
    れ: 're',
    ろ: 'ro',
    わ: 'wa',
    を: 'wo',
    ん: 'n',
    が: 'ga',
    ぎ: 'gi',
    ぐ: 'gu',
    げ: 'ge',
    ご: 'go',
    ざ: 'za',
    じ: 'ji',
    ず: 'zu',
    ぜ: 'ze',
    ぞ: 'zo',
    だ: 'da',
    ぢ: 'ji',
    づ: 'zu',
    で: 'de',
    ど: 'do',
    ば: 'ba',
    び: 'bi',
    ぶ: 'bu',
    べ: 'be',
    ぼ: 'bo',
    ぱ: 'pa',
    ぴ: 'pi',
    ぷ: 'pu',
    ぺ: 'pe',
    ぽ: 'po',
    ぁ: 'a',
    ぃ: 'i',
    ぅ: 'u',
    ぇ: 'e',
    ぉ: 'o',
  }

  let result = ''

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    const next = chars[i + 1] || ''
    const pair = `${char}${next}`

    if (char === 'っ') {
      const nextPair = `${next}${chars[i + 2] || ''}`
      const nextRomaji = digraphMap[nextPair] || map[next] || ''
      result += nextRomaji ? nextRomaji[0] : ''
      continue
    }

    if (digraphMap[pair]) {
      result += digraphMap[pair]
      i += 1
      continue
    }

    if (char === 'ー') {
      const last = result[result.length - 1] || ''
      if ('aeiou'.includes(last)) {
        result += last
      }
      continue
    }

    result += map[char] || char
  }

  return result
}

function normalizeKana(text) {
  return katakanaToHiragana(String(text || '').toLowerCase())
    .replace(/\./g, '')
    .replace(/\s+/g, '')
    .trim()
}

function normalizeRomaji(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim()
}

function hasLatinCharacters(value) {
  return /[a-z]/i.test(String(value || ''))
}

function normalizeKanjiItem(item) {
  const onyomi = toArray(item?.onyomi || item?.on || item?.on_yomi || item?.readings_on)
  const kunyomi = toArray(item?.kunyomi || item?.kun || item?.kun_yomi || item?.readings_kun)
  const meaning = Array.isArray(item?.meaning)
    ? item.meaning.join(', ')
    : item?.meaning || item?.definition || item?.translation || ''

  const exampleSentence =
    item?.exampleSentence ||
    item?.example_sentence ||
    item?.example ||
    item?.sentence ||
    item?.example_jp ||
    ''

  return {
    kanji: item?.kanji || item?.character || item?.question || '',
    onyomi,
    kunyomi,
    meaning,
    exampleSentence,
  }
}

function normalizeKanjiItems(data) {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.kanji)
        ? data.kanji
        : Array.isArray(data?.questions)
          ? data.questions
          : data
            ? [data]
            : []

  return rawItems
    .map((item) => normalizeKanjiItem(item))
    .filter((item) => item.kanji && (item.meaning || item.onyomi.length || item.kunyomi.length))
}

function buildAudioText(item) {
  const onText = item.onyomi.length ? `音読み: ${item.onyomi.join('、')}` : ''
  const kunText = item.kunyomi.length ? `訓読み: ${item.kunyomi.join('、')}` : ''
  return [onText, kunText].filter(Boolean).join('。') || '読み方データがありません。'
}

function buildExpectedReadings(item) {
  const allReadings = [...item.onyomi, ...item.kunyomi]
  const kanaReadings = allReadings.map((value) => normalizeKana(value)).filter(Boolean)
  const romajiReadings = allReadings.map((value) => normalizeRomaji(toRomaji(value))).filter(Boolean)

  return { kanaReadings, romajiReadings }
}

function getProgressWidth(index, total) {
  if (!total) {
    return 0
  }

  return ((index + 1) / total) * 100
}

function getNextIndex(current, length) {
  if (!length) {
    return 0
  }

  return (current + 1) % length
}

export default function Kanji() {
  const [kanjiData, setKanjiData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [readingInput, setReadingInput] = useState('')
  const [checkResult, setCheckResult] = useState(null)

  useEffect(() => {
    const fetchKanji = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await gameAPI.getKanji()
        const items = normalizeKanjiItems(response.data)

        if (!items.length) {
          setKanjiData(FALLBACK_KANJI)
          setCurrentIndex(0)
          setError('Live kanji data unavailable. Showing built-in practice set.')
          return
        }

        setKanjiData(items)
        setCurrentIndex(0)
      } catch {
        setKanjiData(FALLBACK_KANJI)
        setCurrentIndex(0)
        setError('Unable to reach kanji API. Showing built-in practice set.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchKanji()
  }, [])

  const currentKanji = kanjiData[currentIndex]

  const expectedReadings = useMemo(() => {
    if (!currentKanji) {
      return { kanaReadings: [], romajiReadings: [] }
    }

    return buildExpectedReadings(currentKanji)
  }, [currentKanji])

  const progressPercent = useMemo(() => getProgressWidth(currentIndex, kanjiData.length), [currentIndex, kanjiData.length])

  const playAudio = () => {
    if (!currentKanji || typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(buildAudioText(currentKanji))
    utterance.lang = 'ja-JP'
    utterance.rate = 0.85

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const resetPracticeState = () => {
    setReadingInput('')
    setCheckResult(null)
  }

  const handleSearch = (event) => {
    event.preventDefault()

    const query = String(searchInput || '').trim().slice(0, 1)

    if (!query) {
      setSearchMessage('Please input one Kanji character to search.')
      return
    }

    const index = kanjiData.findIndex((item) => item.kanji === query)

    if (index < 0) {
      setSearchMessage(`Kanji "${query}" not found. Try another one in this learning set.`)
      return
    }

    setCurrentIndex(index)
    setSearchMessage(`Showing Kanji: ${query}`)
    resetPracticeState()
  }

  const checkReading = () => {
    if (!readingInput.trim()) {
      setCheckResult({
        status: 'idle',
        message: 'Type a reading first.',
      })
      return
    }

    const isRomaji = hasLatinCharacters(readingInput)
    let isCorrect = false

    if (isRomaji) {
      isCorrect = expectedReadings.romajiReadings.includes(normalizeRomaji(readingInput))
    } else {
      isCorrect = expectedReadings.kanaReadings.includes(normalizeKana(readingInput))
    }

    setCheckResult({
      status: isCorrect ? 'correct' : 'wrong',
      message: isCorrect
        ? 'Correct reading.'
        : `Not quite. Accepted readings: ${[...currentKanji.onyomi, ...currentKanji.kunyomi].join(', ')}`,
    })
  }

  const goNext = () => {
    if (!kanjiData.length) {
      return
    }

    setCurrentIndex((prev) => getNextIndex(prev, kanjiData.length))
    setSearchMessage('')
    resetPracticeState()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6 shadow-sm sm:p-8"
    >
      <div className="pointer-events-none absolute -left-20 -top-16 h-52 w-52 rounded-full bg-orange-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-amber-200/60 blur-3xl" />

      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">Kanji Studio</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Learn One Character Deeply</h1>
          </div>
          <div className="rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-sm font-medium text-orange-700 backdrop-blur">
            {kanjiData.length ? `${currentIndex + 1} / ${kanjiData.length}` : '0 / 0'}
          </div>
        </div>

        <form onSubmit={handleSearch} className="rounded-2xl border border-orange-200 bg-white/90 p-4 sm:p-5">
          <p className="text-sm font-medium text-gray-700">Search Kanji</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Type one Kanji character (e.g., 学)"
              maxLength={1}
              className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-orange-600 hover:to-amber-600"
            >
              Search
            </button>
          </div>
          {searchMessage && (
            <p className={`mt-3 text-sm ${searchMessage.includes('not found') ? 'text-red-600' : 'text-emerald-600'}`}>
              {searchMessage}
            </p>
          )}
        </form>

        <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-white/80 p-8 text-sm text-orange-700">Loading kanji...</div>
        ) : !currentKanji ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-white/80 p-8 text-sm text-orange-700">No kanji data found.</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentKanji.kanji}-${currentIndex}`}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className="space-y-6 rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-[0_24px_45px_-28px_rgba(194,65,12,0.5)] backdrop-blur sm:p-8"
            >
              {error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {error}
                </div>
              )}

              <div className="flex justify-center">
                <div className="inline-flex min-h-44 min-w-44 items-center justify-center rounded-3xl border border-orange-100 bg-gradient-to-br from-white to-orange-50 px-10 py-6 text-center text-7xl font-bold text-gray-900 shadow-inner sm:min-h-52 sm:min-w-52 sm:text-8xl">
                  {currentKanji.kanji}
                </div>
              </div>

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
                  <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.meaning || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Example sentence</p>
                  <p className="mt-1 text-base font-medium text-gray-900">{currentKanji.exampleSentence || '-'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={playAudio}
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
                        checkReading()
                      }
                    }}
                    placeholder="Enter hiragana or romaji"
                    className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={checkReading}
                    className="rounded-xl border border-orange-200 bg-orange-100 px-4 py-3 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
                  >
                    Check Reading
                  </button>
                </div>

                {checkResult && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      checkResult.status === 'correct'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : checkResult.status === 'wrong'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {checkResult.message}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600"
                >
                  Next Kanji
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}
