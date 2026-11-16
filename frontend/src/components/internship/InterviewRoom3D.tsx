import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Eye,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Compass,
  Footprints,
  HelpCircle,
  X,
} from 'lucide-react'

interface InterviewRoom3DProps {
  npcName: string
  npcTitle: string
  npcEmotion?: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'strict'
  companyName: string
  isSpeaking?: boolean
  sessionType: 'interview' | 'workplace'
  currentTurn: number
  maxTurns: number
  isFullScreenMode?: boolean
  onToggleNativeFullscreen?: () => void
  onExit?: () => void
  onDistanceChange?: (dist: number, canTalk: boolean) => void
  onSitDownRequest?: () => void
}

type CameraViewMode = 'pov' | 'close' | 'isometric'

export const InterviewRoom3D: React.FC<InterviewRoom3DProps> = ({
  npcName,
  npcTitle,
  npcEmotion = 'neutral',
  companyName,
  isSpeaking = false,
  sessionType,
  currentTurn,
  maxTurns,
  isFullScreenMode = true,
  onToggleNativeFullscreen,
  onExit,
  onDistanceChange,
  onSitDownRequest,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [viewMode, setViewMode] = useState<CameraViewMode>('pov')
  const [stance, setStance] = useState<'sitting' | 'standing'>('sitting')
  const [distToBoss, setDistToBoss] = useState<number>(2.75)
  const [isNearBoss, setIsNearBoss] = useState<boolean>(true)
  const [showControlsGuide, setShowControlsGuide] = useState<boolean>(true)
  const [isRotating, setIsRotating] = useState(false)
  const [isNativeFs, setIsNativeFs] = useState(false)

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animFrameId = useRef<number | null>(null)

  // Animated 3D objects
  const headRef = useRef<THREE.Group | null>(null)
  const mouthRef = useRef<THREE.Mesh | null>(null)
  const leftEyeRef = useRef<THREE.Mesh | null>(null)
  const rightEyeRef = useRef<THREE.Mesh | null>(null)
  const torsoRef = useRef<THREE.Mesh | null>(null)
  const moodLightRef = useRef<THREE.PointLight | null>(null)

  // First-Person Direct Eye POV & Movement State
  const playerPos = useRef({ x: 0, y: 1.38, z: 2.1 }) // Default candidate chair eye position
  const playerYaw = useRef(0) // 0 radians = facing directly at Boss (-Z)
  const playerPitch = useRef(0) // 0 = looking horizontal
  const keysDown = useRef({ w: false, a: false, s: false, d: false, shift: false })
  const walkCycle = useRef(0)
  const isPointerDown = useRef(false)
  const prevPointer = useRef({ x: 0, y: 0 })
  const manualOrbit = useRef({ x: 0, y: 0 })

  // Quick action: Sit down at candidate desk facing boss
  const handleSitDown = useCallback(() => {
    playerPos.current = { x: 0, y: 1.38, z: 2.1 }
    playerYaw.current = 0
    playerPitch.current = 0
    setStance('sitting')
    if (onSitDownRequest) onSitDownRequest()
  }, [onSitDownRequest])

  // Quick action: Stand up to walk around room
  const handleStandUp = useCallback(() => {
    setStance('standing')
  }, [])

  // Quick action: Align direct gaze at boss's face
  const handleResetGaze = useCallback(() => {
    const dx = 0 - playerPos.current.x
    const dz = -0.65 - playerPos.current.z
    playerYaw.current = Math.atan2(-dx, -dz)
    const dist = Math.hypot(dx, dz)
    const dy = 1.45 - playerPos.current.y
    playerPitch.current = Math.atan2(dy, dist)
  }, [])

  // Virtual D-Pad handlers for mobile/mouse hold
  const handleVirtualDirDown = (dir: 'w' | 'a' | 's' | 'd') => {
    if (stance === 'sitting') {
      setStance('standing')
    }
    keysDown.current[dir] = true
  }

  const handleVirtualDirUp = (dir: 'w' | 'a' | 's' | 'd') => {
    keysDown.current[dir] = false
  }

  // Keyboard Event Listeners for Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger movement if user is typing in a form or dialogue input
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
      ) {
        return
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (stance === 'sitting') setStance('standing')
        keysDown.current.w = true
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (stance === 'sitting') setStance('standing')
        keysDown.current.s = true
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (stance === 'sitting') setStance('standing')
        keysDown.current.a = true
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (stance === 'sitting') setStance('standing')
        keysDown.current.d = true
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keysDown.current.shift = true
      } else if (e.code === 'KeyC') {
        setStance((prev) => {
          if (prev === 'sitting') {
            return 'standing'
          } else {
            handleSitDown()
            return 'sitting'
          }
        })
      } else if (e.code === 'KeyR') {
        handleResetGaze()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keysDown.current.w = false
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') keysDown.current.s = false
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysDown.current.a = false
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') keysDown.current.d = false
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keysDown.current.shift = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [stance, handleSitDown, handleResetGaze])

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 450

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f1d) // Deep slate navy
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.035)
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100)
    camera.position.set(0, 1.38, 2.1)
    camera.lookAt(0, 1.25, -0.65)
    cameraRef.current = camera

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xf8fafc, 0.75)
    scene.add(ambientLight)

    const ceilingLight = new THREE.DirectionalLight(0xffffff, 1.1)
    ceilingLight.position.set(0, 4.5, 0.5)
    ceilingLight.castShadow = true
    ceilingLight.shadow.mapSize.width = 1024
    ceilingLight.shadow.mapSize.height = 1024
    ceilingLight.shadow.bias = -0.001
    scene.add(ceilingLight)

    const windowLight = new THREE.DirectionalLight(0x93c5fd, 0.85)
    windowLight.position.set(-3.5, 3.2, -4)
    scene.add(windowLight)

    const moodLight = new THREE.PointLight(0xf59e0b, 1.2, 6)
    moodLight.position.set(0, 1.8, 0.4)
    scene.add(moodLight)
    moodLightRef.current = moodLight

    // 5. Procedural Textures & Materials
    // Tokyo Sunset Skyline texture
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 1024
    skyCanvas.height = 512
    const sCtx = skyCanvas.getContext('2d')
    if (sCtx) {
      const grad = sCtx.createLinearGradient(0, 0, 0, 512)
      grad.addColorStop(0, '#0369a1')
      grad.addColorStop(0.35, '#f59e0b')
      grad.addColorStop(0.65, '#ea580c')
      grad.addColorStop(1, '#090d16')
      sCtx.fillStyle = grad
      sCtx.fillRect(0, 0, 1024, 512)

      sCtx.fillStyle = '#090d16'
      for (let x = 0; x < 1024; x += 28) {
        const bHeight = 160 + Math.sin(x * 0.05) * 85 + Math.random() * 45
        const bWidth = 22 + Math.random() * 20
        sCtx.fillRect(x, 512 - bHeight, bWidth, bHeight)

        sCtx.fillStyle = '#fef08a'
        for (let wy = 512 - bHeight + 10; wy < 510; wy += 14) {
          if (Math.random() > 0.45) {
            sCtx.fillRect(x + 4, wy, 3, 3)
            sCtx.fillRect(x + 12, wy, 3, 3)
          }
        }
        sCtx.fillStyle = '#090d16'
      }

      // Tokyo Tower Silhouette
      sCtx.fillStyle = '#dc2626'
      sCtx.beginPath()
      sCtx.moveTo(700, 512 - 270)
      sCtx.lineTo(690, 512)
      sCtx.lineTo(710, 512)
      sCtx.fill()
    }
    const skyTexture = new THREE.CanvasTexture(skyCanvas)

    // Japanese Ho-Ren-So Presentation Whiteboard Texture
    const wbCanvas = document.createElement('canvas')
    wbCanvas.width = 1024
    wbCanvas.height = 512
    const wbCtx = wbCanvas.getContext('2d')
    if (wbCtx) {
      wbCtx.fillStyle = '#f8fafc'
      wbCtx.fillRect(0, 0, 1024, 512)

      wbCtx.fillStyle = '#0f172a'
      wbCtx.font = 'bold 32px sans-serif'
      wbCtx.fillText('2026年 ビジネス戦略 & 報・連・相 (Ho-Ren-So)', 40, 55)

      wbCtx.strokeStyle = '#cbd5e1'
      wbCtx.lineWidth = 3
      wbCtx.beginPath()
      wbCtx.moveTo(40, 75)
      wbCtx.lineTo(980, 75)
      wbCtx.stroke()

      wbCtx.fillStyle = '#0284c7'
      wbCtx.font = 'bold 24px sans-serif'
      wbCtx.fillText('【ビジネスマナー三大原則】', 40, 120)

      wbCtx.fillStyle = '#334155'
      wbCtx.font = '20px sans-serif'
      wbCtx.fillText('1. 報告 (Houkoku): Kết quả & tiến độ công việc', 55, 160)
      wbCtx.fillText('2. 連絡 (Renraku): Thông tin phát sinh kịp thời', 55, 195)
      wbCtx.fillText('3. 相談 (Soudan): Trao đổi khi gặp khó khăn, vướng mắc', 55, 230)

      wbCtx.fillStyle = '#ea580c'
      wbCtx.font = 'bold 24px sans-serif'
      wbCtx.fillText('【AI ĐÁNH GIÁ NĂNG LỰC】', 550, 120)

      wbCtx.fillStyle = '#334155'
      wbCtx.font = '20px sans-serif'
      wbCtx.fillText('• 文法 (Ngữ pháp): Chuẩn xác, súc tích', 565, 160)
      wbCtx.fillText('• 敬語 (Kính ngữ): Sonkeigo & Kenjougo', 565, 195)
      wbCtx.fillText('• マナー (Tác phong): Lịch thiệp, chuẩn mực', 565, 230)

      wbCtx.fillStyle = '#16a34a'
      wbCtx.font = 'bold 22px sans-serif'
      wbCtx.fillText('★ 目標: 日本企業内定 100% 達成！ (Quyết tâm nhận Naitei!)', 40, 310)
    }
    const wbTexture = new THREE.CanvasTexture(wbCanvas)

    // Japanese Exit Sign (非常口) Texture
    const exitCanvas = document.createElement('canvas')
    exitCanvas.width = 256
    exitCanvas.height = 128
    const eCtx = exitCanvas.getContext('2d')
    if (eCtx) {
      eCtx.fillStyle = '#15803d'
      eCtx.fillRect(0, 0, 256, 128)
      eCtx.fillStyle = '#ffffff'
      eCtx.font = 'bold 36px sans-serif'
      eCtx.fillText('非常口', 70, 52)
      eCtx.font = 'bold 22px sans-serif'
      eCtx.fillText('EXIT 🏃', 85, 92)
    }
    const exitTexture = new THREE.CanvasTexture(exitCanvas)

    // 6. Room Geometry
    // Floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.2,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Back Wall with Tokyo Panoramic Window
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.2), wallMat)
    backWall.position.set(0, 2.5, -3.2)
    scene.add(backWall)

    // Tokyo Window
    const windowFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 2.8),
      new THREE.MeshBasicMaterial({ map: skyTexture })
    )
    windowFrame.position.set(0, 2.5, -3.08)
    scene.add(windowFrame)

    // Window Mullions
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.05, 0.05), mullionMat)
    hBar.position.set(0, 2.5, -3.05)
    scene.add(hBar)

    const vBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.8, 0.05), mullionMat)
    vBar1.position.set(-1.6, 2.5, -3.05)
    scene.add(vBar1)

    const vBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.8, 0.05), mullionMat)
    vBar2.position.set(1.6, 2.5, -3.05)
    scene.add(vBar2)

    // Left Wall with Japanese Shoji Screens
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 8), wallMat)
    leftWall.position.set(-4.9, 2.5, 0)
    scene.add(leftWall)

    const shojiMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    const shoji = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 3, 2), shojiMat)
    shoji.position.set(-4.78, 2.2, -1)
    scene.add(shoji)

    // Right Wall with Whiteboard
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 8), wallMat)
    rightWall.position.set(4.9, 2.5, 0)
    scene.add(rightWall)

    const whiteboard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.8),
      new THREE.MeshBasicMaterial({ map: wbTexture })
    )
    whiteboard.position.set(4.78, 2.2, 0)
    whiteboard.rotation.y = -Math.PI / 2
    scene.add(whiteboard)

    const wbFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.9, 3.7),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 })
    )
    wbFrame.position.set(4.8, 2.2, 0)
    scene.add(wbFrame)

    // Front Wall Behind Candidate with Frosted Office Door
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.2), wallMat)
    frontWall.position.set(0, 2.5, 3.9)
    scene.add(frontWall)

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.35,
    })
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.8), doorMat)
    door.position.set(0, 1.4, 3.78)
    scene.add(door)

    const exitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.25),
      new THREE.MeshBasicMaterial({ map: exitTexture })
    )
    exitSign.position.set(0, 3.0, 3.77)
    scene.add(exitSign)

    // Potted Office Plant in Corner
    const plantPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.45, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    )
    plantPot.position.set(-3.8, 0.225, 2.8)
    plantPot.castShadow = true
    scene.add(plantPot)

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c3d2e })
    )
    stem.position.set(-3.8, 0.65, 2.8)
    scene.add(stem)

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 })
    for (let i = 0; i < 4; i++) {
      const leafSphere = new THREE.Mesh(new THREE.SphereGeometry(0.2 - i * 0.02, 8, 8), foliageMat)
      leafSphere.position.set(-3.8 + (i % 2 === 0 ? 0.05 : -0.05), 0.95 + i * 0.14, 2.8)
      leafSphere.castShadow = true
      scene.add(leafSphere)
    }

    // 7. Executive Boardroom Conference Table
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314, // Polished dark mahogany
      roughness: 0.2,
      metalness: 0.15,
    })
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.2), tableTopMat)
    tableTop.position.set(0, 0.85, 0)
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    scene.add(tableTop)

    // Table Chrome Legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 16)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 })
    const leg1 = new THREE.Mesh(legGeo, legMat)
    leg1.position.set(-1.0, 0.425, 0.45)
    leg1.castShadow = true
    scene.add(leg1)

    const leg2 = new THREE.Mesh(legGeo, legMat)
    leg2.position.set(1.0, 0.425, 0.45)
    leg2.castShadow = true
    scene.add(leg2)

    const leg3 = new THREE.Mesh(legGeo, legMat)
    leg3.position.set(-1.0, 0.425, -0.45)
    leg3.castShadow = true
    scene.add(leg3)

    const leg4 = new THREE.Mesh(legGeo, legMat)
    leg4.position.set(1.0, 0.425, -0.45)
    leg4.castShadow = true
    scene.add(leg4)

    // Table Accessories
    // Boss Laptop
    const laptopBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.015, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 })
    )
    laptopBase.position.set(-0.55, 0.9, -0.15)
    laptopBase.rotation.y = 0.25
    laptopBase.castShadow = true
    scene.add(laptopBase)

    const laptopScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 })
    )
    laptopScreen.position.set(-0.58, 1.0, -0.24)
    laptopScreen.rotation.y = 0.25
    laptopScreen.rotation.x = -0.15
    scene.add(laptopScreen)

    // Green Tea Cup
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.1 })
    )
    cup.position.set(0.65, 0.94, -0.1)
    cup.castShadow = true
    scene.add(cup)

    // Boss Folder
    const docFolder = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.01, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    )
    docFolder.position.set(0, 0.9, -0.1)
    docFolder.castShadow = true
    scene.add(docFolder)

    // Candidate Resume Folder on Candidate's side of table
    const candFolder = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.01, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 })
    )
    candFolder.position.set(0, 0.9, 0.35)
    candFolder.castShadow = true
    scene.add(candFolder)

    // 8. Candidate Executive Chair (Facing Boss)
    const candChairGroup = new THREE.Group()
    candChairGroup.position.set(0, 0, 2.05)
    candChairGroup.rotation.y = Math.PI
    scene.add(candChairGroup)

    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    const candSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.5), chairMat)
    candSeat.position.set(0, 0.48, 0)
    candSeat.castShadow = true
    candChairGroup.add(candSeat)

    const candBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.08), chairMat)
    candBack.position.set(0, 0.85, -0.22)
    candBack.castShadow = true
    candChairGroup.add(candBack)

    const candLegMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
    const candLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 16), candLegMat)
    candLeg.position.set(0, 0.22, 0)
    candChairGroup.add(candLeg)

    // 9. 3D Procedural Japanese Boss Character
    const npcGroup = new THREE.Group()
    npcGroup.position.set(0, 0.85, -0.65)
    scene.add(npcGroup)

    // Suit Torso
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.3), suitMat)
    torso.position.set(0, 0.35, 0)
    torso.castShadow = true
    npcGroup.add(torso)
    torsoRef.current = torso

    // Shirt Collar
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    const collar = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 4), shirtMat)
    collar.position.set(0, 0.62, 0.1)
    collar.rotation.x = Math.PI
    npcGroup.add(collar)

    // Red Silk Tie
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3, metalness: 0.2 })
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.02), tieMat)
    tie.position.set(0, 0.44, 0.155)
    npcGroup.add(tie)

    // Arms
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), suitMat)
    leftArm.position.set(-0.35, 0.3, 0.15)
    leftArm.rotation.x = Math.PI / 3
    leftArm.rotation.z = -0.3
    npcGroup.add(leftArm)

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), suitMat)
    rightArm.position.set(0.35, 0.3, 0.15)
    rightArm.rotation.x = Math.PI / 3
    rightArm.rotation.z = 0.3
    npcGroup.add(rightArm)

    // Head Group
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.75, 0)
    npcGroup.add(headGroup)
    headRef.current = headGroup

    // Neck
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 })
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 16), skinMat)
    neck.position.set(0, -0.04, 0)
    headGroup.add(neck)

    // Head Mesh
    const headGeo = new THREE.SphereGeometry(0.18, 20, 20)
    headGeo.scale(1, 1.25, 1)
    const head = new THREE.Mesh(headGeo, skinMat)
    head.position.set(0, 0.14, 0)
    head.castShadow = true
    headGroup.add(head)

    // Business Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), hairMat)
    hair.position.set(0, 0.22, -0.03)
    hair.scale.set(1.02, 1.15, 1.05)
    headGroup.add(hair)

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), eyeMat)
    leftEye.position.set(-0.065, 0.15, 0.165)
    headGroup.add(leftEye)
    leftEyeRef.current = leftEye

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), eyeMat)
    rightEye.position.set(0.065, 0.15, 0.165)
    headGroup.add(rightEye)
    rightEyeRef.current = rightEye

    // Executive Glasses Frame
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 })
    const glassesFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.015), glassesMat)
    glassesFrame.position.set(0, 0.15, 0.175)
    headGroup.add(glassesFrame)

    // Animated Mouth
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x991b1b })
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.01), mouthMat)
    mouth.position.set(0, -0.04, 0.17)
    headGroup.add(mouth)
    mouthRef.current = mouth

    // Boss Chair
    const bossChairBack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.1), chairMat)
    bossChairBack.position.set(0, 1.25, -0.9)
    bossChairBack.castShadow = true
    scene.add(bossChairBack)

    // 10. Resize Listener
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // 11. Mouse & Touch Direct Eye POV Drag Listeners
    const handlePointerDown = (e: MouseEvent) => {
      isPointerDown.current = true
      prevPointer.current = { x: e.clientX, y: e.clientY }
    }

    const handlePointerMove = (e: MouseEvent) => {
      if (!isPointerDown.current) return
      const dx = e.clientX - prevPointer.current.x
      const dy = e.clientY - prevPointer.current.y
      prevPointer.current = { x: e.clientX, y: e.clientY }

      if (viewMode === 'pov') {
        playerYaw.current -= dx * 0.0035
        playerPitch.current = Math.max(-1.1, Math.min(1.1, playerPitch.current - dy * 0.003))
      } else {
        manualOrbit.current.y += dx * 0.005
        manualOrbit.current.x = Math.max(-0.4, Math.min(0.4, manualOrbit.current.x + dy * 0.005))
      }
    }

    const handlePointerUp = () => {
      isPointerDown.current = false
    }

    container.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    // Touch Support
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isPointerDown.current = true
        prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!isPointerDown.current || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - prevPointer.current.x
      const dy = e.touches[0].clientY - prevPointer.current.y
      prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }

      if (viewMode === 'pov') {
        playerYaw.current -= dx * 0.004
        playerPitch.current = Math.max(-1.1, Math.min(1.1, playerPitch.current - dy * 0.0035))
      }
    }
    const handleTouchEnd = () => {
      isPointerDown.current = false
    }
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    // 12. Main 60FPS Game Loop with Delta-time Physics
    const clock = new THREE.Clock()
    let lastDistCheck = 0

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      const elapsedTime = clock.getElapsedTime()

      // A. Keyboard Movement & Sliding Collision (when in POV mode)
      if (viewMode === 'pov') {
        const isMoving =
          keysDown.current.w || keysDown.current.s || keysDown.current.a || keysDown.current.d

        if (isMoving) {
          const forwardX = -Math.sin(playerYaw.current)
          const forwardZ = -Math.cos(playerYaw.current)
          const rightX = Math.cos(playerYaw.current)
          const rightZ = -Math.sin(playerYaw.current)

          let vx = 0
          let vz = 0
          if (keysDown.current.w) {
            vx += forwardX
            vz += forwardZ
          }
          if (keysDown.current.s) {
            vx -= forwardX
            vz -= forwardZ
          }
          if (keysDown.current.a) {
            vx -= rightX
            vz -= rightZ
          }
          if (keysDown.current.d) {
            vx += rightX
            vz += rightZ
          }

          const len = Math.hypot(vx, vz)
          if (len > 0.001) {
            const speed = keysDown.current.shift ? 3.2 : 1.9
            const stepX = (vx / len) * speed * dt
            const stepZ = (vz / len) * speed * dt

            const nextX = Math.max(-3.5, Math.min(3.5, playerPos.current.x + stepX))
            const nextZ = Math.max(-2.5, Math.min(3.5, playerPos.current.z + stepZ))

            // Obstacle 1: Conference Table is x in [-1.35, 1.35], z in [-0.75, 0.75]
            const inTableX = nextX >= -1.35 && nextX <= 1.35
            const inTableZ = nextZ >= -0.75 && nextZ <= 0.75
            const currInTableX = playerPos.current.x >= -1.35 && playerPos.current.x <= 1.35
            const currInTableZ = playerPos.current.z >= -0.75 && playerPos.current.z <= 0.75

            // Slide collision test (allows smooth glide along table edges)
            if (!(inTableX && currInTableZ)) {
              playerPos.current.x = nextX
            }
            if (!(inTableZ && currInTableX)) {
              playerPos.current.z = nextZ
            }

            walkCycle.current += dt * (keysDown.current.shift ? 11 : 7)
          }
        }

        // Natural Walking Eye-Bobbing
        const targetEyeY = stance === 'standing' ? 1.65 : 1.38
        playerPos.current.y += (targetEyeY - playerPos.current.y) * 0.12
        const bobbing =
          stance === 'standing' && isMoving ? Math.sin(walkCycle.current) * 0.025 : 0
        const actualEyeY = playerPos.current.y + bobbing

        // Look Direction vector from direct eye perspective
        const lookDirX = -Math.sin(playerYaw.current) * Math.cos(playerPitch.current)
        const lookDirY = Math.sin(playerPitch.current)
        const lookDirZ = -Math.cos(playerYaw.current) * Math.cos(playerPitch.current)

        camera.position.set(playerPos.current.x, actualEyeY, playerPos.current.z)
        camera.lookAt(
          playerPos.current.x + lookDirX,
          actualEyeY + lookDirY,
          playerPos.current.z + lookDirZ
        )

        // Periodic distance to boss update
        if (elapsedTime - lastDistCheck > 0.15) {
          lastDistCheck = elapsedTime
          const dist = Math.hypot(playerPos.current.x - 0, playerPos.current.z - (-0.65))
          setDistToBoss(dist)
          const canTalk = dist <= 3.2
          setIsNearBoss(canTalk)
          if (onDistanceChange) onDistanceChange(dist, canTalk)
        }
      } else {
        // Other Preset Views (close or isometric)
        let targetCamX = 0
        let targetCamY = 1.6
        let targetCamZ = 1.2

        if (viewMode === 'isometric') {
          targetCamX = 1.9
          targetCamY = 2.1
          targetCamZ = 2.5
        }

        if (isRotating) {
          manualOrbit.current.y += 0.008
        }

        camera.position.x +=
          (targetCamX + Math.sin(manualOrbit.current.y) * 0.8 - camera.position.x) * 0.06
        camera.position.y += (targetCamY + manualOrbit.current.x - camera.position.y) * 0.06
        camera.position.z +=
          (targetCamZ + Math.cos(manualOrbit.current.y) * 0.8 - camera.position.z) * 0.06
        camera.lookAt(0, 1.3, -0.65)
      }

      // B. Boss Animations & Dynamic Real-Time Head Tracking
      // Idle Breathing
      if (torsoRef.current) {
        torsoRef.current.position.y = 0.35 + Math.sin(elapsedTime * 2.2) * 0.008
      }

      // Boss Head Tracks Player's Eyes Wherever Player Moves!
      if (headRef.current) {
        headRef.current.position.y = 0.75 + Math.sin(elapsedTime * 2.2) * 0.01

        const dx = camera.position.x - 0
        const dz = camera.position.z - (-0.65)
        const angleToPlayer = Math.atan2(dx, dz)
        // Anatomical neck limit (-75 to +75 degrees)
        const clampedAngle = Math.max(-1.3, Math.min(1.3, angleToPlayer))
        headRef.current.rotation.y += (clampedAngle - headRef.current.rotation.y) * 0.1

        const distXZ = Math.hypot(dx, dz)
        const dy = camera.position.y - 1.55
        const pitchToPlayer = Math.atan2(dy, distXZ)
        headRef.current.rotation.x += (-pitchToPlayer - headRef.current.rotation.x) * 0.1
      }

      // Talking Lipsync
      if (mouthRef.current) {
        if (isSpeaking) {
          mouthRef.current.scale.y = 1 + Math.abs(Math.sin(elapsedTime * 14)) * 3.5
        } else {
          mouthRef.current.scale.y = 1
        }
      }

      // Natural Eye Blinking
      if (leftEyeRef.current && rightEyeRef.current) {
        const blinkCycle = elapsedTime % 4.5
        if (blinkCycle > 4.35 && blinkCycle < 4.45) {
          leftEyeRef.current.scale.y = 0.1
          rightEyeRef.current.scale.y = 0.1
        } else {
          leftEyeRef.current.scale.y = 1
          rightEyeRef.current.scale.y = 1
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      container.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [viewMode, isRotating, stance, onDistanceChange])

  // Update mood lighting based on NPC emotion
  useEffect(() => {
    if (!moodLightRef.current) return
    if (npcEmotion === 'happy') {
      moodLightRef.current.color.setHex(0x10b981) // Emerald triumphant green
      moodLightRef.current.intensity = 1.8
    } else if (npcEmotion === 'thinking') {
      moodLightRef.current.color.setHex(0xf59e0b) // Amber warm gold
      moodLightRef.current.intensity = 1.2
    } else if (npcEmotion === 'strict') {
      moodLightRef.current.color.setHex(0xef4444) // Strict crimson
      moodLightRef.current.intensity = 1.5
    } else if (npcEmotion === 'surprised') {
      moodLightRef.current.color.setHex(0xa855f7) // Purple sparkle
      moodLightRef.current.intensity = 2.0
    } else {
      moodLightRef.current.color.setHex(0x38bdf8) // Professional cyan blue
      moodLightRef.current.intensity = 1.0
    }
  }, [npcEmotion])

  const handleToggleFullscreen = () => {
    if (onToggleNativeFullscreen) {
      onToggleNativeFullscreen()
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
        setIsNativeFs(true)
      } else {
        document.exitFullscreen().catch(() => {})
        setIsNativeFs(false)
      }
    }
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-950 select-none transition-all ${
        isFullScreenMode
          ? 'absolute inset-0 w-full h-full z-0'
          : 'h-[360px] sm:h-[440px] md:h-[500px] rounded-3xl border border-slate-700/80 shadow-2xl'
      }`}
    >
      {/* 3D WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-crosshair active:cursor-grabbing touch-none"
      />

      {/* Subtle First-Person Center Eye Reticle */}
      {viewMode === 'pov' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full border border-white/40 bg-white/20 backdrop-blur-sm" />
        </div>
      )}

      {/* Top 3D Game HUD */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow-lg transition-colors flex items-center gap-1.5"
            >
              <span>← Thoát</span>
            </button>
          )}

          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-white text-xs font-semibold shadow-lg flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="truncate max-w-[150px] sm:max-w-xs">{companyName}</span>
          </div>

          <div className="hidden md:flex px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-amber-300 text-xs font-bold shadow-lg items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {sessionType === 'interview' ? 'Phỏng vấn 3D' : 'Công sở 3D'} • Vòng {currentTurn}/
              {maxTurns}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Camera View Mode Selector */}
          <div className="flex items-center bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-full p-1 shadow-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('pov')}
              title="Góc nhìn mắt trực tiếp của ứng viên (First-Person POV)"
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-all ${
                viewMode === 'pov'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Góc nhìn mắt (POV)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('close')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                viewMode === 'close'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cận cảnh
            </button>
            <button
              type="button"
              onClick={() => setViewMode('isometric')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                viewMode === 'isometric'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Toàn cảnh
            </button>
          </div>

          {/* Auto Rotation Button for Orbit */}
          {viewMode !== 'pov' && (
            <button
              type="button"
              onClick={() => setIsRotating(!isRotating)}
              title="Tự động quay góc 3D"
              className={`p-2 rounded-full border shadow-lg backdrop-blur-md transition-colors ${
                isRotating
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Native Browser Fullscreen Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isNativeFs ? 'Thoát toàn màn hình' : 'Toàn màn hình 3D'}
            className="p-2 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white shadow-lg transition-colors"
          >
            {isNativeFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Floating 3D NPC Label Card (Boss) */}
      <div className="absolute top-16 left-4 sm:left-6 z-10 pointer-events-none">
        <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            👔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white drop-shadow">
                {npcName}
              </h4>
              {isSpeaking && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse font-semibold">
                  Đang nói...
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-amber-400 font-medium">
              {npcTitle}
            </p>
          </div>
        </div>
      </div>

      {/* Proximity & Eye Perspective Status Pill */}
      <div className="absolute top-16 right-4 sm:right-6 z-10 pointer-events-auto flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-xl text-xs font-bold transition-all ${
            isNearBoss
              ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/85 border-amber-500/40 text-amber-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isNearBoss ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>
            {isNearBoss
              ? `🟢 Trong cự ly trò chuyện: ${distToBoss.toFixed(1)}m`
              : `🚶 Đang dạo quanh phòng: ${distToBoss.toFixed(1)}m`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowControlsGuide(!showControlsGuide)}
          title="Hướng dẫn di chuyển góc nhìn mắt"
          className="p-1.5 rounded-full bg-slate-900/85 border border-slate-700 text-slate-300 hover:text-white"
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
        </button>
      </div>

      {/* Controls Guide Floating Box */}
      {showControlsGuide && viewMode === 'pov' && (
        <div className="absolute top-28 right-4 sm:right-6 z-20 max-w-xs p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-700/90 shadow-2xl text-xs text-slate-200 pointer-events-auto space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between font-bold text-amber-400 border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              Cách di chuyển góc nhìn mắt
            </span>
            <button
              type="button"
              onClick={() => setShowControlsGuide(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1 text-[11px] leading-relaxed">
            <p>
              🎮 <strong>Phím W / A / S / D</strong> hoặc <strong>Mũi tên</strong>: Đi tới, lùi, qua trái, qua phải.
            </p>
            <p>
              🖱️ <strong>Kéo chuột trên màn hình</strong>: Quay góc nhìn mắt 360° tự nhiên.
            </p>
            <p>
              🪑 <strong>Phím C</strong>: Đứng dậy đi dạo / Ngồi vào ghế đối diện sếp.
            </p>
            <p>
              🎯 <strong>Phím R</strong>: Lập tức hướng mắt nhìn thẳng vào Sếp.
            </p>
            <p>
              💬 <strong>Trò chuyện</strong>: Lại gần bàn để phỏng vấn & đàm thoại trực diện!
            </p>
          </div>
        </div>
      )}

      {/* Bottom-Left First-Person Movement & Stance Virtual Controller */}
      {viewMode === 'pov' && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 pointer-events-auto flex flex-col gap-2.5">
          {/* Quick Action Stance Buttons */}
          <div className="flex items-center gap-1.5">
            {stance === 'sitting' ? (
              <button
                type="button"
                onClick={handleStandUp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-lg transition-all"
              >
                <Footprints className="w-3.5 h-3.5 text-amber-400" />
                <span>🚶 Đứng dậy đi dạo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSitDown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>🪑 Ngồi vào bàn phỏng vấn</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetGaze}
              title="Hướng mắt nhìn thẳng vào Sếp"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium shadow-lg transition-all"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span>Nhìn Sếp</span>
            </button>
          </div>

          {/* Virtual On-Screen D-Pad (Touch & Mouse Click Friendly) */}
          <div className="p-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex flex-col items-center gap-1 w-[120px]">
            {/* Forward (W) */}
            <button
              type="button"
              onMouseDown={() => handleVirtualDirDown('w')}
              onMouseUp={() => handleVirtualDirUp('w')}
              onTouchStart={() => handleVirtualDirDown('w')}
              onTouchEnd={() => handleVirtualDirUp('w')}
              className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-amber-600 active:bg-amber-500 border border-slate-600 flex items-center justify-center text-white text-xs font-bold shadow transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            {/* Left (A), Backward (S), Right (D) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDown={() => handleVirtualDirDown('a')}
                onMouseUp={() => handleVirtualDirUp('a')}
                onTouchStart={() => handleVirtualDirDown('a')}
                onTouchEnd={() => handleVirtualDirUp('a')}
                className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-amber-600 active:bg-amber-500 border border-slate-600 flex items-center justify-center text-white text-xs font-bold shadow transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={() => handleVirtualDirDown('s')}
                onMouseUp={() => handleVirtualDirUp('s')}
                onTouchStart={() => handleVirtualDirDown('s')}
                onTouchEnd={() => handleVirtualDirUp('s')}
                className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-amber-600 active:bg-amber-500 border border-slate-600 flex items-center justify-center text-white text-xs font-bold shadow transition-colors"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={() => handleVirtualDirDown('d')}
                onMouseUp={() => handleVirtualDirUp('d')}
                onTouchStart={() => handleVirtualDirDown('d')}
                onTouchEnd={() => handleVirtualDirUp('d')}
                className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-amber-600 active:bg-amber-500 border border-slate-600 flex items-center justify-center text-white text-xs font-bold shadow transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Bấm giữ để bước đi</span>
          </div>
        </div>
      )}
    </div>
  )
}
export default InterviewRoom3D
