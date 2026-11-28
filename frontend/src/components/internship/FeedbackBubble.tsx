import React, { useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  CheckCircle2,
  FileText,
  MessageSquare,
  X,
  Minus,
  Maximize2,
  GripHorizontal,
  Info,
  Code2,
} from 'lucide-react'

export interface FeedbackBubbleProps {
  userResponse: string
  correctedSentence?: string | null
  adviceVi?: string
  technicalAdviceVi?: string
  scores?: {
    grammar: number
    keigo: number
    manner: number
    technical?: number
    cv_alignment?: number
    overall?: number
  } | null
  onClose?: () => void
}

export const FeedbackBubble: React.FC<FeedbackBubbleProps> = ({
  userResponse,
  correctedSentence,
  adviceVi,
  technicalAdviceVi,
  scores,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const dragControls = useDragControls()

  const hasTechnical = scores && typeof scores.technical === 'number'
  const avgScore = typeof scores?.overall === 'number' ? Number(scores.overall.toFixed(1)) : scores
    ? hasTechnical
      ? Math.round(
          (scores.technical! * 0.4) +
          (scores.keigo * 0.25) +
          (scores.manner * 0.2) +
          ((scores.cv_alignment ?? 80) * 0.15)
        )
      : Math.round((scores.grammar + scores.keigo + scores.manner) / 3)
    : null

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.06}
      initial={{ opacity: 0, scale: 0.98, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="w-full max-w-sm sm:max-w-md flex flex-col rounded-xl border border-slate-700/90 bg-slate-950/95 backdrop-blur-2xl shadow-2xl text-slate-100 overflow-hidden pointer-events-auto font-sans"
    >
      {/* 1. Header Bar: Formal Executive Style */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between px-3.5 py-2 bg-slate-900/95 border-b border-slate-800 cursor-move select-none"
        title="Nhấp giữ để định vị cửa sổ đánh giá"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              【面接評価記録】 Biên bản đánh giá phản hồi
            </span>
            {avgScore !== null && (
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                {avgScore}/100
              </span>
            )}
          </div>
        </div>

        {/* Window Controls: Minimize / Expand & Close */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed(!isCollapsed)
            }}
            title={isCollapsed ? 'Mở rộng chi tiết' : 'Thu gọn'}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
              title="Đóng biên bản"
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Collapsed Bar Mode */}
      {isCollapsed ? (
        <div className="px-3.5 py-2.5 bg-slate-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0 font-medium">Câu đáp:</span>
            <span className="text-slate-200 font-normal truncate">{userResponse}</span>
          </div>
          {scores && (
            <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
              {hasTechnical && typeof scores.technical === 'number' && (
                <span className="text-amber-400 font-bold">技術: {scores.technical}/100</span>
              )}
              <span className="text-slate-300">敬語: {scores.keigo}/100</span>
              <span className="text-slate-300">マナー: {scores.manner}/100</span>
              {hasTechnical && typeof scores.cv_alignment === 'number' && (
                <span className="text-sky-300">CV: {scores.cv_alignment}/100</span>
              )}
            </div>
          )}
        </div>
      ) : (
        /* 3. Full Expanded Card Body */
        <div className="p-4 flex flex-col gap-3 select-text max-h-[50vh] overflow-y-auto">
          {/* User Response Row */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Nội dung ứng viên đã trả lời:
              </div>
              <div className="text-sm text-slate-100 font-serif leading-relaxed break-words">
                「{userResponse}」
              </div>
            </div>
          </div>

          {/* Business & Technical Evaluation Metrics */}
          {scores && (
            <div className={`grid ${hasTechnical ? 'grid-cols-4' : 'grid-cols-3'} gap-2 py-2 border-y border-slate-800/80`}>
              {hasTechnical && typeof scores.technical === 'number' && (
                <div className="flex flex-col items-center justify-center p-2 rounded bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-tight">Kỹ thuật (技術)</span>
                  <span className="text-sm font-mono font-black text-amber-300">{scores.technical}/100</span>
                </div>
              )}

              <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">Kính ngữ (敬語)</span>
                <span className="text-sm font-mono font-bold text-slate-100">{scores.keigo}/100</span>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">Tác phong (マナー)</span>
                <span className="text-sm font-mono font-bold text-slate-100">{scores.manner}/100</span>
              </div>

              {hasTechnical && typeof scores.cv_alignment === 'number' ? (
                <div className="flex flex-col items-center justify-center p-2 rounded bg-sky-500/10 border border-sky-500/30">
                  <span className="text-[9px] font-bold text-sky-400 uppercase tracking-tight">Khớp CV (整合)</span>
                  <span className="text-sm font-mono font-black text-sky-300">{scores.cv_alignment}/100</span>
                </div>
              ) : (
                !hasTechnical && (
                  <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">Ngữ pháp (文法)</span>
                    <span className="text-sm font-mono font-bold text-slate-100">{scores.grammar}/100</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* AI Correction & Technical / Business Advice */}
          <div className="space-y-2 text-xs">
            {correctedSentence && (
              <div className="p-3 rounded bg-slate-900/70 border border-slate-700/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Câu tiếng Nhật gợi ý</span>
                </div>
                <p className="font-serif text-emerald-200/95 leading-relaxed pl-5">
                  「{correctedSentence}」
                </p>
              </div>
            )}

            {technicalAdviceVi && (
              <div className="p-3 rounded bg-amber-950/40 border border-amber-600/40">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 mb-1">
                  <Code2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Nhận xét chuyên môn Kỹ thuật (RAG Grounded):</span>
                </div>
                <p className="text-amber-100/90 leading-relaxed font-sans pl-5">
                  {technicalAdviceVi}
                </p>
              </div>
            )}

            {adviceVi && (
              <div className="p-3 rounded bg-slate-900/70 border border-slate-700/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 mb-1">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>Nhận xét và cách cải thiện</span>
                </div>
                <p className="whitespace-pre-line text-slate-300 leading-relaxed font-sans pl-5">
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
