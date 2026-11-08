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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl my-8 rounded-3xl bg-[color:var(--bg-card)] border border-[color:var(--border)] shadow-2xl p-6 sm:p-8 max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[color:var(--border)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[color:var(--primary)]/15 text-[color:var(--primary)]">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[color:var(--text)]">
                  Cẩm nang văn hóa công sở Nhật Bản
                </h3>
                <p className="text-xs text-[color:var(--text-muted)]">
                  Quy tắc ứng xử và tác phong vàng cho thực tập sinh
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-full hover:bg-[color:var(--accent)] text-[color:var(--text-muted)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Handbook Items Scrollable List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
            {handbook.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base sm:text-lg font-bold text-[color:var(--text)] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{item.title}</span>
                  </h4>
                </div>

                <p className="text-xs sm:text-sm text-[color:var(--text-muted)] leading-relaxed">
                  {item.summary}
                </p>

                {/* Details Breakdown */}
                <div className="grid gap-2 pt-1">
                  {item.details.map((detail, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-2.5 rounded-xl bg-[color:var(--accent)]/30 border border-[color:var(--border)] text-xs sm:text-sm"
                    >
                      <strong className="text-[color:var(--text)] block font-semibold mb-0.5">
                        {detail.name}
                      </strong>
                      <span className="text-[color:var(--text-muted)]">
                        {detail.usage}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pro tip */}
                {item.pro_tip && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      <strong>Mẹo vàng Senpai: </strong>
                      {item.pro_tip}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[color:var(--border)] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-contrast)] text-sm font-semibold hover:opacity-90 transition-opacity"
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
