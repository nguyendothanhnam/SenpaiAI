import React, { useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX, Eye, EyeOff } from 'lucide-react'

export interface DialogueBoxProps {
  speakerName: string
  speakerTitle: string
  messageJa: string
  messageVi: string
  focus?: string
  isSpeaking?: boolean
  onReplayAudio?: () => void
  onSpeakingChange?: (speaking: boolean) => void
  onClose?: () => void
  docked?: boolean
}

/**
 * DialogueBox: Cinematic Executive Subtitle Bar.
 * Follows photorealistic film standards:
 * - Crisp white text placed low on screen.
 * - Max 2 lines of Japanese speech text.
 * - Clean audio replay and translation toggles.
 * - No oversized floating boxes or cartoon elements.
 */
export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speakerName,
  speakerTitle,
  messageJa,
  messageVi,
  focus,
  isSpeaking,
  onReplayAudio,
  onSpeakingChange,
}) => {
  const [showVi, setShowVi] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const activePlaying = isSpeaking ?? isPlayingAudio

  const updatePlayingState = useCallback(
    (playing: boolean) => {
      setIsPlayingAudio(playing)
      onSpeakingChange?.(playing)
    },
    [onSpeakingChange]
  )

  // Speak Japanese text via Web Speech API
  const speakJapanese = useCallback(() => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    try {
      const utterance = new SpeechSynthesisUtterance(messageJa)
      ;(window as any).__dialogueUtterance = utterance
      utterance.lang = 'ja-JP'
      utterance.rate = 0.92 // Natural polite Japanese cadence
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const jaVoice = voices.find((v) => v.lang.startsWith('ja') || v.name.includes('Japanese'))
      if (jaVoice) {
        utterance.voice = jaVoice
      }

      utterance.onstart = () => updatePlayingState(true)
      utterance.onend = () => {
        delete (window as any).__dialogueUtterance
        updatePlayingState(false)
      }
      utterance.onerror = () => {
        delete (window as any).__dialogueUtterance
        updatePlayingState(false)
      }

      window.speechSynthesis.speak(utterance)
    } catch {
      updatePlayingState(false)
    }
  }, [messageJa, updatePlayingState])

  const handlePlayAudio = () => {
    if (onReplayAudio) {
      onReplayAudio()
      return
    }
    if (activePlaying) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      updatePlayingState(false)
    } else {
      speakJapanese()
    }
  }

  // Auto-speak when question loads or changes
  useEffect(() => {
    setShowVi(false)
    if (onReplayAudio) return

    updatePlayingState(false)

    const timer = setTimeout(() => {
      speakJapanese()
    }, 400)

    return () => {
      clearTimeout(timer)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      delete (window as any).__dialogueUtterance
      updatePlayingState(false)
    }
  }, [messageJa, onReplayAudio, speakJapanese, updatePlayingState])

  return (
    <div className="w-full bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xl text-slate-100 transition-all select-text font-sans">
      {/* Top micro-bar: Speaker identity & audio/translate controls */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">{speakerName}</span>
          {speakerTitle && (
            <span className="text-[11px] text-slate-400 font-mono">({speakerTitle})</span>
          )}
          {isPlayingAudio && (
            <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              Đang phát âm
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Audio Replay */}
          <button
            type="button"
            onClick={handlePlayAudio}
            title={isPlayingAudio ? 'Dừng phát âm' : 'Nghe lại phát biểu tiếng Nhật'}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs transition-colors"
          >
            {isPlayingAudio ? (
              <VolumeX className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">{isPlayingAudio ? 'Dừng' : 'Nghe lại'}</span>
          </button>

          {/* Translation Toggle */}
          <button
            type="button"
            onClick={() => setShowVi((prev) => !prev)}
            title="Dịch nghĩa tiếng Việt"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
              showVi
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-700/80'
            }`}
          >
            {showVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showVi ? 'Ẩn dịch' : 'Dịch'}</span>
          </button>
        </div>
      </div>

      {/* Main Subtitle Text: Japanese (Max 2 lines, clean sans serif) */}
      <div className="pt-2">
        <p className="text-sm sm:text-base md:text-lg font-medium text-white leading-relaxed line-clamp-2 tracking-wide">
          {messageJa}
        </p>

        {/* Translation: Clean single line if toggled */}
        {showVi && messageVi && (
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-snug line-clamp-2 font-normal italic border-t border-slate-800/60 pt-1">
            {messageVi}
          </p>
        )}

        {/* Focus hint if available */}
        {focus && (
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
            <span className="text-slate-500 font-sans">Gợi ý trọng tâm:</span>
            <span>{focus}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DialogueBox
