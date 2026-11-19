import React, { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Target,
  Maximize2,
  Minimize2,
  Minus,
  X,
  GripHorizontal,
} from 'lucide-react'

export interface DialogueBoxProps {
  speakerName: string
  speakerTitle: string
  messageJa: string
  messageVi: string
  focus?: string
  onSpeakingChange?: (speaking: boolean) => void
  onClose?: () => void
  docked?: boolean
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speakerName,
  speakerTitle,
  messageJa,
  messageVi,
  focus,
  onSpeakingChange,
  onClose,
  docked = false,
}) => {
  const [showVi, setShowVi] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [sizeMode, setSizeMode] = useState<'normal' | 'maximized' | 'compact'>('normal')
  const dragControls = useDragControls()

  const updatePlayingState = useCallback((playing: boolean) => {
    setIsPlayingAudio(playing)
    onSpeakingChange?.(playing)
  }, [onSpeakingChange])

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
    if (isPlayingAudio) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      updatePlayingState(false)
    } else {
      speakJapanese()
    }
  }

  // Auto-speak when question loads or changes
  useEffect(() => {
    setShowVi(false)
    updatePlayingState(false)

    // Slight delay so the user can orient before audio begins
    const timer = setTimeout(() => {
      speakJapanese()
    }, 450)

    return () => {
      clearTimeout(timer)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [speakJapanese, updatePlayingState])

  return (
    <motion.div
      drag={!docked}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full rounded-3xl border-2 border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl shadow-2xl transition-all text-white select-text pointer-events-auto ${
        docked
          ? 'max-h-[30dvh] overflow-y-auto p-3 sm:p-4 mx-auto'
          : sizeMode === 'maximized'
          ? 'p-6 sm:p-8 max-w-5xl mx-auto'
          : sizeMode === 'compact'
          ? 'p-3.5 sm:p-4 max-w-2xl mx-auto'
          : 'p-4 sm:p-6 max-w-4xl mx-auto'
      }`}
    >
      {/* 1. Dialogue Header Bar */}
      <div
        onPointerDown={(e) => { if (!docked) dragControls.start(e) }}
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 select-none ${docked ? '' : 'cursor-move'}`}
        title={docked ? undefined : 'Nhấp giữ để kéo di chuyển hộp thoại'}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-amber-400 transition-colors" />
          <span className="font-extrabold text-base sm:text-lg text-amber-400 drop-shadow">
            {speakerName}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
            {speakerTitle}
          </span>
        </div>

        {/* Audio, Translation & Size Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio Button */}
          <button
            onClick={handlePlayAudio}
            type="button"
            title="Nghe phát biểu tiếng Nhật"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-md ${
              isPlayingAudio
                ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
                : 'bg-slate-900 text-slate-100 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">{isPlayingAudio ? 'Đang nói...' : 'Phát âm'}</span>
          </button>

          {/* Translation Button */}
          <button
            onClick={() => setShowVi(!showVi)}
            type="button"
            title="Bật / Tắt dịch nghĩa tiếng Việt"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-md ${
              showVi
                ? 'bg-amber-500 text-white border-amber-400'
                : 'bg-slate-900 text-slate-100 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {showVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">{showVi ? 'Ẩn dịch' : 'Dịch nghĩa'}</span>
          </button>

          {/* Phóng to / Thu vừa Button */}
          <button
            onClick={() => setSizeMode(sizeMode === 'maximized' ? 'normal' : 'maximized')}
            type="button"
            title={sizeMode === 'maximized' ? 'Thu về kích thước chuẩn' : 'Phóng to chữ và hộp thoại'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            {sizeMode === 'maximized' ? (
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          {/* Thu nhỏ Compact Button */}
          <button
            onClick={() => setSizeMode(sizeMode === 'compact' ? 'normal' : 'compact')}
            type="button"
            title={sizeMode === 'compact' ? 'Mở lại đầy đủ' : 'Thu nhỏ thanh gọn'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <Minus className="w-3.5 h-3.5 text-slate-300" />
          </button>

          {/* Tắt / Ẩn Button */}
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              title="Tắt hộp thoại này để quan sát toàn bộ phòng 3D"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Bar Mode */}
      {sizeMode === 'compact' ? (
        <div
          onClick={() => setSizeMode('normal')}
          className="mt-2 text-xs text-slate-300 cursor-pointer flex items-center justify-between gap-3 hover:text-white transition-colors"
        >
          <p className="truncate font-medium">{messageJa}</p>
          <span className="text-[11px] font-bold text-amber-400 shrink-0">Nhấp để phóng to ↗</span>
        </div>
      ) : (
        /* 3. Full / Maximized Content Mode */
        <>
          <div className="mt-3 sm:mt-4">
            <p
              className={`font-black text-white leading-relaxed tracking-wide drop-shadow-md select-text ${
                sizeMode === 'maximized' ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'
              }`}
            >
              {messageJa}
            </p>

            {/* Optional Vietnamese Translation */}
            {showVi && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs sm:text-base text-amber-200 leading-relaxed font-medium"
              >
                🇻🇳 <strong className="text-white">Dịch: </strong>
                {messageVi}
              </motion.div>
            )}
          </div>

          {/* Target Focus / Hint for Learner */}
          {focus && (
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-start gap-2 text-xs sm:text-sm text-slate-300">
              <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-400 font-bold">Trọng tâm phản xạ: </strong>
                <span className="text-slate-100 font-medium">{focus}</span>
              </span>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

export default DialogueBox
