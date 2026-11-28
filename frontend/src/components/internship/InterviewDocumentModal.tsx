import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, CheckCircle2 } from 'lucide-react'

export interface InterviewDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  npcName: string
  npcTitle: string
}

export const InterviewDocumentModal: React.FC<InterviewDocumentModalProps> = ({
  isOpen,
  onClose,
  companyName,
  npcName,
  npcTitle,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-2xl bg-[#faf8f5] text-slate-900 rounded-xl shadow-2xl border border-slate-300 p-6 sm:p-8 font-serif select-text max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors font-sans"
              title="Đóng tài liệu"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Document Header */}
            <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-sans block mb-1">
                SenpaiAI Corporate Simulation Standard
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide text-slate-900">
                【 採 用 面 接 評 価 記 録 票 】
              </h2>
              <p className="text-xs text-slate-600 mt-1">Japanese Corporate Interview Assessment Sheet</p>
            </div>

            {/* Target Information Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white/80 border border-slate-200 rounded-lg text-sm mb-6 font-sans">
              <div>
                <span className="text-slate-500 text-xs block">対象企業 (Doanh nghiệp tuyển dụng):</span>
                <span className="font-bold text-slate-800">{companyName || '株式会社ネクステック'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">面接担当 (Người phụ trách phỏng vấn):</span>
                <span className="font-bold text-slate-800">{npcName} ({npcTitle})</span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 text-xs block">実施基準 (Tiêu chuẩn đánh giá):</span>
                <span className="text-slate-700">日本ビジネス倫理・ビジネスマナー・実務対話能力 (Chuẩn mực tác phong & giao tiếp thực tế)</span>
              </div>
            </div>

            {/* Assessment Pillars */}
            <div className="space-y-4 mb-6 text-sm">
              <h3 className="font-bold text-base text-slate-900 border-b border-slate-300 pb-1.5 flex items-center gap-2 font-sans">
                <FileText className="w-4 h-4 text-slate-600" />
                主要審査項目 (Các tiêu chí đánh giá cốt lõi)
              </h3>

              <div className="space-y-3 font-sans">
                <div className="p-3 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      1. 自己紹介・志望動機の論理性 (Self-PR & Logical Structure)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Trình bày súc tích (PREP method: Kết luận → Lý do → Ví dụ → Kết luận). Thể hiện rõ mục tiêu phát triển và đóng góp cho doanh nghiệp.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      2. 敬語・待遇表現・ビジネスマナー (Keigo & Etiquette)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Sử dụng chính xác Kính ngữ (Kenjougo/Sonkeigo). Tác phong gõ cửa 3 tiếng, tư thế an tọa lưng thẳng, góc cúi chào 30–45°.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      3. 報告・連絡・相談 (Ho-Ren-So Protocol & Communication)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Khả năng lắng nghe tích cực (Aizuchi), phản xạ trung thực, đặt câu hỏi ngược (Gyakushitsumon) đúng mực vào cuối buổi phỏng vấn.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Hanko Stamp & Footer */}
            <div className="flex items-end justify-between pt-4 border-t border-slate-300">
              <div className="text-xs text-slate-500 font-sans">
                <span>Trạng thái: </span>
                <span className="font-bold text-slate-700">Đang phỏng vấn trực tiếp</span>
              </div>

              {/* Japanese Red Seal */}
              <div className="w-20 h-20 border-2 border-red-600 rounded flex flex-col items-center justify-center text-red-600 font-bold select-none rotate-[-4deg] opacity-90 shadow-sm">
                <span className="text-[10px] leading-tight">ネクステック</span>
                <span className="text-xs tracking-wider">面接選考印</span>
                <span className="text-[9px]">採用課</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
export default InterviewDocumentModal
