import React, { useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  CheckCircle2,
  Award,
  MessageSquare,
  X,
  Minus,
  Maximize2,
  GripHorizontal,
  Sparkles,
} from 'lucide-react'

export interface FeedbackBubbleProps {
  userResponse: string
  correctedSentence?: string
  adviceVi?: string
  scores?: {
    grammar: number
    keigo: number
    manner: number
  } | null
  onClose?: () => void
}

export const FeedbackBubble: React.FC<FeedbackBubbleProps> = ({
  userResponse,
  correctedSentence,
  adviceVi,
  scores,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const dragControls = useDragControls()

  const avgScore = scores
    ? Math.round((scores.grammar + scores.keigo + scores.manner) / 3)
    : null

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.06}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-sm sm:max-w-md flex flex-col rounded-3xl border-2 border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl shadow-2xl text-white overflow-hidden transition-shadow hover:shadow-amber-500/10 pointer-events-auto"
    >
      {/* 1. Draggable Top Header Bar */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 cursor-move select-none"
        title="Nhấp giữ để kéo di chuyển hộp thoại"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-400 hover:text-amber-400 transition-colors" />
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">Đánh giá câu trả lời</span>
            {avgScore !== null && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                {avgScore}đ
              </span>
            )}
          </div>
        </div>

        {/* Window Controls: Minimize / Expand & Close */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed(!isCollapsed)
            }}
            title={isCollapsed ? 'Mở rộng chi tiết' : 'Thu gọn'}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              title="Đóng hộp đánh giá"
              className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Collapsed Bar Mode */}
      {isCollapsed ? (
        <div className="p-3 bg-slate-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">Bạn đáp:</span>
            <span className="text-white font-semibold truncate">{userResponse}</span>
          </div>
          {scores && (
            <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold">
              <span className="text-blue-300">{scores.grammar}p</span>
              <span className="text-purple-300">{scores.keigo}p</span>
              <span className="text-amber-300">{scores.manner}p</span>
            </div>
          )}
        </div>
      ) : (
        /* 3. Full Expanded Card Body */
        <div className="p-4 sm:p-5 flex flex-col gap-3 select-text max-h-[45vh] overflow-y-auto">
          {/* User Response Row */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-0.5">
                Câu trả lời của bạn:
              </div>
              <div className="text-sm sm:text-base font-bold text-white drop-shadow break-words">
                {userResponse}
              </div>
            </div>
          </div>

          {/* AI Performance Scores */}
          {scores && (
            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800">
              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-blue-500/20 border border-blue-400/40">
                <span className="text-[11px] font-bold text-blue-300">Ngữ pháp</span>
                <span className="text-base sm:text-xl font-black text-white">{scores.grammar}</span>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-purple-500/20 border border-purple-400/40">
                <span className="text-[11px] font-bold text-purple-300">Kính ngữ (Keigo)</span>
                <span className="text-base sm:text-xl font-black text-white">{scores.keigo}</span>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-amber-500/20 border border-amber-400/40">
                <span className="text-[11px] font-bold text-amber-300">Tác phong (Manner)</span>
                <span className="text-base sm:text-xl font-black text-white">{scores.manner}</span>
              </div>
            </div>
          )}

          {/* AI Correction & Business Advice */}
          <div className="space-y-2 text-xs sm:text-sm">
            {correctedSentence && (
              <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Gợi ý diễn đạt tự nhiên hơn:</span>
                </div>
                <p className="font-bold text-white leading-relaxed">
                  {correctedSentence}
                </p>
              </div>
            )}

            {adviceVi && (
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                  <Award className="w-4 h-4" />
                  <span>Nhận xét văn hóa công sở Nhật Bản:</span>
                </div>
                <p className="text-slate-100 leading-relaxed font-medium">
                  {adviceVi}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default FeedbackBubble
