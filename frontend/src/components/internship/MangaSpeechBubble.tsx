import React, { useState, useEffect } from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  X,
  GripHorizontal,
} from 'lucide-react'

export interface MangaSpeechBubbleProps {
  speakerName: string
  speakerTitle?: string
  textJa: string
  textVi?: string
  isSpeaking?: boolean
  onReplayAudio?: () => void
  onClose?: () => void
}

export const MangaSpeechBubble: React.FC<MangaSpeechBubbleProps> = ({
  speakerName,
  speakerTitle,
  textJa,
  textVi,
  isSpeaking = false,
  onReplayAudio,
  onClose,
}) => {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [showVi, setShowVi] = useState(false)
  const dragControls = useDragControls()

  // Typewriter animation: reveal character-by-character synchronized with speech
  useEffect(() => {
    setDisplayedLength(0)
    if (!textJa) return

    // Speed: ~40ms per character (natural Japanese reading pace)
    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        if (prev < textJa.length) {
          return prev + 1
        }
        clearInterval(interval)
        return prev
      })
    }, 42)

    return () => clearInterval(interval)
  }, [textJa])

  // Fast-forward on click: finish sentence immediately
  const handleFastForward = () => {
    if (displayedLength < textJa.length) {
      setDisplayedLength(textJa.length)
    }
  }

  const isTypingComplete = displayedLength >= textJa.length
  const currentText = textJa.slice(0, displayedLength)

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, scale: 0.85, y: -15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="relative z-40 max-w-sm sm:max-w-md w-[90vw] sm:w-[420px] pointer-events-auto select-none"
    >
      {/* Executive Corporate Dialogue Console (ArchViz Serious Mode) */}
      <div className="relative rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl p-4 sm:p-5 text-slate-100 transition-all">
        {/* 1. Header with Drag Handle, Speaker Badge & Controls */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 cursor-move"
          title="Nhấp giữ để kéo di chuyển bảng đàm thoại"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-slate-400 hover:text-slate-200 transition-colors" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-slate-200 tracking-wide">
                【 {speakerName} 】
              </span>
              {speakerTitle && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {speakerTitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Audio Replay Button */}
            {onReplayAudio && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReplayAudio()
                  setDisplayedLength(0)
                }}
                title="Nghe lại phát biểu tiếng Nhật"
                className={`p-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 ${
                  isSpeaking
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {isSpeaking ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            )}

            {/* Translation Toggle Button */}
            {textVi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowVi(!showVi)
                }}
                title={showVi ? 'Ẩn dịch nghĩa' : 'Xem dịch nghĩa tiếng Việt'}
                className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  showVi
                    ? 'bg-slate-700 text-slate-100 border-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                {showVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Close Button */}
            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                title="Thu nhỏ bảng đàm thoại"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Japanese Dialogue Text with Typewriter Effect */}
        <div
          onClick={handleFastForward}
          className="cursor-pointer select-text py-1"
          title="Nhấp để hiển thị nhanh toàn bộ câu"
        >
          <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed tracking-wide font-serif">
            <span className="text-slate-400 font-serif mr-1">「</span>
            <span>{currentText}</span>
            {!isTypingComplete && (
              <span className="inline-block w-1.5 h-4 sm:h-5 bg-amber-400/80 ml-1 animate-pulse align-middle" />
            )}
            <span className="text-slate-400 font-serif ml-1">」</span>
          </p>

          {/* Vietnamese Translation (Subtle Corporate Subtitle) */}
          {showVi && textVi && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2.5 pt-2 border-t border-slate-800 text-xs sm:text-sm text-slate-300 font-normal leading-relaxed"
            >
              <span className="text-amber-400 font-bold mr-1">🇻🇳 Dịch:</span>
              <span>{textVi}</span>
            </motion.div>
          )}
        </div>

        {/* 3. Manga Speaking Indicator Dots */}
        <div className="flex items-center justify-between pt-2 mt-1 text-[11px] font-bold text-slate-400 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            {isSpeaking ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Đang phát biểu...</span>
              </span>
            ) : (
              <span className="text-slate-400">💡 Nhấp bóng thoại để đọc nhanh</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Bóng thoại 3D</span>
        </div>

        {/* 4. Comic Tail (Pointing Downward toward the Boss NPC) */}
        <div className="absolute -bottom-2.5 right-10 sm:right-14 w-5 h-5 overflow-hidden pointer-events-none">
          <div className="w-3.5 h-3.5 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 transform origin-top-left shadow-lg" />
        </div>
      </div>
    </motion.div>
  )
}

export default MangaSpeechBubble
