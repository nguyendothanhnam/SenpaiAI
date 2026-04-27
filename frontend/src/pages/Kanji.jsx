import { useEffect, useMemo, useState } from 'react'
import { gameAPI } from '../services/api.js'

function normalizeKanjiItems(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.questions)) {
    return data.questions
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (data?.kanji || data?.question || data?.character) {
    return [data]
  }

  return []
}

function getKanjiValue(item) {
  return item.kanji || item.character || item.question || 'Kanji'
}

function getMeaningOptions(item) {
  if (Array.isArray(item.options)) {
    return item.options
  }

  if (Array.isArray(item.choices)) {
    return item.choices
  }

  if (Array.isArray(item.meanings)) {
    return item.meanings
  }

  return []
}

export default function Kanji() {
  const [kanjiData, setKanjiData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchKanji = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await gameAPI.getKanji()
        const items = normalizeKanjiItems(response.data)

        if (!items.length) {
          setError('No kanji data available right now.')
        }

        setKanjiData(items)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load kanji data.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchKanji()
  }, [])

  const hasItems = useMemo(() => kanjiData.length > 0, [kanjiData])

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-red-500 via-orange-500 to-sky-500 px-6 py-8 text-white">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">Learning Mode</p>
        <h1 className="mt-3 text-3xl font-semibold">Kanji</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">
          Focused character practice to build recognition and memory one set at a time.
        </p>
      </div>

      <div className="px-6 py-8">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : hasItems ? (
          <div className="space-y-6">
            {kanjiData.map((item, index) => (
              <div key={`${getKanjiValue(item)}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <h2 className="text-base font-semibold text-gray-900">
                  {index + 1}. {getKanjiValue(item)}
                </h2>
                <p className="mt-2 text-sm text-gray-500">Choose the correct meaning:</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {getMeaningOptions(item).map((option, optionIndex) => (
                    <div
                      key={`${option}-${optionIndex}`}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            No kanji questions found.
          </div>
        )}
      </div>
    </div>
  )
}

