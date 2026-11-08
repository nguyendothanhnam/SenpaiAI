import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Eye, EyeOff, Target } from 'lucide-react'

interface DialogueBoxProps {
  speakerName: string
  speakerTitle: string
  messageJa: string
  messageVi: string
  focus?: string
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speakerName,
  speakerTitle,
  messageJa,
  messageVi,
  focus,
}) => {
  const [showVi, setShowVi] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Speak Japanese text via Web Speech API
  const handlePlayAudio = () => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    if (isPlayingAudio) {
      setIsPlayingAudio(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(messageJa)
    utterance.lang = 'ja-JP'
    utterance.rate = 0.9 // Slightly slower for clarity
    utterance.pitch = 1.0

    // Try finding Japanese voice
    const voices = window.speechSynthesis.getVoices()
    const jaVoice = voices.find((v) => v.lang.startsWith('ja'))
    if (jaVoice) {
      utterance.voice = jaVoice
    }

    utterance.onstart = () => setIsPlayingAudio(true)
    utterance.onend = () => setIsPlayingAudio(false)
    utterance.onerror = () => setIsPlayingAudio(false)

    window.speechSynthesis.speak(utterance)
  }

  // Cleanup audio on unmount or new message
  useEffect(() => {
    setShowVi(false)
    setIsPlayingAudio(false)
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [messageJa])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6 shadow-md transition-all"
    >
      {/* Dialogue Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base sm:text-lg text-[color:var(--text)]">
            {speakerName}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[color:var(--accent)] text-[color:var(--primary)] font-medium">
            {speakerTitle}
          </span>
        </div>

        {/* Audio & Translation Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handlePlayAudio}
            type="button"
            title="Nghe phát âm tiếng Nhật"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              isPlayingAudio
                ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                : 'bg-[color:var(--bg-card)] text-[color:var(--text-muted)] hover:text-[color:var(--primary)] border-[color:var(--border)]'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isPlayingAudio ? 'Đang phát...' : 'Phát âm'}</span>
          </button>

          <button
            onClick={() => setShowVi(!showVi)}
            type="button"
            title="Bật / Tắt dịch nghĩa tiếng Việt"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              showVi
                ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] border-[color:var(--primary)]'
                : 'bg-[color:var(--bg-card)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] border-[color:var(--border)]'
            }`}
          >
            {showVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showVi ? 'Ẩn dịch' : 'Dịch nghĩa'}</span>
          </button>
        </div>
      </div>

      {/* Main Dialogue Japanese Text */}
      <div className="mt-4">
        <p className="text-base sm:text-xl font-medium text-[color:var(--text)] leading-relaxed tracking-wide">
          {messageJa}
        </p>

        {/* Optional Vietnamese Translation */}
        {showVi && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 p-3 rounded-xl bg-[color:var(--accent)]/40 border border-[color:var(--border)] text-sm sm:text-base text-[color:var(--text-muted)] italic"
          >
            {messageVi}
          </motion.div>
        )}
      </div>

      {/* Target Focus / Hint for Learner */}
      {focus && (
        <div className="mt-4 pt-3 border-t border-[color:var(--border)]/60 flex items-start gap-2 text-xs text-[color:var(--text-muted)]">
          <Target className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-[color:var(--text)] font-semibold">Trọng tâm phản xạ: </strong>
            {focus}
          </span>
        </div>
      )}
    </motion.div>
  )
}
export default DialogueBox

