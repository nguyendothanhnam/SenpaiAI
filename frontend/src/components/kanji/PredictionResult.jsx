import { kanjiText as k } from '../../utils/kanjiLocale'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { AlertCircle, Loader2, Sparkles, Target } from 'lucide-react'

function toReadableText(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => toReadableText(item)).filter(Boolean).join(' / ') || fallback
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message
    if (typeof value.msg === 'string') return value.msg
    if (typeof value.detail === 'string') return value.detail
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }
  return String(value)
}

function confidencePercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number * 100)))
}

function EmptyState({ title, message, tone = 'neutral' }) {
  const isError = tone === 'error'

  return (
    <div className={`rounded-2xl border p-5 ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)]'}`}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <p className="font-bold">{toReadableText(title)}</p>
      </div>
      <p className="mt-2 text-sm leading-6">{toReadableText(message)}</p>
    </div>
  )
}

function reading(value) {
  return toReadableText(value, '-')
}

export default function PredictionResult({ predictions = [], status = 'idle', error = '', isDemo = false, correctionStatus = '', recognitionMessage = '', lowConfidence = false, modelInfo, onSelect, onCorrect }) {
  useTranslation('kanjiUI')

  const safePredictions = Array.isArray(predictions) ? predictions : []
  const topPredictions = safePredictions.slice(0, 5)
  const best = safePredictions[0]
  const safeError = k(toReadableText(error, 'Please clear the canvas and try writing the kanji again.'))
  const [correction, setCorrection] = useState('')
  const modelAvailable = Boolean(modelInfo?.available ?? modelInfo?.model_loaded)
  const showPredictionList = (status === 'success' || status === 'low_confidence') && best
  const showCorrection = Boolean(onCorrect && modelAvailable && (status === 'success' || status === 'low_confidence'))

  return (
    <aside className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[color:var(--text)]">{k("Prediction results")}</p>
          <p className="text-xs font-medium text-[color:var(--text-muted)]">
            {isDemo ? k("Demo recognition result. Please confirm manually.") : k("Shape, stroke count, geometry, JLPT, and frequency scoring")}
          </p>
        </div>
        <Sparkles className="h-5 w-5 text-[color:var(--primary)]" />
      </div>

      <div className="mt-5">
        {status === 'empty' && <EmptyState title={k("Nothing written yet")} message={k("Draw a kanji on the canvas before recognition.")} />}
        {status === 'loading' && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)] p-5 text-[color:var(--primary)]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="font-bold">{k("Analyzing handwriting...")}</p>
            </div>
          </div>
        )}
        {status === 'error' && <EmptyState title={k("Kanji not recognized")} message={safeError} tone="error" />}
        {status === 'low_confidence' && best && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {k(toReadableText(recognitionMessage, k("Low confidence. Please select the correct kanji from the candidates or enter a correction.")))}
          </div>
        )}
        {status === 'idle' && !safePredictions.length && <EmptyState title={k("Ready to recognize")} message={k("Your top predictions will appear here after submitting handwriting.")} />}

        {showPredictionList && (
          <div className="space-y-3">
            {(lowConfidence || Number(best.confidence) < 0.65) && status !== 'low_confidence' && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {k(toReadableText(recognitionMessage, k("Low confidence. Please select the correct kanji to help improve the model.")))}
              </div>
            )}
            {recognitionMessage && !lowConfidence && Number(best.confidence) >= 0.65 && (
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-[color:var(--text)]">
                {k(toReadableText(recognitionMessage))}
              </div>
            )}

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--primary)]">{k("Best match")}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-japanese text-5xl font-black text-[color:var(--text)]">{toReadableText(best.kanji, '?')}</p>
                <p className="text-2xl font-black text-[color:var(--primary)]">{confidencePercent(best.confidence)}%</p>
              </div>
              <p className="mt-3 text-sm font-semibold text-[color:var(--primary)]">{k(toReadableText(best.reason || best.reasons?.[0]))}</p>
            </div>

            <p className="pt-2 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{k("Top 5 candidates")}</p>
            {topPredictions.map((prediction, index) => (
              <button
                key={`${toReadableText(prediction.kanji, 'prediction')}-${index}`}
                type="button"
                onClick={() => onSelect?.(prediction)}
                className={`rounded-2xl border p-4 ${
                  index === 0 ? 'border-[color:var(--border)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--card)]'
                } ${onSelect ? 'w-full text-left transition hover:border-[color:var(--border)] hover:bg-[color:var(--accent)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[color:var(--card)] font-japanese text-4xl font-bold text-[color:var(--text)] shadow-sm">
                      {toReadableText(prediction.kanji, '?')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[color:var(--text)]">{k(toReadableText(prediction.meaning_vi || prediction.meaning, k("Unknown meaning")))}</p>
                      <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">{k("Onyomi")}: {reading(prediction.onyomi)} {k("- Kunyomi")}: {reading(prediction.kunyomi)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
                        {prediction.stroke_count || prediction.strokes ? k(`${toReadableText(prediction.stroke_count || prediction.strokes)} strokes`) : k("Stroke count unknown")}
                        {prediction.jlpt ? ` - ${toReadableText(prediction.jlpt)}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[color:var(--card)] px-3 py-1 text-xs font-bold text-[color:var(--primary)] shadow-sm">
                    {confidencePercent(prediction.confidence)}%
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-[color:var(--card)]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{ width: `${confidencePercent(prediction.confidence)}%` }} />
                </div>
                {Array.isArray(prediction.reasons) && prediction.reasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prediction.reasons.slice(0, 3).map((reason, reasonIndex) => (
                      <span key={`${toReadableText(reason, 'reason')}-${reasonIndex}`} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--card)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--text-muted)]">
                        <Target className="h-3 w-3 text-[color:var(--primary)]" />
                        {k(toReadableText(reason))}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        {showCorrection && (
          <form
            className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"
            onSubmit={(event) => {
              event.preventDefault()
              onCorrect(correction)
              setCorrection('')
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{k("Not correct? Choose correct kanji")}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={correction}
                onChange={(event) => setCorrection(event.target.value.slice(0, 1))}
                className="h-11 w-16 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-center font-japanese text-2xl font-bold text-[color:var(--text)] outline-none focus:ring-4 focus:ring-[color:var(--primary)]"
                aria-label={k("Correct kanji")}
              />
              <button type="submit" disabled={!correction} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)] disabled:opacity-50">{k("Save correction")}</button>
            </div>
            {correctionStatus && <p className="mt-2 text-xs font-semibold text-[color:var(--primary)]">{k(toReadableText(correctionStatus))}</p>}
            {modelInfo?.supported_jlpt?.length > 0 && (
              <p className="mt-2 text-xs font-medium text-[color:var(--text-muted)]">{k("Current model supports")} {modelInfo.supported_jlpt.join('-')} ({modelInfo.total_classes ?? modelInfo.classes_count ?? 0} {k("classes).")}</p>
            )}
          </form>
        )}
        {!modelAvailable && modelInfo?.message && status !== 'error' && (
          <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {k(toReadableText(modelInfo.message))}
          </p>
        )}
      </div>
    </aside>
  )
}
