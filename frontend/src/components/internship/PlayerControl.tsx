import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, MicOff, Lightbulb, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PlayerControlProps {
  onSubmit: (text: string) => Promise<boolean>
  disabled?: boolean
  isLoading?: boolean
  hints?: string[]
}

/**
 * PlayerControl: Minimalist Corporate Response Input Bar.
 * - Max height <= 20% screen height.
 * - Neutral palette (slate/dark neutral, no garish colors).
 * - High accessibility: Keyboard (Enter), Voice (Web Speech STT ja-JP), Hints drawer.
 */
export const PlayerControl: React.FC<PlayerControlProps> = ({
  onSubmit,
  disabled = false,
  isLoading = false,
  hints = [],
}) => {
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const recognitionRef = useRef<any>(null)
  const keepListeningRef = useRef(false)
  const submittingRef = useRef(false)

  // Initialize Speech Recognition for Japanese STT
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'ja-JP'

      recognition.onresult = (event: any) => {
        const segments: string[] = []
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index]
          if (result.isFinal) segments.push(result[0].transcript.trim())
        }
        const transcript = segments.filter(Boolean).join(' ')
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript))
        }
      }

      recognition.onerror = (err: any) => {
        if (err.error === 'no-speech') return
        keepListeningRef.current = false
        console.warn('Speech recognition error:', err)
        if (err.error !== 'aborted') {
          toast.error('Không thể nhận diện giọng nói hoặc chưa cấp quyền micro.')
        }
      }

      recognition.onend = () => {
        if (keepListeningRef.current) {
          try {
            recognition.start()
            return
          } catch {
            keepListeningRef.current = false
            toast.error('Micro đã ngắt. Bạn có thể bật lại để nói tiếp.')
          }
        }
        setIsRecording(false)
        setIsStopping(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        keepListeningRef.current = false
        recognitionRef.current.onend = null
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  const handleToggleRecord = () => {
    if (!recognitionRef.current) {
      toast.error('Trình duyệt chưa hỗ trợ Web Speech API.')
      return
    }

    if (isStopping) return
    if (keepListeningRef.current) {
      keepListeningRef.current = false
      setIsStopping(true)
      recognitionRef.current.stop()
    } else {
      try {
        keepListeningRef.current = true
        recognitionRef.current.start()
        setIsRecording(true)
      } catch {
        keepListeningRef.current = false
        toast.error('Không thể bật micro. Hãy thử lại.')
      }
    }
  }

  const handleSend = async () => {
    const trimmed = inputText.trim()
    if (!trimmed || disabled || isLoading || isRecording || isStopping || submittingRef.current) return
    submittingRef.current = true
    try {
      if (await onSubmit(trimmed)) {
        setInputText('')
        setShowHints(false)
      }
    } finally {
      submittingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const applyHint = (hint: string) => {
    setInputText(hint)
    setShowHints(false)
  }

  return (
    <div className="relative w-full flex flex-col gap-1.5 font-sans">
      {/* Keigo Hints Drawer (Neutral, clean) */}
      <AnimatePresence>
        {showHints && hints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="p-3 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-xl text-xs"
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800 text-slate-300">
              <span className="font-semibold text-slate-200">Gợi ý mẫu câu công sở (Keigo):</span>
              <button
                type="button"
                onClick={() => setShowHints(false)}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                Đóng
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
              {hints.map((hint, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyHint(hint)}
                  className="text-left p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="truncate">{hint}</span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">Chọn</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slim Input Bar */}
      <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-xl focus-within:border-slate-500 transition-all">
        {/* Japanese Voice Input Button */}
        <button
          type="button"
          onClick={handleToggleRecord}
          disabled={isStopping || (!isRecording && (disabled || isLoading))}
          aria-pressed={isRecording && !isStopping}
          aria-label={isRecording ? 'Dừng thu âm' : 'Bắt đầu thu âm tiếng Nhật'}
          title={isStopping ? 'Đang hoàn tất nhận diện' : isRecording ? 'Dừng thu âm' : 'Bắt đầu thu âm tiếng Nhật'}
          className={`p-2 rounded-lg transition-colors shrink-0 text-xs ${
            isRecording
              ? 'bg-rose-700 text-white animate-pulse'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
          }`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Keigo Hints Toggle Button */}
        {hints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            title="Xem gợi ý mẫu câu phỏng vấn"
            className={`p-2 rounded-lg transition-colors shrink-0 text-xs ${
              showHints
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        )}

        {/* Text Area (Slim, max 2 lines) */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          rows={1}
          placeholder={
            isRecording
              ? 'Đang lắng nghe tiếng Nhật...'
              : 'Nhập câu trả lời bằng tiếng Nhật (Nhấn Enter để gửi)...'
          }
          style={{ backgroundColor: 'transparent', color: '#ffffff' }}
          className="flex-1 !bg-transparent border-0 outline-none resize-none py-1 text-xs sm:text-sm text-white placeholder:text-slate-400"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || isLoading || isRecording || isStopping || !inputText.trim()}
          aria-label={isLoading ? 'Đang chấm câu trả lời' : 'Gửi câu trả lời'}
          aria-busy={isLoading}
          title="Gửi câu trả lời"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-100 border border-slate-600 font-medium transition-colors shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      {isLoading && <p role="status" className="px-2 text-xs text-slate-300">Đã gửi. Đang chấm câu trả lời…</p>}
    </div>
  )
}

export default PlayerControl
