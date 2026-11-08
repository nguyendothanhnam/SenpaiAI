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
            className="p-4 rounded-3xl border-2 border-amber-500/40 bg-slate-950/95 backdrop-blur-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Mẫu câu chuẩn công sở Nhật gợi ý:
              </span>
              <button
                type="button"
                onClick={() => setShowHints(false)}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 hover:text-white"
              >
                Đóng
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {hints.map((hint, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyHint(hint)}
                  className="text-left text-xs sm:text-sm p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-white hover:text-amber-300 font-semibold transition-all shadow-sm flex items-center justify-between gap-2"
                >
                  <span>{hint}</span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider shrink-0">Chọn câu này →</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Control Bar - High Contrast 3D Glass */}
      <div className="relative flex items-center gap-2.5 p-3 rounded-3xl border-2 border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl shadow-2xl focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
        {/* Hints Trigger Button */}
        {hints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            title="Xem gợi ý mẫu câu Keigo"
            className={`p-3 rounded-2xl transition-all shrink-0 ${
              showHints
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-slate-900/90 text-amber-400 hover:bg-slate-800 border border-slate-700/80'
            }`}
          >
            <Lightbulb className="w-5 h-5 fill-current" />
          </button>
        )}

        {/* Japanese Voice Input Button */}
        <button
          type="button"
          onClick={handleToggleRecord}
          disabled={disabled || isLoading}
          title={isRecording ? 'Dừng thu âm' : 'Nói tiếng Nhật (Voice Speech-to-Text)'}
          className={`p-3 rounded-2xl transition-all shrink-0 ${
            isRecording
              ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/40 ring-2 ring-rose-400'
              : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
          }`}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Text Input Area - Pure White Text with Clear Placeholder */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          rows={1}
          placeholder={
            isRecording
              ? '🎙️ Đang lắng nghe tiếng Nhật... Hãy nói to rõ...'
              : 'Nhập câu trả lời bằng tiếng Nhật (Hoặc bấm mic để nói)...'
          }
          style={{ backgroundColor: 'transparent', color: '#ffffff' }}
          className="flex-1 !bg-transparent border-0 outline-none resize-none p-1.5 text-base sm:text-lg font-bold !text-white placeholder:!text-slate-400 caret-amber-400 drop-shadow-sm"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || isLoading || !inputText.trim()}
          className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 transition-all shrink-0 shadow-lg shadow-orange-500/20"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300 px-3 font-medium">
        <span>⌨️ Gõ tiếng Nhật hoặc 🎙️ Dùng micro • Nhấn Enter để gửi</span>
        {hints.length > 0 && (
          <span
            className="text-amber-400 font-bold cursor-pointer hover:underline flex items-center gap-1"
            onClick={() => setShowHints(true)}
          >
            💡 Có {hints.length} gợi ý mẫu câu
          </span>
        )}
      </div>
    </div>
  )
}
export default PlayerControl

