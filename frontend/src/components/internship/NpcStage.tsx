import React from 'react'
import { motion } from 'framer-motion'
import { Building2, MapPin, Sparkles } from 'lucide-react'

interface NpcStageProps {
  npcName: string
  npcTitle: string
  npcEmotion?: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'strict'
  companyName: string
  companyLocation?: string
  sessionType: 'interview' | 'workplace'
  currentTurn: number
  maxTurns: number
}

export const NpcStage: React.FC<NpcStageProps> = ({
  npcName,
  npcTitle,
  npcEmotion = 'neutral',
  companyName,
  companyLocation = 'Tokyo, Japan',
  sessionType,
  currentTurn,
  maxTurns,
}) => {
  // Emotion styling and icons
  const emotionConfig = {
    neutral: { label: 'Tập trung', color: 'bg-blue-500/20 text-blue-600 border-blue-400/30', emoji: '🧐' },
    happy: { label: 'Hài lòng', color: 'bg-emerald-500/20 text-emerald-600 border-emerald-400/30', emoji: '😊' },
    thinking: { label: 'Cân nhắc', color: 'bg-amber-500/20 text-amber-600 border-amber-400/30', emoji: '🤔' },
    surprised: { label: 'Ấn tượng', color: 'bg-purple-500/20 text-purple-600 border-purple-400/30', emoji: '✨' },
    strict: { label: 'Kỷ luật', color: 'bg-rose-500/20 text-rose-600 border-rose-400/30', emoji: '📋' },
  }

  const currentEmotion = emotionConfig[npcEmotion] || emotionConfig.neutral

  return (
    <div className="relative w-full h-72 sm:h-80 md:h-96 rounded-3xl overflow-hidden border border-[color:var(--border)] shadow-xl bg-gradient-to-b from-slate-900/90 via-slate-800/80 to-slate-950/95 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Background Architectural Japanese Office Grid */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Ambient Office Glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top HUD: Company, Location, Progress */}
      <div className="relative z-10 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white font-medium shadow-sm">
          <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate max-w-[180px] sm:max-w-xs">{companyName}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{companyLocation}</span>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {sessionType === 'interview' ? 'Vòng' : 'Bước'} {currentTurn} / {maxTurns}
            </span>
          </div>
        </div>
      </div>

      {/* Center 2.5D NPC Character Model */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mb-2">
        <motion.div
          key={npcEmotion}
          initial={{ scale: 0.95, y: 8, opacity: 0.8 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative flex flex-col items-center"
        >
          {/* NPC Emotion Bubble */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`absolute -top-3 right-0 sm:-right-4 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold backdrop-blur-md shadow-md flex items-center gap-1 z-20 ${currentEmotion.color}`}
          >
            <span>{currentEmotion.emoji}</span>
            <span>{currentEmotion.label}</span>
          </motion.div>

          {/* NPC Visual Avatar Art */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 bg-gradient-to-tr from-amber-500/60 via-purple-500/40 to-blue-500/60 shadow-2xl ring-4 ring-black/40">
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center relative">
              {/* Stylized Japanese Business NPC Graphic */}
              <svg viewBox="0 0 120 120" className="w-full h-full object-cover">
                <defs>
                  <linearGradient id="suitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="tieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#991b1b" />
                  </linearGradient>
                  <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fed7aa" />
                    <stop offset="100%" stopColor="#fcd34d" />
                  </linearGradient>
                </defs>
                {/* Background Shadow */}
                <circle cx="60" cy="60" r="58" fill="#1e293b" />
                {/* Shoulders & Business Suit */}
                <path d="M15 110 Q60 85 105 110 L105 120 L15 120 Z" fill="url(#suitGrad)" />
                {/* White Shirt Collar */}
                <polygon points="45,90 60,105 75,90 65,85 55,85" fill="#f8fafc" />
                {/* Red Tie */}
                <polygon points="57,92 63,92 65,115 60,118 55,115" fill="url(#tieGrad)" />
                {/* Head & Neck */}
                <rect x="52" y="72" width="16" height="18" rx="4" fill="url(#skinGrad)" />
                <circle cx="60" cy="52" r="26" fill="url(#skinGrad)" />
                {/* Hair */}
                <path d="M34 50 Q36 24 60 22 Q84 24 86 50 Q78 34 60 36 Q42 34 34 50 Z" fill="#1e1e24" />
                {/* Eyes */}
                {npcEmotion === 'happy' ? (
                  <>
                    <path d="M46 52 Q52 46 58 52" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M64 52 Q70 46 76 52" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle cx="51" cy="52" r="3.5" fill="#1e293b" />
                    <circle cx="69" cy="52" r="3.5" fill="#1e293b" />
                    <circle cx="52" cy="50" r="1.2" fill="#ffffff" />
                    <circle cx="70" cy="50" r="1.2" fill="#ffffff" />
                  </>
                )}
                {/* Eyebrows */}
                {npcEmotion === 'thinking' ? (
                  <>
                    <path d="M44 44 Q51 46 56 42" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M64 42 Q69 46 76 44" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M44 43 Q50 40 56 43" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M64 43 Q70 40 76 43" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </>
                )}
                {/* Mouth */}
                {npcEmotion === 'happy' ? (
                  <path d="M52 64 Q60 72 68 64" stroke="#be123c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                ) : npcEmotion === 'surprised' ? (
                  <ellipse cx="60" cy="65" rx="4" ry="5" fill="#be123c" />
                ) : (
                  <path d="M54 65 Q60 66 66 65" stroke="#be123c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                )}
                {/* Glasses for professional look */}
                <rect x="42" y="47" width="16" height="11" rx="3" fill="none" stroke="#64748b" strokeWidth="2" />
                <rect x="62" y="47" width="16" height="11" rx="3" fill="none" stroke="#64748b" strokeWidth="2" />
                <line x1="58" y1="52" x2="62" y2="52" stroke="#64748b" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* NPC Name Badge */}
          <div className="mt-2 text-center">
            <h3 className="text-white font-semibold text-sm sm:text-base tracking-wide flex items-center justify-center gap-1.5 drop-shadow">
              <span>{npcName}</span>
            </h3>
            <p className="text-amber-400/90 text-xs font-medium tracking-wide">
              {npcTitle}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Stage Bottom Floor Shadow */}
      <div className="relative z-10 w-full flex justify-center">
        <div className="w-2/3 h-1.5 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent blur-sm rounded-full" />
      </div>
    </div>
  )
}
export default NpcStage
