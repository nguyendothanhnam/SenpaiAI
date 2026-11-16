import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, X, Building, Calendar, ArrowRight, Coins } from 'lucide-react'
import type { OfferLetter } from '../../services/api'

interface OfferLetterModalProps {
  isOpen: boolean
  onClose: () => void
  offerLetter: OfferLetter | null
  onStartWorkplace?: () => void
}

export const OfferLetterModal: React.FC<OfferLetterModalProps> = ({
  isOpen,
  onClose,
  offerLetter,
  onStartWorkplace,
}) => {
  if (!isOpen || !offerLetter) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl my-8 rounded-3xl bg-amber-50/95 dark:bg-slate-900 border-4 border-amber-500/60 shadow-2xl p-6 sm:p-8 text-slate-800 dark:text-slate-100 overflow-hidden"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Certificate Header Banner */}
          <div className="text-center pb-6 border-b-2 border-amber-500/40 relative">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-[0.25em] bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
              Chính thức từ hội đồng tuyển dụng
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-slate-900 dark:text-amber-100 font-serif">
              内定通知書
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              THƯ BÁO TRÚNG TUYỂN THỰC TẬP SINH NHẬT BẢN
            </p>
          </div>

          {/* Body Content */}
          <div className="py-6 space-y-5 text-sm sm:text-base">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Ứng viên trúng tuyển:</p>
                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {offerLetter.candidate_name} 様 (Quý học viên)
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Ngày cấp:</p>
                <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{offerLetter.date}</span>
                </div>
              </div>
            </div>

            {/* Congratulations Note */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {offerLetter.ceo_message}
            </div>

            {/* Offer Details Box */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/80 border border-amber-500/20 shadow-inner grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Doanh nghiệp tiếp nhận:</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-1 mt-0.5">
                  <Building className="w-4 h-4 text-amber-500" />
                  <span>{offerLetter.company_name}</span>
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Vị trí & Cấp bậc phân bổ:</p>
                <p className="font-bold text-amber-600 dark:text-amber-400 text-sm sm:text-base mt-0.5">
                  {offerLetter.assigned_position}
                </p>
              </div>
            </div>

            {/* Performance Scores Radar Summary */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white/40 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-4 h-4 text-amber-500" />
                  Đánh giá năng lực phỏng vấn:
                </span>
                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {offerLetter.overall_score} / 100 Điểm
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block">Ngữ pháp</span>
                  <span className="font-bold text-slate-800 dark:text-white">{offerLetter.scores_breakdown.grammar}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block">Kính ngữ (Keigo)</span>
                  <span className="font-bold text-slate-800 dark:text-white">{offerLetter.scores_breakdown.keigo}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block">Văn hóa (Manner)</span>
                  <span className="font-bold text-slate-800 dark:text-white">{offerLetter.scores_breakdown.manner}</span>
                </div>
              </div>
            </div>

            {/* Rewards Stipend */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/30">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">Thưởng trúng tuyển:</div>
                  <div className="text-[11px] text-slate-500">Đã cộng trực tiếp vào ví điểm của bạn</div>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-amber-600 dark:text-amber-400 text-sm sm:text-base">
                  +{offerLetter.monthly_stipend_exp} EXP & +{offerLetter.points_reward} Điểm
                </span>
              </div>
            </div>

            {/* Traditional Hanko Red Seal Stamped */}
            <div className="relative flex justify-end items-center pr-4 pt-2">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-rose-600 text-rose-600 font-serif font-black text-sm uppercase tracking-widest shadow-md rotate-[-12deg] select-none bg-rose-50/30 dark:bg-rose-950/20">
                <div className="text-center leading-tight">
                  <div className="text-[10px] tracking-tighter">株式会社</div>
                  <div className="text-base font-bold">{offerLetter.hanko_seal_text}</div>
                  <div className="text-[9px] tracking-tighter">検定済</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t-2 border-amber-500/30 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
            >
              Xem lại hồ sơ
            </button>

            {onStartWorkplace && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onStartWorkplace()
                }}
                className="w-full sm:w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:opacity-95 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <span>Bắt đầu ngày làm việc</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
export default OfferLetterModal
