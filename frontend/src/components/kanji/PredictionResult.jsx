import { AlertCircle, Loader2, Sparkles } from 'lucide-react'

function EmptyState({ title, message, tone = 'neutral' }) {
  const isError = tone === 'error'

  return (
    <div className={`rounded-3xl border p-5 ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <p className="font-bold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </div>
  )
}

export default function PredictionResult({ predictions = [], status = 'idle', error = '', isDemo = false, onSelect }) {
  return (
    <aside className="rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-gray-950">Prediction results</p>
          <p className="text-xs font-medium text-gray-500">
            {isDemo ? 'Demo recognition result. Please confirm manually.' : 'Top kanji matches from recognition API'}
          </p>
        </div>
        <Sparkles className="h-5 w-5 text-violet-500" />
      </div>

      <div className="mt-5">
        {status === 'empty' && (
          <EmptyState title="Nothing written yet" message="Draw a kanji on the canvas before recognition." />
        )}

        {status === 'loading' && (
          <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5 text-violet-700">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="font-bold">Analyzing handwriting...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <EmptyState title="Kanji not recognized" message={error || 'Please clear the canvas and try writing the kanji again.'} tone="error" />
        )}

        {status === 'idle' && !predictions.length && (
          <EmptyState title="Ready to recognize" message="Your top predictions will appear here after submitting handwriting." />
        )}

        {status === 'success' && predictions.length > 0 && (
          <div className="space-y-3">
            {predictions.map((prediction, index) => (
              <button
                key={`${prediction.kanji}-${index}`}
                type="button"
                onClick={() => onSelect?.(prediction)}
                className={`rounded-3xl border p-4 ${
                  index === 0 ? 'border-violet-200 bg-violet-50/80' : 'border-gray-100 bg-white'
                } ${onSelect ? 'w-full text-left transition hover:border-violet-300 hover:bg-violet-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white font-japanese text-4xl font-bold text-gray-950 shadow-sm">
                      {prediction.kanji}
                    </div>
                    <div>
                      <p className="font-bold text-gray-950">{prediction.meaning || 'Unknown meaning'}</p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {prediction.onyomi ? `Onyomi ${prediction.onyomi}` : 'Onyomi -'} · {prediction.kunyomi ? `Kunyomi ${prediction.kunyomi}` : 'Kunyomi -'}
                      </p>
                      {prediction.strokes && (
                        <p className="mt-1 text-xs font-medium text-gray-500">{prediction.strokes} strokes</p>
                      )}
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 shadow-sm">
                    {Math.round(prediction.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500"
                    style={{ width: `${Math.round(prediction.confidence * 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
