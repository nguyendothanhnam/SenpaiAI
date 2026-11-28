import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  UserCheck,
  Footprints,
  X,
  Volume2,
  CheckCircle2,
  ShieldCheck,
  DoorOpen,
  User,
  RotateCcw,
  Sliders,
  FileText,
  Award,
  Building,
} from 'lucide-react'
import { SceneManager } from './3d/SceneManager'
import { eventBridge } from './3d/EventBridge'
import { etiquetteAudio } from './3d/EtiquetteAudio'
import { InterviewDocumentModal } from './InterviewDocumentModal'
import type { QualityLevel } from './3d/QualityManager'
import type { CameraView } from './3d/CameraRig'

export type EtiquetteStage =
  | 'dress_check' // Bước 1: Chuẩn bị trang phục chuẩn công sở Nhật Bản (Nam / Nữ)
  | 'outside_door' // Bước 2: Đứng trước cửa phòng phỏng vấn (Chờ gõ cửa 3 tiếng)
  | 'knocking' // Đang gõ 3 tiếng: Cộc! Cộc! Cộc! & Chờ sếp nói: "どうぞ、お入りください"
  | 'door_opened' // Cửa mở, bước vào phòng, khép cửa nhẹ nhàng
  | 'standing_chair' // Bước 3: Đứng cạnh ghế, cúi chào 30-45° & Nói: "失礼いたします"
  | 'waiting_sit' // Đang chờ sếp mời ngồi: "どうぞ、お掛けください"
  | 'sitting_interview' // Bước 4: Ứng viên đáp "失礼いたします", ngồi thẳng lưng, đàm thoại phỏng vấn
  | 'exit_standing' // Bước 5: Phỏng vấn xong! Đứng dậy, cúi đầu cảm ơn: "本日は誠にありがとうございました"
  | 'exit_door' // Bước 6: Bước ra cửa, quay người lại cúi chào lần cuối: "失礼いたします", khép cửa
  | 'etiquette_mastered' // Hoàn thành xuất sắc nghi thức phỏng vấn (100% Điểm Tác Phong!)

export interface InterviewRoom3DProps {
  npcName: string
  npcTitle: string
  npcEmotion?: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'strict'
  companyName: string
  industryId?: string
  isSpeaking?: boolean
  sessionType: 'interview' | 'workplace'
  currentTurn: number
  maxTurns: number
  sessionStatus?: 'in_progress' | 'completed' | 'failed'
  isFullScreenMode?: boolean
  onToggleNativeFullscreen?: () => void
  onExit?: () => void
  onDistanceChange?: (dist: number, canTalk: boolean) => void
  onSitDownRequest?: () => void
  onEtiquetteStageChange?: (stage: EtiquetteStage) => void
  onViewOfferLetter?: () => void
}

export const InterviewRoom3D: React.FC<InterviewRoom3DProps> = ({
  npcName,
  npcTitle,
  npcEmotion = 'neutral',
  companyName,
  industryId = 'it',
  isSpeaking = false,
  sessionType,
  currentTurn,
  maxTurns,
  sessionStatus = 'in_progress',
  isFullScreenMode: _isFullScreenMode = true,
  onToggleNativeFullscreen,
  onExit,
  onDistanceChange,
  onSitDownRequest,
  onEtiquetteStageChange,
  onViewOfferLetter,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)
  // Scene identity belongs to this mounted session, not to transient speech/HUD updates.
  const initialSceneRef = useRef({ npcName, npcTitle, companyName, industryId, currentTurn })

  // 3D View & Stance
  const [viewMode, setViewMode] = useState<CameraView>('pov')
  const [stance, setStance] = useState<'sitting' | 'standing'>('sitting')
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>('medium')
  const [hasWebGLError, setHasWebGLError] = useState<boolean>(false)
  const [isNativeFs, setIsNativeFs] = useState(false)

  // Executive Minimalist HUD States
  const [isUiHidden, setIsUiHidden] = useState<boolean>(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false)
  const [showEtiquetteMenu, setShowEtiquetteMenu] = useState<boolean>(false)
  const [showDocModal, setShowDocModal] = useState<boolean>(false)

  // Japanese Etiquette Protocol State - Always starts with dress_check so user experiences all steps before and after
  const [etiquetteStage, setEtiquetteStage] = useState<EtiquetteStage>('dress_check')
  const [candidateGender, setCandidateGender] = useState<'male' | 'female'>('male')
  const [showEtiquetteCard, setShowEtiquetteCard] = useState<boolean>(true)
  const [isKnocking, setIsKnocking] = useState<boolean>(false)
  const [etiquetteStatusText, setEtiquetteStatusText] = useState<string>(
    'Hãy kiểm tra trang phục công sở Nhật Bản trước khi bước vào phòng phỏng vấn.'
  )
  const [etiquetteScore, setEtiquetteScore] = useState<number>(0)
  const [waitingForSitInvite, setWaitingForSitInvite] = useState<boolean>(false)
  const [canSitNow, setCanSitNow] = useState<boolean>(false)

  const onDistanceChangeRef = useRef(onDistanceChange)
  useEffect(() => {
    onDistanceChangeRef.current = onDistanceChange
  }, [onDistanceChange])

  const onSitDownRequestRef = useRef(onSitDownRequest)
  useEffect(() => {
    onSitDownRequestRef.current = onSitDownRequest
  }, [onSitDownRequest])

  // 4. View Switcher
  const handleViewChange = useCallback((mode: CameraView) => {
    setViewMode(mode)
    sceneManagerRef.current?.cameraRig.setView(mode)
    if (sceneManagerRef.current?.scene) {
      const cand = sceneManagerRef.current.scene.getObjectByName('Candidate_Avatar')
      if (cand) cand.visible = mode !== 'pov'
    }
    eventBridge.emit('camera_view_changed', { mode })
  }, [])

  // Step 6: Start Exit Protocol (After interview turns finish or when user chooses)
  const handleStartExitProtocol = useCallback(() => {
    setStance('standing')
    sceneManagerRef.current?.setCandidateStance('standing_chair')
    handleViewChange('candidate_standing')
    setEtiquetteStage('exit_standing')
    setShowEtiquetteCard(true)
    setEtiquetteStatusText(
      'Buổi phỏng vấn đã hoàn tất. Hãy đứng dậy cạnh ghế, cúi đầu cảm ơn sâu sắc: 「本日は誠にありがとうございました」.'
    )
    etiquetteAudio.speakJapanese('本日の面接は以上となります。結果は後日ご連絡いたします。お疲れ様でした。')
  }, [handleViewChange])

  // Notify parent & Scene Manager whenever etiquette stage changes
  useEffect(() => {
    if (onEtiquetteStageChange) {
      onEtiquetteStageChange(etiquetteStage)
    }
    if (sceneManagerRef.current && 'setEtiquetteStage' in sceneManagerRef.current) {
      ;(sceneManagerRef.current as any).setEtiquetteStage(etiquetteStage)
    }
  }, [etiquetteStage, onEtiquetteStageChange])

  // Auto-trigger exit protocol when session completes during sitting_interview
  useEffect(() => {
    if (
      sessionStatus === 'completed' &&
      etiquetteStage === 'sitting_interview'
    ) {
      // Small delay so the user can see the completion message first
      const timer = setTimeout(() => {
        handleStartExitProtocol()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [sessionStatus, etiquetteStage, handleStartExitProtocol])

  // 1. Initialize SceneManager on mount
  useEffect(() => {
    if (!mountRef.current) return
    const { npcName, npcTitle, companyName, industryId, currentTurn } = initialSceneRef.current

    // WebGL support check
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.warn('[InterviewRoom3D] WebGL not supported on this device. Activating 2.5D Fallback.')
      setHasWebGLError(true)
      return
    }

    try {
      const sceneManager = new SceneManager({
        container: mountRef.current,
        npcName: npcName || 'Người phỏng vấn',
        npcTitle: npcTitle || 'Đại diện công ty',
        companyName: companyName || '株式会社グローバル',
        industryId: industryId || 'it',
      })
      sceneManagerRef.current = sceneManager

      // If starting fresh on turn 1, position outside door
      if (currentTurn === 1) {
        sceneManager.cameraRig.setView('door_outside', 0.5)
        sceneManager.setCandidateStance('outside')
        setViewMode('door_outside')
        setStance('standing')
        onDistanceChangeRef.current?.(4.5, false)
      } else {
        sceneManager.cameraRig.setView('pov', 0.5)
        sceneManager.setCandidateStance('seated')
        setViewMode('pov')
        setStance('sitting')
        onDistanceChangeRef.current?.(2.1, true)
      }
    } catch (err) {
      console.error('[InterviewRoom3D] Failed to initialize 3D scene:', err)
      setHasWebGLError(true)
    }

    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose()
        sceneManagerRef.current = null
      }
    }
  }, [])

  // 2. React to isSpeaking state changes
  useEffect(() => {
    if (isSpeaking) {
      eventBridge.emit('npc_speaking_start', { npcName })
    } else {
      eventBridge.emit('npc_speaking_end')
    }
  }, [isSpeaking, npcName])

  // 3. React to npcEmotion changes
  useEffect(() => {
    if (npcEmotion) {
      eventBridge.emit('score_received', { emotion: npcEmotion })
    }
  }, [npcEmotion])

  // 5. Actions
  const handleTriggerBow = useCallback(() => {
    sceneManagerRef.current?.triggerCandidateBow(38, 2.0)
    sceneManagerRef.current?.characterController.triggerBow()
    etiquetteAudio.speakCandidateShitsurei()
  }, [])

  const handleTriggerNod = useCallback(() => {
    sceneManagerRef.current?.characterController.triggerNod()
  }, [])

  const handleQualityChange = useCallback((level: QualityLevel) => {
    setQualityLevel(level)
    eventBridge.emit('quality_changed', { level })
  }, [])

  const handleSitDown = useCallback(() => {
    setStance('sitting')
    sceneManagerRef.current?.setCandidateStance('seated')
    setTimeout(() => {
      handleViewChange('pov')
    }, 600)
    setEtiquetteStage('sitting_interview')
    onDistanceChangeRef.current?.(2.1, true)
    onSitDownRequestRef.current?.()
  }, [handleViewChange])

  const handleStandUp = useCallback(() => {
    setStance('standing')
    sceneManagerRef.current?.setCandidateStance('standing_chair')
    handleViewChange('candidate_standing')
    onDistanceChangeRef.current?.(3.0, true)
  }, [handleViewChange])

  // Fullscreen toggler
  const handleToggleFs = () => {
    if (onToggleNativeFullscreen) {
      onToggleNativeFullscreen()
      setIsNativeFs((prev) => !prev)
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      setIsNativeFs(false)
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsNativeFs(true)
    }
  }

  useEffect(() => {
    sceneManagerRef.current?.setCandidateGender(candidateGender)
    if (etiquetteStage === 'dress_check') handleViewChange('candidate_preview')
  }, [candidateGender, etiquetteStage, handleViewChange])

  // --- ETIQUETTE PROTOCOL WORKFLOW STEPS ---

  // Step 1: Confirm Dress Code
  const handleConfirmDressCode = () => {
    sceneManagerRef.current?.setCandidateGender(candidateGender)
    sceneManagerRef.current?.setCandidateStance('outside')
    handleViewChange('door_outside')
    setEtiquetteScore((prev) => prev + 15)
    setEtiquetteStage('outside_door')
    setEtiquetteStatusText(
      'Bạn đang đứng trước cửa phòng phỏng vấn. Hãy thực hiện nghi thức gõ 3 tiếng để xin phép vào phòng.'
    )
  }

  // Step 2: Knock on door (3 knocks)
  const handleKnockDoor = () => {
    if (isKnocking) return
    setIsKnocking(true)
    setEtiquetteStatusText('Đang gõ cửa 3 tiếng: Cộc... Cộc... Cộc...')
    sceneManagerRef.current?.triggerCandidateKnock()

    etiquetteAudio.playDoorKnocks(() => {
      setEtiquetteStatusText('Đang đợi phản hồi từ nhà tuyển dụng bên trong phòng...')

      setTimeout(() => {
        // NPC speaks: "どうぞ、お入りください" (Douzo, ohairi kudasai)
        etiquetteAudio.speakNpcEnterInvite(() => {
          etiquetteAudio.playDoorOpen()
          sceneManagerRef.current?.setDoorOpen(true)
          sceneManagerRef.current?.characterController.triggerNod()
          setIsKnocking(false)
          setEtiquetteScore((prev) => prev + 20)
          setEtiquetteStage('door_opened')
          setEtiquetteStatusText(
            'Nhà tuyển dụng đã mời: 「どうぞ、お入りください」 (Xin mời vào). Đang bước vào phòng & khép cửa nhẹ nhàng...'
          )
          // Automatically walk into room and close door smoothly
          setTimeout(() => {
            handleEnterRoom()
          }, 800)
        })
      }, 700)
    })
  }

  // Step 3: Enter room & close door gently
  const handleEnterRoom = () => {
    // 1. Candidate steps into room just inside doorway
    handleViewChange('door_enter')
    sceneManagerRef.current?.setCandidateStance('doorway')
    setEtiquetteStatusText('Đang bước vào phòng phỏng vấn...')

    // 2. Candidate turns slightly toward door and closes door with 2 hands
    setTimeout(() => {
      setEtiquetteStatusText('Ứng viên dùng hai tay khép cửa nhẹ nhàng...')
      sceneManagerRef.current?.triggerCandidateCloseDoor(true, () => {
        etiquetteAudio.playDoorClose()
        setEtiquetteStatusText('Đã đóng cửa nhẹ nhàng. Đang tiến đến cạnh ghế phỏng vấn...')

        // 3. Candidate walks over to stand beside the chair
        sceneManagerRef.current?.setCandidateStance('standing_chair')
        handleViewChange('candidate_standing')

        setTimeout(() => {
          setEtiquetteStage('standing_chair')
          setEtiquetteScore((prev) => prev + 15)
          setEtiquetteStatusText(
            'Đã đứng trang nghiêm cạnh ghế (bên trái ghế). Hãy cúi chào 30–45° (Keirei) và nói: 「失礼いたします」 (Xin phép).'
          )
        }, 1100)
      })
    }, 1100)
  }

  // Step 4: Stand beside chair & Bow (Keirei 30-45 deg)
  const handleGreetingBow = () => {
    sceneManagerRef.current?.triggerCandidateBow(38, 2.0)
    setEtiquetteStatusText('Đang cúi chào và nói: 「失礼いたします」 (Shitsurei itashimasu)...')

    etiquetteAudio.speakCandidateShitsurei(() => {
      setEtiquetteScore((prev) => prev + 20)
      setEtiquetteStage('waiting_sit')
      setWaitingForSitInvite(true)
      setCanSitNow(false)
      setEtiquetteStatusText(
        'Tác phong chuẩn: Đứng chờ bên cạnh ghế, KHÔNG tự ý ngồi xuống trước khi được nhà tuyển dụng mời.'
      )

      setTimeout(() => {
        sceneManagerRef.current?.characterController.triggerNod()
        // NPC invites to sit: "どうぞ、お掛けください" (Douzo, okake kudasai)
        etiquetteAudio.speakNpcSitInvite(() => {
          setWaitingForSitInvite(false)
          setCanSitNow(true)
          setEtiquetteStatusText(
            'Nhà tuyển dụng đã mời: 「どうぞ、お掛けください」 (Xin mời ngồi). Hãy đáp lễ 「失礼いたします」 và ngồi xuống ghế!'
          )
        })
      }, 900)
    })
  }

  // Step 5: Candidate responds "Shitsurei shimasu" and sits down
  const handleCandidateSitDown = () => {
    etiquetteAudio.speakCandidateShitsurei(() => {
      sceneManagerRef.current?.setCandidateStance('seated')
      setStance('sitting')
      setEtiquetteStatusText('Đang ngồi xuống ghế ngay ngắn, hai tay đặt trên đùi...')

      setTimeout(() => {
        handleViewChange('pov')
        setEtiquetteScore((prev) => prev + 15)
        setEtiquetteStage('sitting_interview')
        setShowEtiquetteCard(false) // Auto-collapse card so user can focus on questions and answering
        setEtiquetteStatusText(
          'Đã ngồi vào bàn phỏng vấn! Tư thế chuẩn: Lưng thẳng cách lưng ghế, 2 tay đặt nhẹ lên đùi, nét mặt tươi tỉnh nghiêm túc, gật đầu lắng nghe.'
        )
        onDistanceChangeRef.current?.(2.1, true)
        onSitDownRequestRef.current?.()
      }, 800)
    })
  }

  // Step 7: Stand up & bow with gratitude
  const handleExitStandingBow = () => {
    setStance('standing')
    sceneManagerRef.current?.setCandidateStance('standing_chair')
    handleViewChange('candidate_standing')

    setTimeout(() => {
      sceneManagerRef.current?.triggerCandidateBow(45, 2.4)
      setEtiquetteStatusText('Đang cúi đầu cảm ơn: 「本日は誠にありがとうございました」...')

      etiquetteAudio.speakCandidateArigatou(() => {
        setEtiquetteScore((prev) => prev + 10)
        setEtiquetteStatusText('Đang tiến ra cửa phòng...')

        setTimeout(() => {
          sceneManagerRef.current?.setCandidateStance('exit')
          handleViewChange('exit_bow')
          setEtiquetteStage('exit_door')
          setEtiquetteStatusText(
            'Đã đứng trước cửa. Hãy quay mặt lại đối diện nhà tuyển dụng, cúi chào 45° lần cuối: 「失礼いたします」 trước khi khép cửa rời phòng.'
          )
        }, 1100)
      })
    }, 400)
  }

  // Step 8: Final exit bow at the door & close door
  const handleFinalExitBow = () => {
    sceneManagerRef.current?.triggerCandidateBow(45, 2.0)
    setEtiquetteStatusText('Đang quay lại cúi chào lần cuối: 「失礼いたします」...')

    etiquetteAudio.speakCandidateShitsurei(() => {
      etiquetteAudio.playDoorOpen()
      sceneManagerRef.current?.setDoorOpen(true)
      setEtiquetteStatusText('Đang mở cửa và bước ra hành lang...')

      setTimeout(() => {
        sceneManagerRef.current?.setCandidateStance('outside')
        handleViewChange('door_outside')

        setTimeout(() => {
          setEtiquetteStatusText('Đang dùng hai tay khép cửa nhẹ nhàng từ bên ngoài...')
          sceneManagerRef.current?.triggerCandidateCloseDoor(false, () => {
            etiquetteAudio.playDoorClose()
            setEtiquetteScore((prev) => Math.min(prev + 10, 100))
            setEtiquetteStage('etiquette_mastered')
            setEtiquetteStatusText(
              'Xuất sắc! Bạn đã hoàn thành trọn vẹn 100% nghi thức phỏng vấn công sở Nhật Bản chuẩn chỉnh (面接マナー達成)!'
            )
          })
        }, 1100)
      }, 800)
    })
  }

  // Jump straight to seated interview view
  const handleSkipToInterview = useCallback(() => {
    setEtiquetteStage('sitting_interview')
    sceneManagerRef.current?.setCandidateGender(candidateGender)
    sceneManagerRef.current?.setDoorOpen(false)
    sceneManagerRef.current?.setCandidateStance('seated')
    setTimeout(() => {
      handleViewChange('pov')
    }, 400)
    setStance('sitting')
    setShowEtiquetteCard(false)
    onDistanceChangeRef.current?.(2.1, true)
    onSitDownRequestRef.current?.()
  }, [candidateGender, handleViewChange])

  // Listen to external skip_to_interview events (e.g. from Parent HUD banner)
  useEffect(() => {
    const unbind = eventBridge.on('skip_to_interview', () => {
      handleSkipToInterview()
    })
    return unbind
  }, [handleSkipToInterview])

  // Reset etiquette flow to start from beginning
  const handleRestartEtiquette = () => {
    setEtiquetteScore(0)
    setEtiquetteStage('dress_check')
    sceneManagerRef.current?.setDoorOpen(false)
    sceneManagerRef.current?.setCandidateStance('outside')
    handleViewChange('door_outside')
    setShowEtiquetteCard(true)
    setEtiquetteStatusText('Hãy kiểm tra trang phục công sở Nhật Bản trước khi bước vào phòng phỏng vấn.')
    onDistanceChangeRef.current?.(4.5, false)
  }

  // --- 2.5D FALLBACK VIEW (If WebGL is unavailable) ---
  if (hasWebGLError) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-white p-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-slate-900/90 backdrop-blur-xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
            <Building className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Phòng phỏng vấn Nhật Bản (Chế độ 2.5D)</h3>
            <p className="text-xs text-slate-400 mt-1">
              {companyName} • {sessionType === 'interview' ? 'Phỏng vấn tuyển dụng' : 'Tình huống công sở'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Người phỏng vấn:</span>
              <span className="font-semibold text-amber-300">
                {npcName} ({npcTitle})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Tiến độ phỏng vấn:</span>
              <span className="font-bold text-white">
                Lượt {currentTurn} / {maxTurns}
              </span>
            </div>
            {isSpeaking && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-pulse pt-1">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Người phỏng vấn đang nói...</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            (Thiết bị của bạn không hỗ trợ WebGL tăng tốc phần cứng, hệ thống tự động chuyển sang chế độ đàm thoại tối ưu)
          </p>
        </div>
      </div>
    )
  }

  // --- FULL 3D INTERACTIVE VIEW ---
  return (
    <div className="absolute inset-0 z-0 overflow-hidden select-none bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* When UI is hidden, only show unhide toggle at top-right */}
      {isUiHidden ? (
        <div className="absolute top-4 right-4 sm:right-6 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsUiHidden(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs shadow-xl transition-all"
            title="Hiện lại toàn bộ thanh điều khiển"
          >
            <Eye className="w-3.5 h-3.5 text-slate-300" />
            <span>Hiện giao diện</span>
          </button>
        </div>
      ) : (
        <>
          {/* Top Left HUD: Company & Interviewer Badges */}
          <div className="absolute top-4 left-4 sm:left-6 z-20 pointer-events-auto flex flex-col gap-2 font-sans">
            <div className="flex items-center gap-2">
              {/* Company Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-xs font-semibold text-slate-200 tracking-wide">{companyName || '株式会社ネクステック'}</span>
              </div>

              {/* Turn Badge */}
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-300 text-xs font-mono shadow-lg">
                Tiến độ: Câu {currentTurn}/{maxTurns}
              </div>

              {/* Etiquette Score Badge */}
              {etiquetteScore > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700/80 text-slate-300 text-xs font-mono shadow-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tác phong: {etiquetteScore}/100</span>
                </div>
              )}
            </div>

            {/* Interviewer Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg w-fit">
              <span className="font-medium text-slate-200">{npcName}</span>
              <span className="text-[11px] text-slate-400 font-mono">({npcTitle})</span>
              {isSpeaking && (
                <div className="flex items-center gap-1 text-[10px] text-sky-400 ml-1.5 font-mono">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  <span>Đang phát biểu</span>
                </div>
              )}
            </div>
          </div>

          {/* Top Right Executive HUD Controls */}
          <div className="absolute top-4 right-4 sm:right-6 z-20 pointer-events-auto flex items-center gap-2">
            {/* Document Viewer Button */}
            <button
              type="button"
              onClick={() => setShowDocModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs shadow-lg transition-all"
              title="Mở hồ sơ đánh giá phỏng vấn trên bàn (Biên bản)"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Biên bản</span>
            </button>

            {/* Cultural Etiquette Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowEtiquetteMenu(!showEtiquetteMenu)
                  setShowSettingsMenu(false)
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shadow-lg transition-all border ${
                  showEtiquetteMenu
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                }`}
                title="Các thao tác nghi thức văn hóa Nhật Bản"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Nghi thức</span>
              </button>

              {showEtiquetteMenu && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-slate-900/98 border border-slate-700 shadow-2xl p-2 text-xs space-y-1 z-30 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      handleTriggerBow()
                      setShowEtiquetteMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between"
                  >
                    <span>🙇 Cúi chào 30–45°</span>
                    <span className="text-[10px] text-slate-400 font-mono">失礼いたします</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleTriggerNod()
                      setShowEtiquetteMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between"
                  >
                    <span>👍 Gật đầu lắng nghe</span>
                    <span className="text-[10px] text-slate-400 font-mono">相槌</span>
                  </button>
                  {stance === 'standing' ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleSitDown()
                        setShowEtiquetteMenu(false)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between"
                    >
                      <span>🪑 Ngồi vào bàn phỏng vấn</span>
                      <span className="text-[10px] text-slate-400 font-mono">着席</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleStandUp()
                        setShowEtiquetteMenu(false)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between"
                    >
                      <span>🚶 Đứng dậy cạnh ghế</span>
                      <span className="text-[10px] text-slate-400 font-mono">起立</span>
                    </button>
                  )}
                  {etiquetteStage === 'sitting_interview' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleStartExitProtocol()
                        setShowEtiquetteMenu(false)
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between border-t border-slate-800 pt-1.5"
                    >
                      <span>🚪 Bắt đầu chào ra về</span>
                      <span className="text-[10px] text-slate-400 font-mono">退室</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleRestartEtiquette()
                      setShowEtiquetteMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-between border-t border-slate-800 pt-1.5"
                  >
                    <span>🔄 Làm lại từ bước 1</span>
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              )}
            </div>

            {/* Settings Dropdown (Camera Angles, Engine, Quality) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsMenu(!showSettingsMenu)
                  setShowEtiquetteMenu(false)
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shadow-lg transition-all border ${
                  showSettingsMenu
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                }`}
                title="Cài đặt góc máy và chế độ hiển thị"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Cài đặt</span>
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-slate-900/98 border border-slate-700 shadow-2xl p-3 text-xs space-y-3 z-30 font-sans">
                  {/* Camera Angles */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Góc máy quan sát
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'pov', label: 'POV Nhìn thẳng' },
                        { id: 'ots', label: 'Qua vai (OTS)' },
                        { id: 'wide', label: 'Toàn cảnh phòng' },
                        { id: 'desk', label: 'Cận bàn tài liệu' },
                      ].map((cam) => (
                        <button
                          key={cam.id}
                          type="button"
                          onClick={() => {
                            handleViewChange(cam.id as any)
                            setShowSettingsMenu(false)
                          }}
                          className={`px-2 py-1.5 rounded text-[11px] text-left transition-colors border ${
                            viewMode === cam.id
                              ? 'bg-slate-800 text-white border-slate-600 font-semibold'
                              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/60'
                          }`}
                        >
                          {cam.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Level */}
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Chất lượng
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['low', 'medium', 'high'] as QualityLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleQualityChange(level)}
                          className={`py-1 rounded text-[11px] text-center transition-colors border ${
                            qualityLevel === level
                              ? 'bg-slate-800 text-white border-slate-600 font-semibold'
                              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/60'
                          }`}
                        >
                          {level === 'low' ? 'Thấp' : level === 'medium' ? 'Vừa' : 'Cao'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hide UI Toggle Button */}
            <button
              type="button"
              onClick={() => setIsUiHidden(true)}
              title="Ẩn giao diện để quan sát trọn vẹn phòng phỏng vấn"
              className="p-2 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white shadow-lg transition-all"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>

            {/* Native Fullscreen */}
            <button
              type="button"
              onClick={handleToggleFs}
              title="Toàn màn hình"
              className="p-2 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white shadow-lg transition-all"
            >
              {isNativeFs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Exit Button */}
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                title="Thoát phòng phỏng vấn"
                className="p-2 rounded-lg bg-slate-900/95 hover:bg-red-950/80 border border-slate-700/80 hover:border-red-500/40 text-slate-300 hover:text-red-300 shadow-lg transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* JAPANESE INTERVIEW ETIQUETTE CONTROLLER CARD (MODAL / OVERLAY)            */}
      {/* ========================================================================= */}
      {showEtiquetteCard && (
        <motion.div
          drag
          dragMomentum={false}
          className={`absolute z-30 pointer-events-auto w-[92%] max-w-lg ${etiquetteStage === 'dress_check' ? 'bottom-20 right-4 max-h-[50dvh] overflow-y-auto lg:bottom-auto lg:top-24 lg:max-h-[calc(100dvh-10rem)] lg:max-w-sm' : 'top-16 sm:top-20 left-1/2 -translate-x-1/2 cursor-move'}`}
        >
          {/* STAGE 1: DRESS CODE CHECKLIST MODAL */}
          {etiquetteStage === 'dress_check' && (
            <div className="rounded-3xl border border-amber-500/40 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl text-white space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-amber-300 tracking-wide">
                      Nghi thức 1: Chuẩn bị trang phục phỏng vấn (身だしなみ)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Chuẩn mực phong thái công sở Nhật Bản</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Gender / Attire Selection Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <button
                  type="button"
                  aria-pressed={candidateGender === 'male'}
                  onClick={() => setCandidateGender('male')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                    candidateGender === 'male'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Ứng viên Nam (Suit nam)</span>
                </button>
                <button
                  type="button"
                  aria-pressed={candidateGender === 'female'}
                  onClick={() => setCandidateGender('female')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                    candidateGender === 'female'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Ứng viên Nữ (Vest nữ)</span>
                </button>
              </div>

              {/* Attire Specification Checklist */}
              <p className="text-xs leading-relaxed text-slate-200">Đang xem ứng viên {candidateGender === 'female' ? 'nữ' : 'nam'} trong cảnh 3D. Khi ngồi vào bàn, chọn góc “Ứng viên” để xem lại; POV là góc nhìn qua mắt bạn.</p>
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-2 text-xs">
                {candidateGender === 'male' ? (
                  <>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Suit tối màu:</strong> Màu đen hoặc xanh đen (navy), sạch sẽ, vừa vặn cơ thể.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Áo sơ mi:</strong> Sơ mi trắng phẳng phiu, cổ áo sạch sẽ không nhăn.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Cà vạt:</strong> Thắt ngay ngắn, màu trang nhã (đỏ đô, xanh navy), không lòe loẹt.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Giày tây:</strong> Giày da đen sạch bóng, tất đen hoặc xám sẫm màu.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Vest/Suit công sở:</strong> Màu tối lịch sự (đen/xanh đen/xám), chân váy qua gối hoặc
                        quần tây.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Áo sơ mi:</strong> Sơ mi trắng cài kín cúc cổ hoặc cổ chữ V công sở thanh lịch.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tóc & Trang điểm:</strong> Tóc buộc hoặc chải gọn gàng phía sau, trang điểm nhẹ nhàng tự
                        nhiên.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Giày:</strong> Giày cao gót đen bít mũi vừa phải (3–5cm), sạch sẽ, lịch sự.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmDressCode}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                >
                  <Award className="w-4 h-4" />
                  <span>Xác nhận trang phục & Bắt đầu (+15đ tác phong)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkipToInterview}
                  className="py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all text-center"
                >
                  Bỏ qua & Vào bàn ngay
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: OUTSIDE DOOR & KNOCKING PROTOCOL */}
          {(etiquetteStage === 'outside_door' || etiquetteStage === 'knocking') && (
            <div className="rounded-3xl border border-amber-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-amber-300 tracking-wide">
                      Nghi thức 2: Gõ cửa vào phòng phỏng vấn (入室マナー)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Đứng trước cửa phòng 「面接室」</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-xs sm:text-sm leading-relaxed text-amber-100 font-medium">
                💡 <strong>Quy tắc văn hóa:</strong> Tại Nhật Bản, gõ 2 tiếng là kiểm tra nhà vệ sinh; đối với phòng họp
                và phòng phỏng vấn, bắt buộc phải <strong>gõ 3 tiếng</strong> rõ ràng, dứt khoát. Sau đó đứng chờ nghe
                thấy tiếng <em>"Douzo, ohairi kudasai"</em> (Xin mời vào) mới được mở cửa.
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={isKnocking}
                  onClick={handleKnockDoor}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm shadow-xl active:scale-95 transition-all ${
                    isKnocking
                      ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-orange-500/25'
                  }`}
                >
                  <DoorOpen className="w-4 h-4" />
                  <span>{isKnocking ? 'Đang gõ cửa và đợi phản hồi...' : '🚪 Gõ cửa (3 tiếng: Cộc! Cộc! Cộc!)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkipToInterview}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 transition-all text-center"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: DOOR OPENED -> ENTER & CLOSE DOOR GENTLY */}
          {etiquetteStage === 'door_opened' && (
            <div className="rounded-3xl border border-emerald-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-emerald-300 tracking-wide">
                      Cửa đã mở! Tiến vào phòng phỏng vấn (入室)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">
                      Người phỏng vấn: 「どうぞ、お入りください」 (Xin mời vào)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm leading-relaxed text-emerald-100 font-medium">
                💡 <strong>Quy tắc đóng cửa:</strong> Bước qua cửa, xoay người nhẹ nhàng khép cửa bằng 2 tay không tạo ra
                tiếng va đập mạnh; tuyệt đối không quay lưng hoàn toàn vào người phỏng vấn hoặc đập cửa sầm.
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              <button
                type="button"
                onClick={handleEnterRoom}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <Footprints className="w-4 h-4" />
                <span>🚶 Bước vào phòng & Khép cửa nhẹ nhàng</span>
              </button>
            </div>
          )}

          {/* STAGE 4: STANDING BESIDE CHAIR & BOW (30-45 DEG) */}
          {etiquetteStage === 'standing_chair' && (
            <div className="rounded-3xl border border-amber-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-amber-300 tracking-wide">
                      Nghi thức 3: Chào hỏi khi vào phòng (挨拶と一礼)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Đứng bên cạnh ghế phỏng vấn</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-xs sm:text-sm leading-relaxed text-amber-100 font-medium">
                💡 <strong>Tác phong đứng & cúi chào:</strong> Đứng bên cạnh ghế (thường là bên trái theo quy ước công
                sở), thẳng lưng trang nghiêm. Cúi chào 30–45° (Keirei) và đồng thời nói to, rõ ràng:
                <strong className="block text-amber-200 mt-1 font-bold">「失礼いたします」 (Shitsurei itashimasu - Xin phép).</strong>
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              <button
                type="button"
                onClick={handleGreetingBow}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-orange-500/25 active:scale-95 transition-all"
              >
                <span>🙇</span>
                <span>Cúi chào 30–45° & Nói: 失礼いたします (+20đ)</span>
              </button>
            </div>
          )}

          {/* STAGE 5: WAITING TO BE INVITED TO SIT (SEATING ETIQUETTE) */}
          {etiquetteStage === 'waiting_sit' && (
            <div className="rounded-3xl border border-indigo-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-indigo-300 tracking-wide">
                      Nghi thức 4: Nghi thức ngồi ghế (着席マナー)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Đợi lời mời chính thức từ nhà tuyển dụng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-xs sm:text-sm leading-relaxed text-indigo-100 font-medium">
                💡 <strong>Nguyên tắc vàng:</strong> Tuyệt đối <em>KHÔNG tự ý ngồi xuống</em> trước khi người phỏng vấn
                mời. Khi nghe thấy <em>"どうぞ、お掛けください"</em> (Douzo, okake kudasai - Xin mời ngồi), hãy đáp lễ{' '}
                <strong className="text-indigo-200 font-bold">「失礼いたします」</strong> rồi mới nhẹ nhàng ngồi xuống.
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              {waitingForSitInvite && (
                <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 text-xs sm:text-sm text-slate-200 font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Đang đợi người phỏng vấn mời ngồi...</span>
                </div>
              )}

              {canSitNow && (
                <button
                  type="button"
                  onClick={handleCandidateSitDown}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>🪑 Đáp: 失礼いたします & Ngồi xuống ghế (+15đ)</span>
                </button>
              )}
            </div>
          )}

          {/* STAGE 6: SITTING INTERVIEW IN PROGRESS (COMPACT MANNER OVERLAY) */}
          {etiquetteStage === 'sitting_interview' && (
            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl text-white space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                      Tác phong trong buổi phỏng vấn (面接中マナー)
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs sm:text-sm leading-relaxed text-slate-200 space-y-1.5 font-medium">
                <p>
                  🪑 <strong>Tư thế:</strong> Ngồi thẳng lưng, không tựa hẳn vào lưng ghế.
                </p>
                <p>
                  🤲 <strong>Tay:</strong> Hai tay khép nhẹ đặt tự nhiên trên đùi; gật đầu nhẹ (頷く) khi lắng nghe.
                </p>
                <p>
                  😊 <strong>Biểu cảm:</strong> Giữ ánh mắt tự tin, tươi tỉnh và nghiêm túc.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs sm:text-sm font-bold text-emerald-400">
                  Điểm tác phong: +{etiquetteScore}/100đ
                </span>
                <button
                  type="button"
                  onClick={handleStartExitProtocol}
                  className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-indigo-900/90 hover:bg-indigo-800 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-all"
                >
                  <DoorOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Nghi thức kết thúc phỏng vấn</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 7: EXIT INTERVIEW - STANDING BESIDE CHAIR & BOW */}
          {etiquetteStage === 'exit_standing' && (
            <div className="rounded-3xl border border-indigo-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-indigo-300 tracking-wide">
                      Nghi thức 5: Chào khi kết thúc phỏng vấn (退室マナー)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Đứng dậy sang bên cạnh ghế</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-xs sm:text-sm leading-relaxed text-indigo-100 font-medium">
                💡 <strong>Lời cảm ơn trang trọng:</strong> Sau khi nhà tuyển dụng thông báo kết thúc, hãy đứng dậy cạnh
                ghế, cúi đầu cảm ơn sâu sắc:
                <strong className="block text-indigo-200 mt-1 font-bold">
                  「本日は誠にありがとうございました」 (Honjitsu wa makoto ni arigatou gozaimashita - Hôm nay tôi xin chân
                  thành cảm ơn quý công ty).
                </strong>
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              <button
                type="button"
                onClick={handleExitStandingBow}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-indigo-500/25 active:scale-95 transition-all"
              >
                <span>🙇</span>
                <span>Cúi đầu cảm ơn: 誠にありがとうございました (+10đ)</span>
              </button>
            </div>
          )}

          {/* STAGE 8: EXIT INTERVIEW - FINAL BOW AT THE DOOR */}
          {etiquetteStage === 'exit_door' && (
            <div className="rounded-3xl border border-purple-500/50 bg-slate-900/98 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl text-white space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-purple-300 tracking-wide">
                      Nghi thức 6: Cúi chào lần cuối trước cửa (一礼と退室)
                    </h3>
                    <p className="text-xs text-slate-200 font-medium">Đứng trước cửa phòng trước khi ra ngoài</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEtiquetteCard(false)}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/40 text-xs sm:text-sm leading-relaxed text-purple-100 font-medium">
                💡 <strong>Chào trước khi đóng cửa:</strong> Đợi ra đến cửa, quay người lại đối diện người phỏng vấn một
                lần nữa, cúi chào 45° và nói:
                <strong className="block text-purple-200 mt-1 font-bold">
                  「失礼いたします」 (Shitsurei itashimasu) trước khi mở cửa, bước ra ngoài và khép cửa nhẹ nhàng.
                </strong>
              </div>

              <p className="text-xs sm:text-sm text-white font-semibold bg-slate-950/70 p-3 rounded-xl border border-slate-800">{etiquetteStatusText}</p>

              <button
                type="button"
                onClick={handleFinalExitBow}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-500/25 active:scale-95 transition-all"
              >
                <span>🙇</span>
                <span>Quay lại cúi chào: 失礼いたします & Khép cửa</span>
              </button>
            </div>
          )}

          {/* STAGE 9: ETIQUETTE MASTERED CELEBRATION */}
          {etiquetteStage === 'etiquette_mastered' && (
            <div className="rounded-3xl border border-amber-500/50 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl text-white space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white mx-auto shadow-xl shadow-orange-500/30">
                <Award className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-lg font-black text-amber-300">
                  🎉 Hoàn thành xuất sắc nghi thức phỏng vấn Nhật Bản!
                </h3>
                <p className="text-xs sm:text-sm text-slate-100 mt-1.5 leading-relaxed font-medium">
                  Bạn đã thực hiện chuẩn chỉ 100% văn hóa và tác phong phỏng vấn công sở Nhật Bản: từ trang phục, gõ cửa 3
                  tiếng, chào hỏi khi vào phòng, tư thế ngồi thẳng lưng nghiêm túc, đến cúi đầu cảm ơn khi ra về.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-around text-xs sm:text-sm">
                <div>
                  <span className="text-slate-300 block text-xs font-medium">Điểm tác phong</span>
                  <span className="text-lg font-black text-emerald-400">100 / 100</span>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div>
                  <span className="text-slate-300 block text-xs font-medium">Đánh giá tác phong</span>
                  <span className="text-lg font-black text-amber-400">Xuất sắc (S)</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {onViewOfferLetter ? (
                  <button
                    type="button"
                    onClick={onViewOfferLetter}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-orange-500/25 active:scale-95 transition-all animate-pulse"
                  >
                    <Award className="w-4 h-4 text-white" />
                    <span>🎉 Nhận Thư Trúng Tuyển & Kết Quả</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSkipToInterview}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-bold text-xs shadow-xl transition-all"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Vào bàn đàm thoại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRestartEtiquette}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Luyện lại</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Official Japanese Evaluation Record Modal */}
      <InterviewDocumentModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        companyName={companyName}
        npcName={npcName}
        npcTitle={npcTitle}
      />
    </div>
  )
}

export default InterviewRoom3D
