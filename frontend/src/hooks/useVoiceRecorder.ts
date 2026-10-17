import { useCallback, useEffect, useRef, useState } from 'react'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/wav']

function chooseMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const maxTimerRef = useRef<number | null>(null)
  const silenceSinceRef = useRef<number | null>(null)
  const resolveRef = useRef<((blob: Blob) => void) | null>(null)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const startedAtRef = useRef(0)
  const mimeRef = useRef('')

  const cleanup = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    if (maxTimerRef.current !== null) window.clearTimeout(maxTimerRef.current)
    animationRef.current = null
    maxTimerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    recorderRef.current = null
    setRecording(false)
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const start = useCallback(() => new Promise<Blob>((resolve, reject) => {
    if (!window.isSecureContext) {
      setError('Micro cần HTTPS hoặc localhost. Hãy mở ứng dụng qua localhost hoặc bật HTTPS.')
      reject(new Error('secure_context_required'))
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt này không hỗ trợ ghi âm. Hãy dùng Chrome, Edge, Firefox hoặc Safari mới.')
      reject(new Error('recorder_unsupported'))
      return
    }
    setError(null)
    resolveRef.current = resolve
    rejectRef.current = reject
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream
      const mime = chooseMimeType()
      mimeRef.current = mime || 'audio/webm'
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onerror = () => {
        setError('Không thể ghi âm. Hãy kiểm tra micro rồi thử lại.')
        rejectRef.current?.(new Error('recording_failed'))
        cleanup()
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeRef.current })
        if (blob.size) resolveRef.current?.(blob)
        else rejectRef.current?.(new Error('empty_recording'))
        resolveRef.current = null
        rejectRef.current = null
        cleanup()
      }
      recorder.start(250)
      setRecording(true)
      maxTimerRef.current = window.setTimeout(() => stop(), 60_000)

      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextCtor) return
        const context = new AudioContextCtor()
        audioContextRef.current = context
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        context.createMediaStreamSource(stream).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        const watchSilence = () => {
          if (!recorderRef.current || recorderRef.current.state !== 'recording') return
          analyser.getByteTimeDomainData(samples)
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length)
          const elapsed = Date.now() - startedAtRef.current
          if (elapsed > 1500 && rms < 2.8) {
            silenceSinceRef.current ??= Date.now()
            if (Date.now() - silenceSinceRef.current >= 1500) { stop(); return }
          } else silenceSinceRef.current = null
          if (elapsed >= 60_000) { stop(); return }
          animationRef.current = requestAnimationFrame(watchSilence)
        }
        animationRef.current = requestAnimationFrame(watchSilence)
      } catch {
        // Silence detection is optional; the hard 60 second stop still applies.
      }
    }).catch((cause: unknown) => {
      const domError = cause as DOMException
      const message = domError.name === 'NotAllowedError'
        ? 'Bạn đã từ chối quyền micro. Hãy cấp quyền micro trong cài đặt trình duyệt rồi thử lại.'
        : domError.name === 'NotFoundError'
          ? 'Không tìm thấy micro. Hãy kết nối micro rồi thử lại.'
          : 'Không thể mở micro. Kiểm tra quyền truy cập và thử lại.'
      setError(message)
      rejectRef.current?.(new Error(domError.name || 'microphone_error'))
      resolveRef.current = null
      rejectRef.current = null
      cleanup()
    })
  }), [cleanup, stop])

  useEffect(() => cleanup, [cleanup])
  return { recording, error, start, stop }
}
