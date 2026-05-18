import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import KanjiCanvas from './KanjiCanvas'
import PredictionResult from './PredictionResult'
import { kanjiRecognitionAPI } from '../../services/api'

export default function HandwritingInputModal({ open, onClose, onSelect }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [predictions, setPredictions] = useState([])
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  if (!open) return null

  const recognize = async () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setStatus('empty')
      setPredictions([])
      setError('')
      return
    }

    setStatus('loading')
    setError('')

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
        setError('Kanji not recognized')
        return
      }

      setPredictions(nextPredictions)
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setPredictions([])
      setError(requestError?.response?.data?.detail || 'Kanji not recognized')
    }
  }

  const selectPrediction = (prediction) => {
    onSelect(prediction.kanji)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Chat handwriting input</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950">Write a kanji</h2>
            <p className="mt-1 text-sm text-gray-500">Select a prediction to insert it into your chat message.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-gray-200 text-gray-500 hover:bg-gray-50"
            aria-label="Close handwriting input"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <KanjiCanvas
            ref={canvasRef}
            mode="free"
            disabled={status === 'loading'}
            onRecognize={recognize}
            onStrokeChange={() => status === 'empty' && setStatus('idle')}
          />
          <PredictionResult
            predictions={predictions}
            status={status}
            error={error}
            isDemo={isDemo}
            onSelect={selectPrediction}
          />
        </div>
      </div>
    </div>
  )
}
