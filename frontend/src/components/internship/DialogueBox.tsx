import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Eye, EyeOff, Target } from 'lucide-react'

interface DialogueBoxProps {
  speakerName: string
  speakerTitle: string
  messageJa: string
  messageVi: string
  focus?: string
  onSpeakingChange?: (speaking: boolean) => void
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speakerName,
  speakerTitle,
  messageJa,
  messageVi,
  focus,
  onSpeakingChange,
}) => {
  const [showVi, setShowVi] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const updatePlayingState = (playing: boolean) => {
    setIsPlayingAudio(playing)
    onSpeakingChange?.(playing)
  }

  // Speak Japanese text via Web Speech API
  const handlePlayAudio = () => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    if (isPlayingAudio) {
      updatePlayingState(false)
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

    utterance.onstart = () => updatePlayingState(true)
    utterance.onend = () => updatePlayingState(false)
    utterance.onerror = () => updatePlayingState(false)

    window.speechSynthesis.speak(utterance)
  }

  // Cleanup audio on unmount or new message
  useEffect(() => {
    setShowVi(false)
    updatePlayingState(false)
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
      className="relative w-full rounded-3xl border-2 border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl transition-all text-white select-text"
    >
      {/* Dialogue Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="font-extrabold text-lg sm:text-xl text-amber-400 drop-shadow"
            style={{ color: '#fbbf24' }}
          >
            {speakerName}
          </span>
          <span
            className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
            style={{ color: '#fcd34d' }}
          >
            {speakerTitle}
          </span>
        </div>

        {/* Audio & Translation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayAudio}
            type="button"
            title="Nghe phát âm tiếng Nhật"
            style={{ color: isPlayingAudio ? '#ffffff' : '#f1f5f9' }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-md ${
              isPlayingAudio
                ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
                : 'bg-slate-900 text-slate-100 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span>{isPlayingAudio ? 'Đang phát...' : 'Phát âm'}</span>
          </button>

          <button
            onClick={() => setShowVi(!showVi)}
            type="button"
            title="Bật / Tắt dịch nghĩa tiếng Việt"
            style={{ color: showVi ? '#ffffff' : '#f1f5f9' }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-md ${
              showVi
                ? 'bg-amber-500 text-white border-amber-400'
                : 'bg-slate-900 text-slate-100 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {showVi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-400" />}
            <span>{showVi ? 'Ẩn dịch' : 'Dịch nghĩa'}</span>
          </button>
        </div>
      </div>

      {/* Main Dialogue Japanese Text - High Contrast Crystal Clear Pure White */}
      <div className="mt-4">
        <p
          className="text-lg sm:text-2xl font-bold text-white leading-relaxed tracking-wide drop-shadow-md select-text"
          style={{ color: '#ffffff' }}
        >
          {messageJa}
        </p>

        {/* Optional Vietnamese Translation */}
        {showVi && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ color: '#fef08a' }}
            className="mt-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-sm sm:text-base text-amber-200 leading-relaxed font-medium"
          >
            🇻🇳 <strong style={{ color: '#ffffff' }}>Dịch: </strong>{messageVi}
          </motion.div>
        )}
      </div>

      {/* Target Focus / Hint for Learner */}
      {focus && (
        <div
          className="mt-4 pt-3 border-t border-slate-800 flex items-start gap-2 text-xs sm:text-sm text-slate-200"
          style={{ color: '#e2e8f0' }}
        >
          <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-amber-400 font-bold" style={{ color: '#fbbf24' }}>Trọng tâm phản xạ: </strong>
            <span className="text-white font-medium" style={{ color: '#ffffff' }}>{focus}</span>
          </span>
        </div>
      )}
    </motion.div>
  )
}
export default DialogueBox

