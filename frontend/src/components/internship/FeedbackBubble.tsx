import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Award, MessageSquare } from 'lucide-react'

interface FeedbackBubbleProps {
  userResponse: string
  correctedSentence?: string
  adviceVi?: string
  scores?: {
    grammar: number
    keigo: number
    manner: number
  } | null
}

export const FeedbackBubble: React.FC<FeedbackBubbleProps> = ({
  userResponse,
  correctedSentence,
  adviceVi,
  scores,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-3 rounded-3xl border-2 border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-5 shadow-2xl text-white select-text"
    >
      {/* User Response Row */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div
            className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-0.5"
            style={{ color: '#cbd5e1' }}
          >
            Câu trả lời của bạn:
          </div>
          <div
            className="text-sm sm:text-base font-bold text-white drop-shadow"
            style={{ color: '#ffffff' }}
          >
            {userResponse}
          </div>
        </div>
      </div>

      {/* AI Performance Scores */}
      {scores && (
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800">
          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-blue-500/20 border border-blue-400/40">
            <span className="text-[11px] font-bold text-blue-300" style={{ color: '#93c5fd' }}>Ngữ pháp</span>
            <span className="text-base sm:text-xl font-black text-white" style={{ color: '#ffffff' }}>{scores.grammar}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-purple-500/20 border border-purple-400/40">
            <span className="text-[11px] font-bold text-purple-300" style={{ color: '#d8b4fe' }}>Kính ngữ (Keigo)</span>
            <span className="text-base sm:text-xl font-black text-white" style={{ color: '#ffffff' }}>{scores.keigo}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-amber-500/20 border border-amber-400/40">
            <span className="text-[11px] font-bold text-amber-300" style={{ color: '#fcd34d' }}>Tác phong (Manner)</span>
            <span className="text-base sm:text-xl font-black text-white" style={{ color: '#ffffff' }}>{scores.manner}</span>
          </div>
        </div>
      )}

      {/* AI Correction & Business Advice */}
      <div className="space-y-2 text-xs sm:text-sm">
        {correctedSentence && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1" style={{ color: '#6ee7b7' }}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Gợi ý diễn đạt tự nhiên hơn:</span>
            </div>
            <p className="font-bold text-white" style={{ color: '#ffffff' }}>
              {correctedSentence}
            </p>
          </div>
        )}

        {adviceVi && (
          <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1" style={{ color: '#fcd34d' }}>
              <Award className="w-4 h-4" />
              <span>Nhận xét văn hóa công sở Nhật Bản:</span>
            </div>
            <p className="text-slate-100 leading-relaxed font-medium" style={{ color: '#f1f5f9' }}>
              {adviceVi}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
export default FeedbackBubble
