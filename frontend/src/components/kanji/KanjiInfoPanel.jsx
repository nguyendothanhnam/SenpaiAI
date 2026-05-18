import { BookOpen, Brush, Lightbulb } from 'lucide-react'

const suggestedKanji = [
  { kanji: '日', level: 'N5' },
  { kanji: '月', level: 'N5' },
  { kanji: '水', level: 'N5' },
  { kanji: '語', level: 'N5' },
  { kanji: '猫', level: 'N4' },
  { kanji: '描', level: 'N2' },
]

export default function KanjiInfoPanel({ recent = [], onSelectSuggested }) {
  return (
    <aside className="space-y-5">
      <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Brush className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-950">How to use</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
          <p>Draw any kanji in the canvas using mouse, stylus, or touch.</p>
          <p>Use Undo to remove the latest stroke, or Clear to start again.</p>
          <p>Click Recognize when your writing is ready.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-bold text-gray-950">Recent recognized</h2>
        </div>
        <div className="mt-4">
          {recent.length ? (
            <div className="grid grid-cols-4 gap-2">
              {recent.map((item) => (
                <div key={`${item.kanji}-${item.confidence}`} className="rounded-2xl bg-gray-50 p-3 text-center">
                  <p className="font-japanese text-2xl font-bold text-gray-950">{item.kanji}</p>
                  <p className="mt-1 text-xs font-semibold text-violet-600">{Math.round(item.confidence * 100)}%</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">Nothing recognized yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-gray-950">Suggested JLPT kanji</h2>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {suggestedKanji.map((item) => (
            <button
              key={item.kanji}
              type="button"
              onClick={() => onSelectSuggested?.(item.kanji)}
              className="rounded-2xl border border-gray-100 bg-white p-3 text-center transition hover:border-violet-200 hover:bg-violet-50"
            >
              <p className="font-japanese text-2xl font-bold text-gray-950">{item.kanji}</p>
              <p className="mt-1 text-xs font-bold text-orange-500">{item.level}</p>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
