import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, X, Lightbulb, Sparkles } from 'lucide-react'
import type { BusinessHandbookItem } from '../../services/api'

interface HandbookModalProps {
  isOpen: boolean
  onClose: () => void
  handbook: BusinessHandbookItem[]
}

export const HandbookModal: React.FC<HandbookModalProps> = ({
  isOpen,
  onClose,
  handbook,
}) => {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl my-8 rounded-3xl bg-slate-900 border-2 border-amber-500/40 shadow-2xl p-6 sm:p-8 max-h-[85vh] flex flex-col text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-amber-300 drop-shadow-sm tracking-wide">
                  Cẩm nang văn hóa công sở Nhật Bản
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  Quy tắc ứng xử và tác phong vàng cho thực tập sinh
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Handbook Items Scrollable List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-2 custom-scrollbar">
            {handbook.map((item) => (
              <div
                key={item.id}
                className="p-5 sm:p-6 rounded-2xl border border-slate-700 bg-slate-800/90 shadow-lg space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base sm:text-lg font-bold text-amber-300 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>{item.title}</span>
                  </h4>
                </div>

                <p className="text-sm text-slate-100 leading-relaxed font-normal">
                  {item.summary}
                </p>

                {/* Details Breakdown */}
                <div className="grid gap-2.5 pt-1">
                  {item.details.map((detail, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 space-y-1 shadow-inner"
                    >
                      <strong className="text-emerald-400 block font-bold text-sm sm:text-base">
                        {detail.name}
                      </strong>
                      <span className="text-slate-200 text-xs sm:text-sm leading-relaxed block font-medium">
                        {detail.usage}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pro tip */}
                {item.pro_tip && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs sm:text-sm text-amber-100 leading-relaxed">
                    <Lightbulb className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <strong className="text-amber-300 font-bold">Mẹo vàng Senpai: </strong>
                      {item.pro_tip}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-700/80 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
            >
              Đã hiểu & Sẵn sàng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
export default HandbookModal
