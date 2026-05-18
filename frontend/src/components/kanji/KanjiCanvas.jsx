import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser, RotateCcw, Search, Sparkles } from 'lucide-react'

const CANVAS_WIDTH = 720
const CANVAS_HEIGHT = 520

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_WIDTH / rect.width
  const scaleY = CANVAS_HEIGHT / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    time: Date.now(),
  }
}

const KanjiCanvas = forwardRef(function KanjiCanvas(
  { mode = 'free', templateKanji = '猫', disabled = false, onRecognize, onStrokeChange },
  ref
) {
  const canvasRef = useRef(null)
  const strokesRef = useRef([])
  const activeStrokeRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    for (let x = 40; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 40; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    ctx.strokeStyle = '#ede9fe'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, 26)
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 26)
    ctx.moveTo(26, CANVAS_HEIGHT / 2)
    ctx.lineTo(CANVAS_WIDTH - 26, CANVAS_HEIGHT / 2)
    ctx.stroke()

    if (mode === 'trace' || mode === 'practice') {
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.fillStyle = '#111827'
      ctx.font = '360px "Noto Sans JP", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(templateKanji, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 6)
      ctx.restore()
    }

    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    strokesRef.current.forEach((stroke) => {
      if (stroke.length < 2) return
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      stroke.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
      ctx.stroke()
    })
  }

  const commitStrokes = (nextStrokes) => {
    strokesRef.current = nextStrokes
    setStrokes(nextStrokes)
    onStrokeChange?.(nextStrokes)
  }

  useEffect(() => {
    redraw()
  }, [mode, templateKanji])

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokesRef.current.length === 0,
    getStrokes: () => strokesRef.current,
    getImage: () => canvasRef.current?.toDataURL('image/png') || '',
    clear: () => {
      activeStrokeRef.current = null
      commitStrokes([])
      requestAnimationFrame(redraw)
    },
  }))

  const startDrawing = (event) => {
    if (disabled) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const point = getPoint(event, event.currentTarget)
    activeStrokeRef.current = [point]
    commitStrokes([...strokesRef.current, activeStrokeRef.current])
    setIsDrawing(true)
  }

  const draw = (event) => {
    if (!isDrawing || !activeStrokeRef.current || disabled) return

    event.preventDefault()
    activeStrokeRef.current.push(getPoint(event, event.currentTarget))
    commitStrokes([...strokesRef.current])
    requestAnimationFrame(redraw)
  }

  const stopDrawing = (event) => {
    if (!isDrawing) return

    event.preventDefault()
    setIsDrawing(false)
    activeStrokeRef.current = null
    requestAnimationFrame(redraw)
  }

  const undo = () => {
    if (disabled || strokesRef.current.length === 0) return

    commitStrokes(strokesRef.current.slice(0, -1))
    requestAnimationFrame(redraw)
  }

  const clear = () => {
    if (disabled) return

    commitStrokes([])
    requestAnimationFrame(redraw)
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_24px_60px_-38px_rgba(76,29,149,0.42)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-950">Writing canvas</p>
          <p className="text-xs font-medium text-gray-500">
            {strokes.length ? `${strokes.length} stroke${strokes.length > 1 ? 's' : ''} captured` : 'Nothing written yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={disabled || !strokes.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={disabled || !strokes.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser className="h-4 w-4" />
            Clear
          </button>
          <button
            type="button"
            onClick={onRecognize}
            disabled={disabled}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disabled ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Search className="h-4 w-4" />}
            {mode === 'practice' ? 'Check' : 'Recognize'}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
        className="h-[420px] w-full touch-none rounded-2xl border border-gray-100 bg-white [cursor:crosshair] sm:h-[520px]"
        aria-label="Kanji handwriting canvas"
      />
    </div>
  )
})

export default KanjiCanvas
