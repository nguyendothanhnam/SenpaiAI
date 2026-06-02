import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser, Play, RotateCcw, Search, Sparkles } from 'lucide-react'

const CANVAS_WIDTH = 720
const CANVAS_HEIGHT = 720
const NORMALIZED_SIZE = 256
const DRAW_PADDING = 0.13
const BASE_LINE_WIDTH = 18

function getPoint(event, canvas, strokeId) {
  const rect = canvas.getBoundingClientRect()

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
    timestamp: Date.now(),
    pressure: event.pressure && event.pressure > 0 ? event.pressure : 0.5,
    strokeId,
  }
}

function getBounds(strokes) {
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

function drawSmoothStroke(ctx, stroke, progress = stroke.length) {
  const visible = stroke.slice(0, Math.max(1, progress))
  if (!visible.length) return

  const avgPressure = visible.reduce((sum, point) => sum + (point.pressure || 0.5), 0) / visible.length
  ctx.lineWidth = BASE_LINE_WIDTH * (0.82 + avgPressure * 0.36)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111827'

  if (visible.length === 1) {
    ctx.beginPath()
    ctx.arc(visible[0].x, visible[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(visible[0].x, visible[0].y)
  for (let index = 1; index < visible.length - 1; index += 1) {
    const point = visible[index]
    const next = visible[index + 1]
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2)
  }
  const last = visible[visible.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

function transformStrokesToSquare(strokes, size = NORMALIZED_SIZE, paddingRatio = DRAW_PADDING) {
  const bounds = getBounds(strokes)
  if (!bounds) return []

  const boxWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boxHeight = Math.max(1, bounds.maxY - bounds.minY)
  const padding = size * paddingRatio
  const scale = (size - padding * 2) / Math.max(boxWidth, boxHeight)
  const offsetX = (size - boxWidth * scale) / 2 - bounds.minX * scale
  const offsetY = (size - boxHeight * scale) / 2 - bounds.minY * scale

  return strokes.map((stroke) =>
    stroke.map((point) => ({
      ...point,
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    }))
  )
}

function createRecognitionImage(strokes) {
  const canvas = document.createElement('canvas')
  canvas.width = NORMALIZED_SIZE
  canvas.height = NORMALIZED_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const centeredStrokes = transformStrokesToSquare(strokes)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE)
  centeredStrokes.forEach((stroke) => drawSmoothStroke(ctx, stroke))

  const image = ctx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE)
  const data = image.data
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const value = gray < 210 ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
  ctx.putImageData(image, 0, 0)

  return canvas.toDataURL('image/png')
}

const KanjiCanvas = forwardRef(function KanjiCanvas(
  { mode = 'free', templateKanji = '月', referenceStrokes = [], disabled = false, onRecognize, onStrokeChange },
  ref
) {
  const canvasRef = useRef(null)
  const normalizedReferenceStrokes = Array.isArray(referenceStrokes) ? referenceStrokes : []
  const strokesRef = useRef([])
  const activeStrokeRef = useRef(null)
  const activePointerIdRef = useRef(null)
  const replayFrameRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)

  const redraw = (previewStrokes = strokesRef.current) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.strokeStyle = '#eef2f7'
    ctx.lineWidth = 1
    for (let x = 90; x < CANVAS_WIDTH; x += 90) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 90; y < CANVAS_HEIGHT; y += 90) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    ctx.strokeStyle = '#c4b5fd'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, 28)
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 28)
    ctx.moveTo(28, CANVAS_HEIGHT / 2)
    ctx.lineTo(CANVAS_WIDTH - 28, CANVAS_HEIGHT / 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.strokeStyle = '#ddd6fe'
    ctx.strokeRect(CANVAS_WIDTH * DRAW_PADDING, CANVAS_HEIGHT * DRAW_PADDING, CANVAS_WIDTH * (1 - DRAW_PADDING * 2), CANVAS_HEIGHT * (1 - DRAW_PADDING * 2))

    if ((mode === 'trace' || mode === 'practice') && normalizedReferenceStrokes.length && typeof Path2D !== 'undefined') {
      ctx.save()
      ctx.globalAlpha = 0.14
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 4.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.scale(CANVAS_WIDTH / 109, CANVAS_HEIGHT / 109)
      normalizedReferenceStrokes.forEach((stroke) => {
        if (stroke?.path) {
          ctx.stroke(new Path2D(stroke.path))
        }
      })
      ctx.restore()
    } else if (mode === 'trace' || mode === 'practice') {
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.fillStyle = '#111827'
      ctx.font = '430px "Noto Sans JP", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(templateKanji, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
      ctx.restore()
    }

    previewStrokes.forEach((stroke) => drawSmoothStroke(ctx, stroke))
  }

  const commitStrokes = (nextStrokes) => {
    strokesRef.current = nextStrokes
    setStrokes(nextStrokes)
    onStrokeChange?.(nextStrokes)
  }

  const stopReplay = () => {
    if (replayFrameRef.current) {
      window.cancelAnimationFrame(replayFrameRef.current)
      replayFrameRef.current = null
    }
    setIsReplaying(false)
  }

  useEffect(() => {
    redraw()
  }, [mode, templateKanji, normalizedReferenceStrokes])

  useEffect(() => () => stopReplay(), [])

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokesRef.current.length === 0,
    getStrokes: () => transformStrokesToSquare(strokesRef.current),
    getRawStrokes: () => strokesRef.current,
    getImage: () => createRecognitionImage(strokesRef.current),
    clear: () => {
      stopReplay()
      activeStrokeRef.current = null
      activePointerIdRef.current = null
      commitStrokes([])
      requestAnimationFrame(() => redraw([]))
    },
  }))

  const startDrawing = (event) => {
    if (disabled || isReplaying || isDrawing) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    activePointerIdRef.current = event.pointerId
    const strokeId = `${Date.now()}-${strokesRef.current.length + 1}`
    const point = getPoint(event, event.currentTarget, strokeId)
    activeStrokeRef.current = [point]
    commitStrokes([...strokesRef.current, activeStrokeRef.current])
    setIsDrawing(true)
  }

  const draw = (event) => {
    if (!isDrawing || !activeStrokeRef.current || disabled) return
    if (activePointerIdRef.current !== event.pointerId) return

    event.preventDefault()
    activeStrokeRef.current.push(getPoint(event, event.currentTarget, activeStrokeRef.current[0].strokeId))
    commitStrokes([...strokesRef.current])
    requestAnimationFrame(() => redraw())
  }

  const stopDrawing = (event) => {
    if (!isDrawing) return
    if (activePointerIdRef.current !== event.pointerId) return

    event.preventDefault()
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDrawing(false)
    activeStrokeRef.current = null
    activePointerIdRef.current = null
    requestAnimationFrame(() => redraw())
  }

  const undo = () => {
    if (disabled || strokesRef.current.length === 0) return

    stopReplay()
    commitStrokes(strokesRef.current.slice(0, -1))
    requestAnimationFrame(() => redraw())
  }

  const clear = () => {
    if (disabled) return

    stopReplay()
    commitStrokes([])
    requestAnimationFrame(() => redraw([]))
  }

  const replay = () => {
    if (disabled || !strokesRef.current.length) return

    stopReplay()
    setIsReplaying(true)
    const source = strokesRef.current
    const startedAt = performance.now()
    const pointDuration = 18
    const strokePause = 130

    const tick = (now) => {
      let budget = now - startedAt
      const preview = []

      for (const stroke of source) {
        const strokeTime = stroke.length * pointDuration
        if (budget <= 0) break
        if (budget >= strokeTime) {
          preview.push(stroke)
          budget -= strokeTime + strokePause
        } else {
          preview.push(stroke.slice(0, Math.max(1, Math.floor(budget / pointDuration))))
          budget = 0
          break
        }
      }

      redraw(preview)
      if (preview.length < source.length || preview.at(-1)?.length < source.at(-1)?.length) {
        replayFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        replayFrameRef.current = null
        setIsReplaying(false)
        redraw(source)
      }
    }

    replayFrameRef.current = window.requestAnimationFrame(tick)
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_24px_60px_-38px_rgba(76,29,149,0.42)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-950">Writing canvas</p>
          <p className="text-xs font-medium text-gray-500">
            {strokes.length ? `${strokes.length} stroke${strokes.length > 1 ? 's' : ''} captured` : 'Nothing written yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={replay} disabled={disabled || !strokes.length || isReplaying} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Play className="h-4 w-4" />
            Replay
          </button>
          <button type="button" onClick={undo} disabled={disabled || !strokes.length || isReplaying} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />
            Undo
          </button>
          <button type="button" onClick={clear} disabled={disabled || !strokes.length} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Eraser className="h-4 w-4" />
            Clear
          </button>
          <button type="button" onClick={onRecognize} disabled={disabled || isReplaying} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
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
        className="aspect-square w-full touch-none rounded-2xl border border-gray-100 bg-white [cursor:crosshair]"
        aria-label="Kanji handwriting canvas"
      />
    </div>
  )
})

export default KanjiCanvas
