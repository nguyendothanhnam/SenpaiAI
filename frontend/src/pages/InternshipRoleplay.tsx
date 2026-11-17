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
} from 'lucide-react'

import {
  internshipAPI,
  type IndustryInfo,
  type InternshipSession,
} from '../services/api'
import InterviewRoom3D, { type EtiquetteStage } from '../components/internship/InterviewRoom3D'
import { eventBridge } from '../components/internship/3d/EventBridge'
import DialogueBox from '../components/internship/DialogueBox'
import PlayerControl from '../components/internship/PlayerControl'
import FeedbackBubble from '../components/internship/FeedbackBubble'
import MangaSpeechBubble from '../components/internship/MangaSpeechBubble'
import OfferLetterModal from '../components/internship/OfferLetterModal'
import HandbookModal from '../components/internship/HandbookModal'
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
  const queryClient = useQueryClient()

  // State
  const [activeTab, setActiveTab] = useState<'interview' | 'workplace' | 'history'>('interview')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('it')
  const [currentSession, setCurrentSession] = useState<InternshipSession | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showHandbook, setShowHandbook] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [isDialogueCollapsed, setIsDialogueCollapsed] = useState(false)
  const [isFeedbackDismissed, setIsFeedbackDismissed] = useState(false)
  const [showMangaBubble, setShowMangaBubble] = useState(true)
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
        setCurrentSession(res.data)
        setEtiquetteStage('dress_check')
        toast.success('Đã vào phòng phỏng vấn! Hãy chuẩn bị trang phục và gõ cửa.')
      },
      onError: () => {
        toast.error('Không thể bắt đầu phỏng vấn. Vui lòng thử lại.')
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

  if (isProfileLoading || isIndustriesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
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

  // Auto-speak Japanese when boss asks question and trigger manga bubble
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
  }, [currentTurnData?.turn, etiquetteStage, currentSession?.session_type, currentSession?.status, handleReplayBossAudio])

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
          onExit={() => {
            if (window.confirm('Bạn có chắc muốn tạm dừng phiên làm việc 3D này không?')) {
              setCurrentSession(null)
            }
          }}
        />

        {/* 2. Top Right Floating Control (Sổ tay văn hóa) */}
        <div className="absolute top-16 right-4 sm:right-6 z-20 pointer-events-auto">
          <button
            onClick={() => setShowHandbook(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-slate-900/85 backdrop-blur-md text-amber-300 text-xs font-bold hover:bg-slate-800 shadow-xl transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Sổ tay văn hóa</span>
          </button>
        </div>

        {/* 2b. Manga Speech Bubble over Boss in 3D (Typewriter Manga Effect) */}
        {currentTurnData &&
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
                  className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-slate-950 border-2 border-slate-900 font-black text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-100 transition-all active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  <span>💬 Hiện đám mây Manga của Sếp</span>
                </motion.button>
              )}
            </div>
          )}

        {/* 3. Floating AI Evaluation Feedback (Draggable & Dismissible) */}
        {previousTurnData?.user_response && (
          <div className="absolute top-20 left-4 sm:left-8 z-40 pointer-events-none">
            {!isFeedbackDismissed ? (
              <FeedbackBubble
                userResponse={previousTurnData.user_response}
                correctedSentence={previousTurnData.feedback?.corrected_sentence}
                adviceVi={previousTurnData.feedback?.advice_vi}
                scores={previousTurnData.scores}
                onClose={() => setIsFeedbackDismissed(true)}
              />
            ) : (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                type="button"
                onClick={() => setIsFeedbackDismissed(false)}
                className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-2xl backdrop-blur-md transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Xem lại đánh giá</span>
                {previousTurnData.scores && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-[10px] text-amber-300">
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

        {/* 4. Bottom Floating Console: Etiquette Guidance Banner or Full Dialogue Console */}
        {currentSession.session_type === 'interview' &&
        etiquetteStage !== 'sitting_interview' &&
        currentSession.status === 'in_progress' ? (
          <div className="relative z-20 w-full max-w-xl mx-auto px-4 pb-4 sm:pb-6 pointer-events-auto">
            <div className="p-3.5 rounded-3xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 shadow-2xl flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-medium">
                  {etiquetteStage === 'dress_check' && 'Đang chuẩn bị trang phục phỏng vấn công sở Nhật Bản...'}
                  {(etiquetteStage === 'outside_door' || etiquetteStage === 'knocking') && 'Đang đứng trước cửa: Gõ 3 tiếng & đợi mời...'}
                  {etiquetteStage === 'door_opened' && 'Cửa đã mở! Tiến vào phòng và khép cửa nhẹ nhàng...'}
                  {etiquetteStage === 'standing_chair' && 'Đứng cạnh ghế: Cúi chào 30–45° và nói 失礼いたします...'}
                  {etiquetteStage === 'waiting_sit' && 'Đợi nhà tuyển dụng mời ngồi...'}
                  {(etiquetteStage === 'exit_standing' || etiquetteStage === 'exit_door') && 'Đang thực hiện nghi thức chào cảm ơn khi ra về...'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEtiquetteStage('sitting_interview')
                  eventBridge.emit('skip_to_interview')
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] border border-amber-500/30 transition-all shrink-0 active:scale-95"
              >
                Vào bàn phỏng vấn ngay ⏩
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-20 w-full max-w-4xl mx-auto px-4 pb-4 sm:pb-6 space-y-2 pointer-events-auto">
            {/* Collapse / Expand Toggle Bar */}
            <div className="flex items-center justify-between text-xs px-2">
              <span className="flex items-center gap-1.5 font-bold text-amber-400 drop-shadow">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {canTalkToBoss
                    ? `Đang đàm thoại trực tiếp với ${currentTurnData?.npc_name || 'Sếp'}`
                    : `Khoảng cách tới Sếp: ${distToBoss.toFixed(1)}m (Bước lại gần bàn)`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsDialogueCollapsed(!isDialogueCollapsed)}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all text-[11px] font-semibold shadow-md"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDialogueCollapsed ? '💬 Mở rộng hội thoại' : '− Thu gọn để ngắm phòng'}</span>
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Hero & Employee ID Badge Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Chế độ mô phỏng doanh nghiệp Nhật Bản
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Nhập vai thực tập sinh Nhật Bản
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Trải nghiệm phỏng vấn tuyển dụng với AI NPC và thực hành xử lý tình huống công sở
              thực tế từ Cấp 1 (N5) đến Cấp 5 (N1).
            </p>
          </div>

          {/* Interactive Employee ID Card */}
          <div className="w-full md:w-auto p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl flex flex-col gap-3 min-w-[280px]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-md">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {profile?.username || 'Học viên'}
                </h3>
                <span className="text-xs text-amber-400 font-medium">
                  {profile?.job_title || 'Thực tập sinh mới'}
                </span>
              </div>
            </div>

            {/* Level & EXP Bar */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Cấp bậc: Cấp {currentLevel}</span>
                <span className="font-semibold text-amber-300">
                  {expPoints} / {nextLevelExp} EXP
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Manners & Keigo Stats */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[10px]">Điểm Kính ngữ</span>
                <span className="font-bold text-purple-300">{profile?.keigo_score_avg || 0}</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[10px]">Điểm Tác phong</span>
                <span className="font-bold text-amber-300">{profile?.manner_score_avg || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Guide Pill */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Building className="w-4 h-4 text-amber-400" />
            <span>Công ty tiếp nhận: <strong>{profile?.company_name}</strong></span>
          </div>

          <button
            onClick={() => setShowHandbook(true)}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Mở sổ tay văn hóa công sở</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] pb-2 overflow-x-auto">
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[color:var(--text)]">
                Chọn ngành nghề & phỏng vấn xin việc
              </h2>
              <p className="text-xs sm:text-sm text-[color:var(--text-muted)] mt-1">
                Vào phòng phỏng vấn 2.5D với nhà tuyển dụng NPC Nhật Bản. Trả lời tốt để nhận Thư trúng tuyển (内定通知書).
              </p>
            </div>
          </div>

          {/* 6 Industry Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {industries &&
              Object.values(industries).map((ind) => {
                const IconComponent = iconMap[ind.icon] || Briefcase
                const isSelected = selectedIndustry === ind.id

                return (
                  <motion.div
                    key={ind.id}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/20 bg-[color:var(--accent)]/30'
                        : 'border-[color:var(--border)] bg-[color:var(--bg-card)] hover:border-[color:var(--primary)]/50'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]'
                              : 'bg-[color:var(--accent)] text-[color:var(--primary)]'
                          }`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>

                        {profile?.interview_passed && profile.current_industry === ind.id && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã trúng tuyển
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-[color:var(--text)]">
                          {ind.name}
                        </h3>
                        <p className="text-xs text-[color:var(--primary)] font-medium">
                          {ind.name_ja}
                        </p>
                      </div>

                      <p className="text-xs text-[color:var(--text-muted)] line-clamp-2">
                        {ind.company_desc}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] text-xs flex items-center justify-between">
                      <span className="text-[color:var(--text-muted)]">{ind.company_name}</span>
                      <span className="font-semibold text-[color:var(--primary)] flex items-center gap-1">
                        Chọn ngành <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </motion.div>
                )
              })}
          </div>

          {/* Selected Industry Detail & Launch Interview Button */}
          {selectedIndustryData && (
            <div className="p-6 rounded-3xl bg-[color:var(--bg-card)] border border-[color:var(--border)] shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[color:var(--text)]">
                    Phỏng vấn tại: {selectedIndustryData.company_name}
                  </h3>
                  <p className="text-xs sm:text-sm text-[color:var(--text-muted)]">
                    Người phỏng vấn: <strong>{selectedIndustryData.interviewer.name}</strong> ({selectedIndustryData.interviewer.title})
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Phong cách: {selectedIndustryData.interviewer.personality}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    startInterviewMutation.mutate({ industryId: selectedIndustryData.id })
                  }
                  disabled={startInterviewMutation.isLoading}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:opacity-95 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {startInterviewMutation.isLoading ? 'Đang vào phòng...' : 'Vào phỏng vấn ngay'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2">
                <div className="p-3 rounded-xl bg-[color:var(--accent)]/30 border border-[color:var(--border)]">
                  <span className="font-bold text-[color:var(--text)] block mb-1">Vòng 1: 自己紹介</span>
                  <span className="text-[color:var(--text-muted)]">Giới thiệu bản thân lễ phép, chào hỏi mở đầu.</span>
                </div>
                <div className="p-3 rounded-xl bg-[color:var(--accent)]/30 border border-[color:var(--border)]">
                  <span className="font-bold text-[color:var(--text)] block mb-1">Vòng 2: 志望動機</span>
                  <span className="text-[color:var(--text-muted)]">Động lực ứng tuyển vào ngành & công ty.</span>
                </div>
                <div className="p-3 rounded-xl bg-[color:var(--accent)]/30 border border-[color:var(--border)]">
                  <span className="font-bold text-[color:var(--text)] block mb-1">Vòng 3: Ho-Ren-So</span>
                  <span className="text-[color:var(--text-muted)]">Tình huống giả định, xử lý sự cố công việc.</span>
                </div>
                <div className="p-3 rounded-xl bg-[color:var(--accent)]/30 border border-[color:var(--border)]">
                  <span className="font-bold text-[color:var(--text)] block mb-1">Vòng 4: 逆質問</span>
                  <span className="text-[color:var(--text-muted)]">Đặt câu hỏi ngược thể hiện sự chủ động.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TÌNH HUỐNG CÔNG SỞ CẤP 1 - 5 */}
      {activeTab === 'workplace' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
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
                  className={`p-5 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isLocked
                      ? 'border-[color:var(--border)] bg-[color:var(--bg-surface)] opacity-70'
                      : isRecommended
                      ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-[color:var(--bg-card)] to-[color:var(--bg-card)] shadow-md'
                      : 'border-[color:var(--border)] bg-[color:var(--bg-card)]'
                  }`}
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                          isLocked
                            ? 'bg-slate-500/20 text-slate-500'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {scenario.level_name}
                      </span>
                      {isRecommended && (
                        <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
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
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-500/10 text-slate-500 text-xs font-semibold">
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
          <div className="flex items-center justify-between">
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
                  className="p-4 sm:p-5 rounded-2xl bg-[color:var(--bg-card)] border border-[color:var(--border)] flex items-center justify-between gap-4"
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
                    <span className="text-lg font-black text-amber-500 block">
                      {session.overall_score} / 100
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)]">Tổng điểm</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] text-[color:var(--text-muted)] text-sm">
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
    </div>
  )
}
