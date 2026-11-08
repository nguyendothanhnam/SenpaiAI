import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, MicOff, Lightbulb, Sparkles, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PlayerControlProps {
  onSubmit: (text: string) => void
  disabled?: boolean
  isLoading?: boolean
  hints?: string[]
}

export const PlayerControl: React.FC<PlayerControlProps> = ({
  onSubmit,
  disabled = false,
  isLoading = false,
  hints = [],
}) => {
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Initialize Speech Recognition for Japanese STT
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'ja-JP' // Japanese recognition

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript))
          toast.success('Đã nhận diện giọng nói tiếng Nhật!')
        }
        setIsRecording(false)
      }

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err)
        setIsRecording(false)
        if (err.error !== 'no-speech') {
          toast.error('Không thể nhận diện giọng nói hoặc chưa cấp quyền mic.')
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const handleToggleRecord = () => {
    if (!recognitionRef.current) {
      toast.error('Trình duyệt của bạn không hỗ trợ Web Speech API nhận diện giọng nói.')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      try {
        recognitionRef.current.start()
      } catch (err) {
        recognitionRef.current.abort()
        setTimeout(() => recognitionRef.current?.start(), 150)
      }
    }
  }

  const handleSend = () => {
    const trimmed = inputText.trim()
    if (!trimmed || disabled || isLoading) return
    onSubmit(trimmed)
    setInputText('')
    setShowHints(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const applyHint = (hint: string) => {
    setInputText(hint)
    setShowHints(false)
  }

  return (
    <div className="relative w-full flex flex-col gap-3">
      {/* Keigo Hints Popover */}
      <AnimatePresence>
        {showHints && hints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Mẫu câu chuẩn công sở gợi ý:
              </span>
              <button
                type="button"
                onClick={() => setShowHints(false)}
                className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >
                Đóng
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {hints.map((hint, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyHint(hint)}
                  className="text-left text-xs sm:text-sm p-2 rounded-xl bg-[color:var(--bg-surface)] hover:bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--text)] transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Control Bar */}
      <div className="relative flex items-end gap-2 p-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-lg focus-within:border-[color:var(--primary)] focus-within:ring-2 focus-within:ring-[color:var(--primary)]/20 transition-all">
        {/* Hints Trigger Button */}
        {hints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            title="Xem gợi ý mẫu câu Keigo"
            className={`p-2.5 rounded-xl transition-colors shrink-0 ${
              showHints
                ? 'bg-amber-500 text-white'
                : 'text-[color:var(--text-muted)] hover:text-amber-500 hover:bg-[color:var(--accent)]'
            }`}
          >
            <Lightbulb className="w-5 h-5" />
          </button>
        )}

        {/* Japanese Voice Input Button */}
        <button
          type="button"
          onClick={handleToggleRecord}
          disabled={disabled || isLoading}
          title={isRecording ? 'Dừng thu âm' : 'Nói tiếng Nhật (Voice Speech-to-Text)'}
          className={`p-2.5 rounded-xl transition-all shrink-0 ${
            isRecording
              ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--primary)] hover:bg-[color:var(--accent)]'
          }`}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Text Input Area */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          rows={2}
          placeholder={
            isRecording
              ? '🎙️ Đang nghe tiếng Nhật... Hãy phát âm to rõ...'
              : 'Nhập câu trả lời bằng tiếng Nhật (Hoặc nhấn mic để nói)...'
          }
          className="flex-1 bg-transparent border-0 outline-none resize-none p-1 text-sm sm:text-base text-[color:var(--text)] placeholder:text-[color:var(--text-muted)]"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || isLoading || !inputText.trim()}
          className="p-2.5 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-contrast)] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shrink-0 shadow-md"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[color:var(--text-muted)] px-2">
        <span>Gõ tiếng Nhật hoặc dùng mic • Nhấn Enter để gửi</span>
        {hints.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium cursor-pointer" onClick={() => setShowHints(true)}>
            💡 Có {hints.length} gợi ý mẫu câu
          </span>
        )}
      </div>
    </div>
  )
}
export default PlayerControl
