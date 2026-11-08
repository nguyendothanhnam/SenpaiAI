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
      className="w-full flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5 shadow-sm"
    >
      {/* User Response Row */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[color:var(--primary)]/15 text-[color:var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-1">
            Câu trả lời của bạn:
          </div>
          <div className="text-sm sm:text-base font-medium text-[color:var(--text)]">
            {userResponse}
          </div>
        </div>
      </div>

      {/* AI Performance Scores */}
      {scores && (
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-[color:var(--border)]">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400">Ngữ pháp</span>
            <span className="text-sm sm:text-lg font-bold text-blue-700 dark:text-blue-300">{scores.grammar}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] sm:text-xs font-medium text-purple-600 dark:text-purple-400">Kính ngữ (Keigo)</span>
            <span className="text-sm sm:text-lg font-bold text-purple-700 dark:text-purple-300">{scores.keigo}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-400">Văn hóa (Manner)</span>
            <span className="text-sm sm:text-lg font-bold text-amber-700 dark:text-amber-300">{scores.manner}</span>
          </div>
        </div>
      )}

      {/* AI Correction & Business Advice */}
      <div className="space-y-2 text-xs sm:text-sm">
        {correctedSentence && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gợi ý diễn đạt tự nhiên hơn:</span>
            </div>
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              {correctedSentence}
            </p>
          </div>
        )}

        {adviceVi && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
              <Award className="w-4 h-4" />
              <span>Nhận xét văn hóa công sở Nhật Bản:</span>
            </div>
            <p className="text-[color:var(--text-muted)] leading-relaxed">
              {adviceVi}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
export default FeedbackBubble
