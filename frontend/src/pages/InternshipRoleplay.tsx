import { useTranslation } from 'react-i18next'
import { confirmDialog } from '../features/dialogs/queue'
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import {
  Briefcase,
  Building,
  GraduationCap,
  Sparkles,
  BookOpen,
  Laptop,
  Utensils,
  HeartHandshake,
  HardHat,
  Factory,
  ChevronRight,
  Lock,
  CheckCircle2,
  Play,
  History,
  MessageSquare,
  Eye,
  FileText,
  Zap,
} from 'lucide-react'

import {
  internshipAPI,
  type IndustryInfo,
  type InternshipSession,
  type ParsedCVProfile,
} from '../services/api'
import InterviewRoom3D, { type EtiquetteStage } from '../components/internship/InterviewRoom3D'
import { eventBridge } from '../components/internship/3d/EventBridge'
import DialogueBox from '../components/internship/DialogueBox'
import PlayerControl from '../components/internship/PlayerControl'
import FeedbackBubble from '../components/internship/FeedbackBubble'
import MangaSpeechBubble from '../components/internship/MangaSpeechBubble'
import OfferLetterModal from '../components/internship/OfferLetterModal'
import HandbookModal from '../components/internship/HandbookModal'
import CVUploadModal from '../components/internship/CVUploadModal'
import LoadingSpinner from '../components/LoadingSpinner'

// Icon mapper for industry cards
const iconMap: Record<string, React.ElementType> = {
  Laptop,
  Utensils,
  HeartHandshake,
  HardHat,
  Factory,
  Briefcase,
}

export default function InternshipRoleplay() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  // State
  const [activeTab, setActiveTab] = useState<'interview' | 'workplace' | 'history'>('interview')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('it')
  const [currentSession, setCurrentSession] = useState<InternshipSession | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showHandbook, setShowHandbook] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showCVModal, setShowCVModal] = useState(false)
  const [showMangaBubble, setShowMangaBubble] = useState(true)
  const [isDialogueCollapsed, setIsDialogueCollapsed] = useState(false)
  const [isFeedbackDismissed, setIsFeedbackDismissed] = useState(false)
  const [distToBoss, setDistToBoss] = useState(2.75)
  const [canTalkToBoss, setCanTalkToBoss] = useState(true)
  const [etiquetteStage, setEtiquetteStage] = useState<EtiquetteStage>('dress_check')

  // Fetch Profile
  const { data: profile, isLoading: isProfileLoading } = useQuery(
    ['internshipProfile'],
    () => internshipAPI.getProfile().then((res) => res.data),
    { refetchOnWindowFocus: false }
  )

  // Fetch Industries
  const { data: industries, isLoading: isIndustriesLoading } = useQuery(
    ['internshipIndustries'],
    () => internshipAPI.getIndustries().then((res) => res.data),
    { refetchOnWindowFocus: false }
  )

  // Fetch Handbook
  const { data: handbook = [] } = useQuery(
    ['internshipHandbook'],
    () => internshipAPI.getHandbook().then((res) => res.data),
    { refetchOnWindowFocus: false }
  )

  // Fetch History Sessions
  const { data: pastSessionsData } = useQuery(
    ['internshipPastSessions'],
    () => internshipAPI.listSessions(10, 0).then((res) => res.data),
    { enabled: activeTab === 'history', refetchOnWindowFocus: false }
  )

  // Set default selected industry once loaded
  useEffect(() => {
    if (profile?.current_industry) {
      setSelectedIndustry(profile.current_industry)
    }
  }, [profile])

  // Start Interview Mutation
  const startInterviewMutation = useMutation(
    ({ industryId }: { industryId: string }) => internshipAPI.startInterview(industryId, 1),
    {
      onSuccess: (res) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
        setCurrentSession(res.data)
        setEtiquetteStage('dress_check')
        toast.success('Đã vào phòng phỏng vấn! Hãy chuẩn bị trang phục và gõ cửa.')
      },
      onError: () => {
        toast.error('Không thể bắt đầu phỏng vấn. Vui lòng thử lại.')
      },
    }
  )

  // Start Technical Interview with CV Mutation (AI + RAG)
  const startInterviewWithCVMutation = useMutation(
    ({
      industryId,
      cvText,
      parsedCv,
    }: {
      industryId: string
      cvText: string
      parsedCv?: ParsedCVProfile
    }) => internshipAPI.startInterviewWithCV(industryId, cvText, parsedCv),
    {
      onSuccess: (res) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
        setShowCVModal(false)
        setCurrentSession(res.data)
        setEtiquetteStage('dress_check')
        toast.success('Đã tạo 4 câu hỏi kỹ thuật theo CV & tải phòng phỏng vấn!')
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.detail || 'Không thể bắt đầu phỏng vấn kỹ thuật theo CV.')
      },
    }
  )

  // Start Workplace Scenario Mutation
  const startWorkplaceMutation = useMutation(
    ({ industryId, scenarioId }: { industryId: string; scenarioId: string }) =>
      internshipAPI.startWorkplace(industryId, scenarioId),
    {
      onSuccess: (res) => {
        setCurrentSession(res.data)
        toast.success('Bắt đầu tình huống công sở!')
      },
      onError: () => {
        toast.error('Không thể bắt đầu tình huống công sở.')
      },
    }
  )

  // Submit Answer Turn Mutation
  const handleAnswerTurn = async (userText: string) => {
    if (!currentSession) return
    setIsAnswering(true)
    try {
      const res = await internshipAPI.submitTurnAnswer(currentSession.id, userText)
      const updated = res.data
      setCurrentSession(updated)
      setIsFeedbackDismissed(false)

      // If finished and has offer letter
      if (updated.status === 'completed' && updated.offer_letter) {
        if (updated.session_type === 'interview') {
          // Do not pop modal immediately: allow the candidate to perform the authentic Japanese exit protocol
          toast.success('Phỏng vấn hoàn tất! Hãy đứng dậy thực hiện nghi thức chào cảm ơn khi ra về.')
        } else {
          setShowOfferModal(true)
        }
        queryClient.invalidateQueries(['internshipProfile'])
        queryClient.invalidateQueries(['rewardsMe'])
      } else if (updated.status === 'completed') {
        toast.success('Chúc mừng! Bạn đã hoàn thành tình huống công sở xuất sắc!')
        queryClient.invalidateQueries(['internshipProfile'])
        queryClient.invalidateQueries(['rewardsMe'])
      }
    } catch (err: any) {
      toast.error('Có lỗi khi xử lý câu trả lời.')
    } finally {
      setIsAnswering(false)
    }
  }

  const selectedIndustryData: IndustryInfo | undefined = industries?.[selectedIndustry]
  const currentTurnData = currentSession?.turns?.[currentSession.current_turn - 1]
  const previousTurnData =
    currentSession && currentSession.current_turn > 1
      ? currentSession.turns[currentSession.current_turn - 2]
      : null

  const handleDistanceChange = useCallback((dist: number, canTalk: boolean) => {
    setDistToBoss(dist)
    setCanTalkToBoss(canTalk)
  }, [])

  const handleEtiquetteStageChange = useCallback((stage: EtiquetteStage) => {
    setEtiquetteStage(stage)
  }, [])

  // Replay Boss Speech Audio via Web Speech API
  const handleReplayBossAudio = useCallback(() => {
    if (!currentTurnData?.message_ja || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setIsSpeaking(true)
    try {
      const utterance = new SpeechSynthesisUtterance(currentTurnData.message_ja)
      ;(window as any).__senpaiDialogueSpeech = utterance
      utterance.lang = 'ja-JP'
      utterance.rate = 0.92
      utterance.pitch = 1.0
      const voices = window.speechSynthesis.getVoices()
      const jaVoice = voices.find((v) => v.lang.startsWith('ja') || v.name.includes('Japanese'))
      if (jaVoice) utterance.voice = jaVoice
      utterance.onend = () => {
        setIsSpeaking(false)
        delete (window as any).__senpaiDialogueSpeech
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        delete (window as any).__senpaiDialogueSpeech
      }
      window.speechSynthesis.speak(utterance)
    } catch {
      setIsSpeaking(false)
    }
  }, [currentTurnData?.message_ja])

  // Auto-speak Japanese when boss asks question and show manga speech bubble ONLY when candidate has sat down in interview
  useEffect(() => {
    if (
      currentSession?.status === 'in_progress' &&
      currentTurnData?.message_ja &&
      (etiquetteStage === 'sitting_interview' || currentSession.session_type === 'workplace')
    ) {
      setShowMangaBubble(true)
      const timer = setTimeout(() => {
        handleReplayBossAudio()
      }, 550)
      return () => {
        clearTimeout(timer)
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
      }
    }
  }, [currentTurnData?.turn, currentTurnData?.message_ja, etiquetteStage, currentSession?.session_type, currentSession?.status, handleReplayBossAudio])

  if (isProfileLoading || isIndustriesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Active Simulation Stage View (Full Screen 3D Game)
  if (currentSession) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-slate-950 flex flex-col justify-between game-3d-hud text-white selection:bg-amber-500 selection:text-white">
        {/* 1. Full-Screen 3D Interactive Background Canvas */}
        <InterviewRoom3D
          npcName={currentTurnData?.npc_name || 'Người phỏng vấn'}
          npcTitle={currentTurnData?.npc_title || 'Đại diện công ty'}
          npcEmotion={currentTurnData?.npc_emotion || 'neutral'}
          companyName={currentSession.company_name}
          industryId={currentSession.industry || selectedIndustry || 'it'}
          isSpeaking={isSpeaking}
          sessionType={currentSession.session_type}
          currentTurn={currentSession.current_turn}
          maxTurns={currentSession.max_turns}
          sessionStatus={currentSession.status}
          isFullScreenMode={true}
          onDistanceChange={handleDistanceChange}
          onEtiquetteStageChange={handleEtiquetteStageChange}
          onViewOfferLetter={() => setShowOfferModal(true)}
          onExit={async () => {
            if (await confirmDialog(t('dialogs.exitInterview'), { tone: 'warning' })) {
              setCurrentSession(null)
            }
          }}
        />

        {/* 2. Top Right Floating Control (Sổ tay văn hóa) */}
        <div className="absolute top-16 right-4 sm:right-6 z-20 pointer-events-auto">
          <button
            onClick={() => setShowHandbook(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-md text-slate-300 hover:text-white text-xs shadow-md transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Sổ tay văn hóa</span>
          </button>
        </div>

        {/* 2b. Manga Speech Bubble over Boss in 3D (Typewriter Manga Effect) - ONLY visible when seated at interview table */}
        {currentTurnData?.message_ja &&
          (etiquetteStage === 'sitting_interview' || currentSession.session_type === 'workplace') && (
            <div className="absolute top-20 sm:top-24 right-4 sm:right-12 md:right-24 z-30 pointer-events-none">
            {showMangaBubble ? (
              <MangaSpeechBubble
                speakerName={currentTurnData.npc_name}
                speakerTitle={currentTurnData.npc_title}
                textJa={currentTurnData.message_ja}
                textVi={currentTurnData.message_vi}
                isSpeaking={isSpeaking}
                onReplayAudio={handleReplayBossAudio}
                onClose={() => setShowMangaBubble(false)}
              />
            ) : (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={() => {
                  setShowMangaBubble(true)
                  handleReplayBossAudio()
                }}
                className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs shadow-xl backdrop-blur-md transition-all active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>💬 Hiện đám mây thoại của Sếp</span>
              </motion.button>
            )}
          </div>
        )}

        {/* 3. Floating AI Evaluation Feedback (Draggable & Dismissible) */}
        {previousTurnData?.user_response && (
          <div className="absolute top-16 left-4 sm:left-8 z-40 pointer-events-none">
            {!isFeedbackDismissed ? (
              <FeedbackBubble
                userResponse={previousTurnData.user_response}
                correctedSentence={previousTurnData.feedback?.corrected_sentence}
                adviceVi={previousTurnData.feedback?.advice_vi}
                technicalAdviceVi={previousTurnData.feedback?.technical_advice_vi}
                scores={previousTurnData.scores}
                onClose={() => setIsFeedbackDismissed(true)}
              />
            ) : (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={() => setIsFeedbackDismissed(false)}
                className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs shadow-xl backdrop-blur-md transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Xem lại đánh giá</span>
                {previousTurnData.scores && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                    {Math.round(
                      (previousTurnData.scores.grammar +
                        previousTurnData.scores.keigo +
                        previousTurnData.scores.manner) /
                        3
                    )}
                    đ
                  </span>
                )}
              </motion.button>
            )}
          </div>
        )}

        {/* 4. Bottom Floating Console: Subtitle & Response Input */}
        {currentSession.session_type === 'interview' &&
        etiquetteStage !== 'sitting_interview' &&
        currentSession.status === 'in_progress' ? (
          <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-4 pointer-events-auto font-sans">
            <div className="p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse shrink-0" />
                <span className="font-normal truncate">
                  {etiquetteStage === 'dress_check' && 'Kiểm tra trang phục công sở Nhật Bản'}
                  {(etiquetteStage === 'outside_door' || etiquetteStage === 'knocking') && 'Đang đứng trước cửa: Gõ 3 tiếng & đợi mời'}
                  {etiquetteStage === 'door_opened' && 'Cửa đã mở! Tiến vào phòng và khép cửa'}
                  {etiquetteStage === 'standing_chair' && 'Đứng cạnh ghế: Cúi chào 30–45°'}
                  {etiquetteStage === 'waiting_sit' && 'Đợi nhà tuyển dụng mời ngồi'}
                  {(etiquetteStage === 'exit_standing' || etiquetteStage === 'exit_door') && 'Nghi thức chào cảm ơn khi ra về'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEtiquetteStage('sitting_interview')
                  eventBridge.emit('skip_to_interview')
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-600 transition-all shrink-0"
              >
                Vào bàn ngay
              </button>
            </div>
          </div>
        ) : (
          <div data-interview-console className="absolute bottom-3 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 px-3 space-y-1.5 pointer-events-auto font-sans">
            {/* Collapse / Expand Toggle Bar */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-400 text-[11px] font-mono">
                {canTalkToBoss
                  ? `Đang đàm thoại với ${currentTurnData?.npc_name || 'Người phỏng vấn'}`
                  : `Khoảng cách tới bàn: ${distToBoss.toFixed(1)}m`}
              </span>
              <button
                type="button"
                onClick={() => setIsDialogueCollapsed(!isDialogueCollapsed)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-all text-[11px]"
              >
                <Eye className="w-3 h-3 text-slate-400" />
                <span>{isDialogueCollapsed ? 'Mở phụ đề' : 'Ẩn bớt'}</span>
              </button>
            </div>

          {!isDialogueCollapsed ? (
            <>
              {/* Distance Warning banner if candidate stepped far away */}
              {!canTalkToBoss && (
                <div className="p-3 rounded-2xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xl backdrop-blur-md">
                  <span>
                    🚶 Bạn đang đứng cách sếp <strong>{distToBoss.toFixed(1)}m</strong>. Bạn có thể bước lại gần bàn hoặc dùng nút <strong>[Ngồi vào bàn phỏng vấn]</strong> góc trái màn hình!
                  </span>
                </div>
              )}

              {currentTurnData && (
                <div className="shadow-2xl">
                  <DialogueBox
                    docked
                    speakerName={currentTurnData.npc_name}
                    speakerTitle={currentTurnData.npc_title}
                    messageJa={currentTurnData.message_ja}
                    messageVi={currentTurnData.message_vi}
                    focus={currentTurnData.focus}
                    onSpeakingChange={setIsSpeaking}
                    onClose={() => setIsDialogueCollapsed(true)}
                  />
                </div>
              )}

              {currentSession.status === 'in_progress' ? (
                <div className="shadow-2xl">
                  <PlayerControl
                    onSubmit={handleAnswerTurn}
                    isLoading={isAnswering}
                    hints={currentTurnData?.hints || []}
                  />
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700 text-center space-y-4 shadow-2xl">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-xl font-bold text-white">
                    {currentSession.session_type === 'interview'
                      ? 'Đã hoàn thành buổi phỏng vấn 3D!'
                      : 'Đã hoàn thành tình huống công sở 3D!'}
                  </h3>
                  <p className="text-sm text-slate-300">
                    Tổng điểm năng lực của bạn đạt: {currentSession.overall_score} / 100 điểm.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    {currentSession.offer_letter && (
                      <button
                        type="button"
                        onClick={() => setShowOfferModal(true)}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:opacity-95 transition-all shadow-md text-sm"
                      >
                        Xem Thư trúng tuyển (内定通知書)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentSession(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors text-sm"
                    >
                      Tiếp tục nhiệm vụ mới
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setIsDialogueCollapsed(false)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-2xl hover:opacity-95 transition-all animate-bounce"
              >
                <MessageSquare className="w-4 h-4" />
                <span>💬 Mở hội thoại với {currentTurnData?.npc_name || 'Sếp'} (Nhấn để trả lời)</span>
              </button>
            </div>
          )}
        </div>
      )}

        {/* Offer Letter Modal */}
        <OfferLetterModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          offerLetter={currentSession.offer_letter || null}
          onStartWorkplace={() => {
            setCurrentSession(null)
            setActiveTab('workplace')
          }}
        />

        {/* Handbook Modal */}
        <HandbookModal
          isOpen={showHandbook}
          onClose={() => setShowHandbook(false)}
          handbook={handbook}
        />
      </div>
    )
  }

  // Calculate Level Progression
  const currentLevel = profile?.current_level || 1
  const expPoints = profile?.exp_points || 0
  const nextLevelExp = profile?.next_level_exp || 150
  const prevLevelExp = profile?.prev_level_exp || 0
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((expPoints - prevLevelExp) / (nextLevelExp - prevLevelExp)) * 100))
  )
  // Presentation hints from the reference design; never used to gate an industry
  // or change the interview level sent to the existing API.
  const industryJlptLabels: Record<string, string> = {
    it: 'N3+', hospitality: 'N4+', kaigo: 'N4+',
    engineering: 'N4+', manufacturing: 'N5+', business: 'N3+',
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 sm:space-y-8">
      {/* Hero & Employee ID Badge Banner */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-5 text-[color:var(--text)] shadow-lg backdrop-blur-lg sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 [background:var(--primary-gradient)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[color:var(--primary)] opacity-10 blur-3xl" />

        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
          <div className="min-w-0 max-w-2xl space-y-4">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--accent)] px-3 py-1.5 text-[11px] font-semibold leading-relaxed tracking-wide text-[color:var(--primary)] sm:text-xs">
              <Sparkles className="h-4 w-4 shrink-0" />
              Chế độ mô phỏng doanh nghiệp Nhật Bản
            </span>
            <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl sm:leading-tight">
              Nhập vai thực tập sinh Nhật Bản
            </h1>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
              Trải nghiệm phỏng vấn tuyển dụng với AI NPC và thực hành xử lý tình huống công sở
              thực tế từ Cấp 1 (N5) đến Cấp 5 (N1).
            </p>
          </div>

          {/* Interactive Employee ID Card */}
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)] text-lg font-bold text-[color:var(--primary-contrast)] shadow-sm">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-base font-bold text-[color:var(--text)]">
                  {profile?.username || 'Học viên'}
                </h3>
                <span className="text-sm font-medium text-[color:var(--primary)]">
                  {profile?.job_title || 'Thực tập sinh mới'}
                </span>
              </div>
            </div>

            {/* Level & EXP Bar */}
            <div className="space-y-3 border-t border-[color:var(--border)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[color:var(--text-muted)]">Cấp bậc: Cấp {currentLevel}</span>
                <span className="font-semibold text-[color:var(--primary)]">
                  {expPoints} / {nextLevelExp} EXP
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--accent)]">
                <div
                  className="h-full rounded-full transition-all duration-500 [background:var(--primary-gradient)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Manners & Keigo Stats */}
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="space-y-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3">
                <span className="block leading-5 text-[color:var(--text-muted)]">Điểm Kính ngữ</span>
                <span className="block text-lg font-bold text-[color:var(--primary)]">{profile?.keigo_score_avg || 0}</span>
              </div>
              <div className="space-y-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3">
                <span className="block leading-5 text-[color:var(--text-muted)]">Điểm Tác phong</span>
                <span className="block text-lg font-bold text-[color:var(--primary)]">{profile?.manner_score_avg || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Guide Pill */}
        <div className="relative z-10 mt-6 flex flex-col gap-4 border-t border-[color:var(--border)] pt-5 text-sm sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2 text-[color:var(--text-muted)]">
            <Building className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
            <span className="break-words">Công ty tiếp nhận: <strong className="font-semibold text-[color:var(--text)]">{profile?.company_name}</strong></span>
          </div>

          <button
            onClick={() => setShowHandbook(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] px-4 py-2.5 text-xs font-semibold text-[color:var(--primary)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--card)] sm:self-auto"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Mở sổ tay văn hóa công sở</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-2 shadow-sm backdrop-blur-md [&>button]:min-h-[44px] [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-[color:var(--primary)]">
        <button
          onClick={() => setActiveTab('interview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'interview'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-md'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--accent)]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>1. Phỏng vấn đầu vào</span>
        </button>

        <button
          onClick={() => setActiveTab('workplace')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'workplace'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-md'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--accent)]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>2. Tình huống công sở (Cấp 1 - 5)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-md'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--accent)]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>3. Lịch sử & Báo cáo</span>
        </button>
      </div>

      {/* TAB 1: PHỎNG VẤN ĐẦU VÀO */}
      {activeTab === 'interview' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-5 shadow-sm backdrop-blur-md sm:p-6">
            <div>
              <h2 className="text-xl font-bold text-[color:var(--text)]">
                Chọn ngành nghề & phỏng vấn xin việc
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                Vào phòng phỏng vấn 2.5D với nhà tuyển dụng NPC Nhật Bản. Trả lời tốt để nhận Thư trúng tuyển (内定通知書).
              </p>
            </div>
          </div>

          {/* 6 Industry Selection Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {industries &&
              Object.values(industries).map((ind) => {
                const IconComponent = iconMap[ind.icon] || Briefcase
                const isSelected = selectedIndustry === ind.id

                return (
                  <motion.button
                    type="button"
                    aria-pressed={isSelected}
                    key={ind.id}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`flex h-full min-w-0 cursor-pointer flex-col gap-4 rounded-3xl border-2 p-5 text-left text-[color:var(--text)] backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--card)] sm:p-6 ${
                      isSelected
                        ? '!-translate-y-0.5 border-[color:var(--primary)] bg-[color:var(--card)] shadow-sm'
                        : 'border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_90%,transparent)] shadow-sm hover:border-[color:var(--primary)] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[color:var(--primary)]">
                          <IconComponent className="w-6 h-6" />
                        </div>
                      <div className="flex min-w-0 flex-col items-end gap-2">
                        <span title="Trình độ gợi ý, không phải điều kiện mở khóa ngành." className={`rounded-full border px-3 py-1 text-xs font-bold leading-4 ${isSelected ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'border-[color:var(--border)] bg-[color:var(--accent)] text-[color:var(--primary)]'}`}>
                          JLPT {industryJlptLabels[ind.id] || 'N5–N1'}
                        </span>
                        {profile?.interview_passed && profile.current_industry === ind.id && (
                          <span className="flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--primary)]">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            Đã trúng tuyển
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold leading-7 text-[color:var(--text)]">
                          {ind.name}
                        </h3>
                        <p className="text-xs font-semibold leading-5 text-[color:var(--primary)]">
                          {ind.name_ja}
                        </p>
                      </div>

                      <p className="line-clamp-2 min-h-[3rem] text-sm leading-6 text-[color:var(--text-muted)]">
                        {ind.company_desc}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4 text-xs leading-5">
                      <span title={ind.company_name} className="min-w-0 flex-1 truncate font-medium text-[color:var(--text-muted)]">{ind.company_name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[color:var(--primary)]">
                        {isSelected ? 'Đang chọn' : 'Chọn ngành'} <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </motion.button>
                )
              })}
          </div>

          {/* Selected Industry Detail & Launch Interview Button */}
          {selectedIndustryData && (
            <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_98%,transparent)] p-5 shadow-lg backdrop-blur-lg sm:p-7 space-y-6">
              {/* RAG CV Technical Interview Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-[color:var(--text)]">
                        Phỏng vấn Kỹ thuật Chuyên sâu theo CV (AI + RAG)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Đột phá mới
                      </span>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] mt-1 max-w-xl">
                      Hệ thống tự động bóc tách CV, lập chỉ mục Vector DB và sinh 4 câu hỏi kỹ thuật xoay quanh đúng các dự án và tech stack trong CV của bạn.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCVModal(true)}
                  className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg hover:opacity-90 transition-all cursor-pointer active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Nộp CV &amp; Tạo câu hỏi theo CV</span>
                </button>
              </div>

              <div className="flex flex-col justify-between gap-6 pb-2 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center sm:gap-5">
                  <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-[color:var(--primary-contrast)] shadow-md [background:var(--primary-gradient)] sm:h-[4.5rem] sm:w-[4.5rem]">
                    {selectedIndustryData.interviewer.name.trim().slice(0, 1)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold leading-4 text-[color:var(--primary)]"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />Phòng phỏng vấn sẵn sàng</span>
                      <span title="Trình độ gợi ý, không phải điều kiện bắt đầu phỏng vấn." className="rounded-lg bg-[color:var(--bg-elevated)] px-2.5 py-1 text-xs font-bold leading-4 text-[color:var(--text-muted)]">JLPT {industryJlptLabels[selectedIndustryData.id] || 'N5–N1'}</span>
                    </div>
                    <h3 className="break-words text-lg font-bold leading-7 text-[color:var(--text)] sm:text-xl">
                      Phỏng vấn tại: {selectedIndustryData.company_name}
                    </h3>
                    <p className="text-sm leading-6 text-[color:var(--text-muted)]">
                      Người phỏng vấn: <strong className="font-semibold text-[color:var(--text)]">{selectedIndustryData.interviewer.name}</strong> ({selectedIndustryData.interviewer.title})
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--text-muted)]">
                      Phong cách: {selectedIndustryData.interviewer.personality}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCVModal(true)}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20 px-5 py-3 text-xs sm:text-sm font-bold text-amber-300 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Phỏng vấn theo CV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startInterviewMutation.mutate({ industryId: selectedIndustryData.id })
                    }
                    disabled={startInterviewMutation.isLoading}
                    className="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs sm:text-sm font-bold text-[color:var(--primary-contrast)] shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_22%,transparent)] transition-opacity [background:var(--primary-gradient)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {startInterviewMutation.isLoading ? 'Đang vào phòng...' : 'Phỏng vấn thông thường'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="border-t border-[color:var(--border)] pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--text-muted)] sm:text-sm">Cấu trúc 4 vòng phỏng vấn đánh giá</h4>
                  <span className="text-xs font-medium text-[color:var(--text-muted)]">Thời gian dự kiến: ~5 phút</span>
                </div>
                <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <li className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
                    <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-[color:var(--primary-contrast)]">1</span><span className="text-xs font-semibold leading-5 text-[color:var(--primary)]">Vòng 1: 自己紹介</span></div>
                    <h5 className="text-sm font-bold leading-5 text-[color:var(--text)]">Giới thiệu bản thân</h5>
                    <p className="text-sm leading-5 text-[color:var(--text-muted)]">Chào hỏi lễ phép, nêu kinh nghiệm học tập và chuyên môn.</p>
                  </li>
                  <li className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
                    <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-[color:var(--primary-contrast)]">2</span><span className="text-xs font-semibold leading-5 text-[color:var(--primary)]">Vòng 2: 志望動機</span></div>
                    <h5 className="text-sm font-bold leading-5 text-[color:var(--text)]">Lý do ứng tuyển</h5>
                    <p className="text-sm leading-5 text-[color:var(--text-muted)]">Động lực làm việc tại Nhật và lý do chọn công ty.</p>
                  </li>
                  <li className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
                    <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-[color:var(--primary-contrast)]">3</span><span className="text-xs font-semibold leading-5 text-[color:var(--primary)]">Vòng 3: 能力・Ho-Ren-So</span></div>
                    <h5 className="text-sm font-bold leading-5 text-[color:var(--text)]">Hỏi đáp năng lực</h5>
                    <p className="text-sm leading-5 text-[color:var(--text-muted)]">Tình huống giả định, xử lý sự cố trong công việc.</p>
                  </li>
                  <li className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
                    <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-[color:var(--primary-contrast)]">4</span><span className="text-xs font-semibold leading-5 text-[color:var(--primary)]">Vòng 4: 逆質問</span></div>
                    <h5 className="text-sm font-bold leading-5 text-[color:var(--text)]">Câu hỏi ngược</h5>
                    <p className="text-sm leading-5 text-[color:var(--text-muted)]">Đặt câu hỏi cho người tuyển dụng, thể hiện sự chủ động.</p>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TÌNH HUỐNG CÔNG SỞ CẤP 1 - 5 */}
      {activeTab === 'workplace' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-5 shadow-sm backdrop-blur-md sm:p-6">
            <div>
              <h2 className="text-xl font-bold text-[color:var(--text)]">
                Lộ trình tình huống công sở (Cấp 1 - 5)
              </h2>
              <p className="text-xs sm:text-sm text-[color:var(--text-muted)] mt-1">
                Áp dụng kiến thức bài học vào thực tế công việc hàng ngày tại doanh nghiệp Nhật Bản.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {selectedIndustryData?.scenarios?.map((scenario) => {
              const isLocked = scenario.level > currentLevel
              const isRecommended = scenario.level === currentLevel

              return (
                <div
                  key={scenario.id}
                  className={`p-5 sm:p-6 rounded-2xl border shadow-sm backdrop-blur-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isLocked
                      ? 'border-[color:var(--border)] bg-[color:var(--card)]'
                      : isRecommended
                      ? 'border-[color:var(--primary)] bg-[color:var(--card)] shadow-md'
                      : 'border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)]'
                  }`}
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                          isLocked
                            ? 'bg-[color:var(--accent)] text-[color:var(--text-muted)]'
                            : 'bg-[color:var(--accent)] text-[color:var(--primary)]'
                        }`}
                      >
                        {scenario.level_name}
                      </span>
                      {isRecommended && (
                        <span className="text-[11px] font-bold text-[color:var(--primary)] flex items-center gap-1">
                          ★ Khuyên học cho cấp bậc hiện tại
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-[color:var(--text)]">
                      {scenario.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[color:var(--text-muted)] leading-relaxed">
                      <strong>Mục tiêu: </strong>
                      {scenario.goal}
                    </p>

                    <p className="text-xs text-[color:var(--text-muted)]">
                      Nhân vật hỗ trợ: <strong>{scenario.npc_name}</strong> ({scenario.npc_title})
                    </p>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    {isLocked ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--accent)] text-[color:var(--text-muted)] text-xs font-semibold">
                        <Lock className="w-4 h-4" />
                        <span>Mở khóa ở Cấp {scenario.level}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          startWorkplaceMutation.mutate({
                            industryId: selectedIndustryData.id,
                            scenarioId: scenario.id,
                          })
                        }
                        disabled={startWorkplaceMutation.isLoading}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-contrast)] font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Vào tình huống</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ PHỎNG VẤN & BÁO CÁO */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-5 shadow-sm backdrop-blur-md sm:p-6">
            <div>
              <h2 className="text-xl font-bold text-[color:var(--text)]">
                Lịch sử rèn luyện & Hồ sơ ứng tuyển
              </h2>
              <p className="text-xs sm:text-sm text-[color:var(--text-muted)] mt-1">
                Theo dõi quá trình tiến bộ qua các buổi phỏng vấn và tình huống thực tế.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pastSessionsData?.items && pastSessionsData.items.length > 0 ? (
              pastSessionsData.items.map((session: any) => (
                <div
                  key={session.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_95%,transparent)] p-5 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:p-6"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-[color:var(--accent)] text-[color:var(--primary)]">
                        {session.session_type === 'interview' ? 'Phỏng vấn' : 'Tình huống'}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {session.created_at?.slice(0, 10)}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm sm:text-base text-[color:var(--text)]">
                      Ngành: {session.industry?.toUpperCase()} - Cấp {session.level}
                    </h4>
                    <p className="text-xs text-[color:var(--text-muted)]">
                      Trạng thái: <strong>{session.status === 'completed' ? 'Hoàn thành' : 'Đang dở'}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-[color:var(--primary)] block">
                      {session.overall_score} / 100
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)]">Tổng điểm</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-sm">
                Bạn chưa có phiên làm việc nào. Hãy bắt đầu buổi phỏng vấn đầu tiên ngay nhé!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Handbook Modal */}
      <HandbookModal
        isOpen={showHandbook}
        onClose={() => setShowHandbook(false)}
        handbook={handbook}
      />

      {/* CV Upload & RAG Technical Interview Modal */}
      <CVUploadModal
        isOpen={showCVModal}
        onClose={() => setShowCVModal(false)}
        onStartInterview={(cvText, parsedCv) =>
          startInterviewWithCVMutation.mutate({
            industryId: selectedIndustryData?.id || 'it',
            cvText,
            parsedCv,
          })
        }
        isStarting={startInterviewWithCVMutation.isLoading}
      />
    </div>
  )
}
