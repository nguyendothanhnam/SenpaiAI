import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Maximize2, Minimize2, RotateCcw, Sparkles } from 'lucide-react'

interface InterviewRoom3DProps {
  npcName: string
  npcTitle: string
  npcEmotion?: 'neutral' | 'happy' | 'thinking' | 'surprised' | 'strict'
  companyName: string
  isSpeaking?: boolean
  sessionType: 'interview' | 'workplace'
  currentTurn: number
  maxTurns: number
}

type CameraViewMode = 'front' | 'isometric' | 'close'

export const InterviewRoom3D: React.FC<InterviewRoom3DProps> = ({
  npcName,
  npcTitle,
  npcEmotion = 'neutral',
  companyName,
  isSpeaking = false,
  sessionType,
  currentTurn,
  maxTurns,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [viewMode, setViewMode] = useState<CameraViewMode>('front')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  // References to keep across re-renders
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

  // Mouse parallax state
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const isMouseDown = useRef(false)
  const previousMousePosition = useRef({ x: 0, y: 0 })
  const manualRotation = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 450

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a) // Deep slate navy
    scene.fog = new THREE.FogExp2(0x0f172a, 0.04)
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 1.45, 2.3)
    camera.lookAt(0, 1.25, 0)
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
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.7)
    scene.add(ambientLight)

    // Main Overhead Boardroom Light
    const ceilingLight = new THREE.DirectionalLight(0xffffff, 1.2)
    ceilingLight.position.set(0, 4, 1)
    ceilingLight.castShadow = true
    ceilingLight.shadow.mapSize.width = 1024
    ceilingLight.shadow.mapSize.height = 1024
    ceilingLight.shadow.camera.near = 0.5
    ceilingLight.shadow.camera.far = 10
    ceilingLight.shadow.bias = -0.001
    scene.add(ceilingLight)

    // Tokyo Window Sunlight
    const windowLight = new THREE.DirectionalLight(0x93c5fd, 0.9)
    windowLight.position.set(-3, 3, -4)
    scene.add(windowLight)

    // Mood Point Light (reacts to emotion)
    const moodLight = new THREE.PointLight(0xf59e0b, 1.0, 5)
    moodLight.position.set(0, 1.8, 0.5)
    scene.add(moodLight)
    moodLightRef.current = moodLight

    // 5. Procedural Textures & Materials
    // Create Tokyo Skyline texture for panoramic window
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 1024
    skyCanvas.height = 512
    const sCtx = skyCanvas.getContext('2d')
    if (sCtx) {
      // Sky gradient: Tokyo dusk / sunset
      const grad = sCtx.createLinearGradient(0, 0, 0, 512)
      grad.addColorStop(0, '#0284c7')
      grad.addColorStop(0.4, '#f59e0b')
      grad.addColorStop(0.7, '#ea580c')
      grad.addColorStop(1, '#0f172a')
      sCtx.fillStyle = grad
      sCtx.fillRect(0, 0, 1024, 512)

      // Silhouette of Tokyo Skyscrapers
      sCtx.fillStyle = '#090d16'
      for (let x = 0; x < 1024; x += 30) {
        const bHeight = 150 + Math.sin(x * 0.05) * 80 + Math.random() * 50
        const bWidth = 20 + Math.random() * 25
        sCtx.fillRect(x, 512 - bHeight, bWidth, bHeight)

        // Windows dots
        sCtx.fillStyle = '#fef08a'
        for (let wy = 512 - bHeight + 10; wy < 510; wy += 12) {
          if (Math.random() > 0.4) {
            sCtx.fillRect(x + 4, wy, 3, 3)
            sCtx.fillRect(x + 12, wy, 3, 3)
          }
        }
        sCtx.fillStyle = '#090d16'
      }

      // Tokyo Tower silhouette in the distance
      sCtx.fillStyle = '#dc2626'
      sCtx.beginPath()
      sCtx.moveTo(680, 512 - 280)
      sCtx.lineTo(670, 512)
      sCtx.lineTo(690, 512)
      sCtx.fill()
    }
    const skyTexture = new THREE.CanvasTexture(skyCanvas)

    // Wood Floor Material
    const floorGeo = new THREE.PlaneGeometry(10, 10)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.2,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Back Wall with Tokyo Window
    const backWallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.2), backWallMat)
    backWall.position.set(0, 2.5, -3)
    scene.add(backWall)

    // Large Tokyo Skyline Window
    const windowFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 2.8),
      new THREE.MeshBasicMaterial({ map: skyTexture })
    )
    windowFrame.position.set(0, 2.5, -2.88)
    scene.add(windowFrame)

    // Window Mullions (Japanese Office Glass Grids)
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.05), mullionMat)
    hBar.position.set(0, 2.5, -2.85)
    scene.add(hBar)

    const vBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.8, 0.05), mullionMat)
    vBar1.position.set(-1.5, 2.5, -2.85)
    scene.add(vBar1)

    const vBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.8, 0.05), mullionMat)
    vBar2.position.set(1.5, 2.5, -2.85)
    scene.add(vBar2)

    // Side Walls
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 8), backWallMat)
    leftWall.position.set(-5, 2.5, 0)
    scene.add(leftWall)

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 8), backWallMat)
    rightWall.position.set(5, 2.5, 0)
    scene.add(rightWall)

    // Decorative Japanese Shoji Screen Accent on Left Wall
    const shojiGeo = new THREE.PlaneGeometry(0.05, 3, 2)
    const shojiMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    const shoji = new THREE.Mesh(shojiGeo, shojiMat)
    shoji.position.set(-4.88, 2.2, -1)
    scene.add(shoji)

    // 6. Executive Boardroom Conference Table
    const tableTopGeo = new THREE.BoxGeometry(2.4, 0.08, 1.2)
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314, // Polished dark mahogany
      roughness: 0.2,
      metalness: 0.15,
    })
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat)
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
    // Laptop
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

    // Ceramic Japanese Green Tea Cup
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.1 })
    )
    cup.position.set(0.65, 0.94, -0.1)
    cup.castShadow = true
    scene.add(cup)

    // Document CV Folder
    const docFolder = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.01, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    )
    docFolder.position.set(0, 0.9, -0.1)
    docFolder.castShadow = true
    scene.add(docFolder)

    // 7. Full Procedural 3D Japanese Business NPC Character
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

    // White Shirt Collar
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

    // Arms resting on desk
    const armMat = suitMat
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), armMat)
    leftArm.position.set(-0.35, 0.3, 0.15)
    leftArm.rotation.x = Math.PI / 3
    leftArm.rotation.z = -0.3
    npcGroup.add(leftArm)

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), armMat)
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

    // Head Head Sphere
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), skinMat)
    headMesh.castShadow = true
    headGroup.add(headMesh)

    // Japanese Styled Business Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 })
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 20), hairMat)
    hair.position.set(0, 0.04, -0.02)
    hair.scale.set(1.02, 1.05, 1.05)
    headGroup.add(hair)

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b })
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), eyeMat)
    leftEye.position.set(-0.065, 0.015, 0.165)
    headGroup.add(leftEye)
    leftEyeRef.current = leftEye

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), eyeMat)
    rightEye.position.set(0.065, 0.015, 0.165)
    headGroup.add(rightEye)
    rightEyeRef.current = rightEye

    // Business Glasses Frame
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 })
    const lFrame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 20), glassesMat)
    lFrame.position.set(-0.065, 0.015, 0.17)
    headGroup.add(lFrame)

    const rFrame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 20), glassesMat)
    rFrame.position.set(0.065, 0.015, 0.17)
    headGroup.add(rFrame)

    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05), glassesMat)
    bridge.rotation.z = Math.PI / 2
    bridge.position.set(0, 0.025, 0.175)
    headGroup.add(bridge)

    // Animated Mouth Mesh
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x991b1b })
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.01), mouthMat)
    mouth.position.set(0, -0.08, 0.17)
    headGroup.add(mouth)
    mouthRef.current = mouth

    // Executive Chair Behind NPC
    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.8, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    )
    chairBack.position.set(0, 1.25, -0.9)
    chairBack.castShadow = true
    scene.add(chairBack)

    // 8. Event Handlers (Mouse Parallax & Resize)
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      mouseRef.current.targetX = x * 0.4
      mouseRef.current.targetY = y * 0.25

      if (isMouseDown.current) {
        const deltaX = e.clientX - previousMousePosition.current.x
        const deltaY = e.clientY - previousMousePosition.current.y
        manualRotation.current.y += deltaX * 0.005
        manualRotation.current.x = Math.max(-0.3, Math.min(0.3, manualRotation.current.x + deltaY * 0.005))
        previousMousePosition.current = { x: e.clientX, y: e.clientY }
      }
    }

    const handleMouseDownEvt = (e: MouseEvent) => {
      isMouseDown.current = true
      previousMousePosition.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUpEvt = () => {
      isMouseDown.current = false
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mousedown', handleMouseDownEvt)
    window.addEventListener('mouseup', handleMouseUpEvt)

    // 9. Animation Loop
    let clock = new THREE.Clock()

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // Smooth mouse parallax interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05

      // Breathing idle motion
      if (torsoRef.current) {
        torsoRef.current.position.y = 0.35 + Math.sin(elapsedTime * 2.2) * 0.008
      }

      // Head Animation: breathing + subtle nodding + mouse tracking
      if (headRef.current) {
        headRef.current.position.y = 0.75 + Math.sin(elapsedTime * 2.2) * 0.012
        headRef.current.rotation.y = Math.sin(elapsedTime * 0.8) * 0.04 + mouseRef.current.x * 0.3
        headRef.current.rotation.x = Math.cos(elapsedTime * 1.5) * 0.02 - mouseRef.current.y * 0.2
      }

      // Talking mouth animation when speaking
      if (mouthRef.current) {
        if (isSpeaking) {
          mouthRef.current.scale.y = 1 + Math.abs(Math.sin(elapsedTime * 14)) * 3.5
        } else {
          mouthRef.current.scale.y = 1
        }
      }

      // Periodic natural eye blinking
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

      // Camera Position by View Mode with smooth lerp
      let targetCamX = 0
      let targetCamY = 1.45
      let targetCamZ = 2.3

      if (viewMode === 'close') {
        targetCamX = 0
        targetCamY = 1.6
        targetCamZ = 1.2
      } else if (viewMode === 'isometric') {
        targetCamX = 1.8
        targetCamY = 2.0
        targetCamZ = 2.4
      }

      // Add auto-rotation if toggled
      if (isRotating) {
        manualRotation.current.y += 0.008
      }

      // Apply parallax and manual rotation to camera
      camera.position.x += (targetCamX + mouseRef.current.x + Math.sin(manualRotation.current.y) * 0.8 - camera.position.x) * 0.06
      camera.position.y += (targetCamY + mouseRef.current.y + manualRotation.current.x - camera.position.y) * 0.06
      camera.position.z += (targetCamZ + Math.cos(manualRotation.current.y) * 0.8 - camera.position.z) * 0.06
      camera.lookAt(0, 1.3, -0.4)

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mousedown', handleMouseDownEvt)
      window.removeEventListener('mouseup', handleMouseUpEvt)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [viewMode, isRotating])

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

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950 select-none transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[360px] sm:h-[440px] md:h-[500px]'
      }`}
    >
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top 3D Game HUD */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white text-xs font-semibold shadow-lg flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="truncate max-w-[150px] sm:max-w-xs">{companyName}</span>
          </div>

          <div className="hidden sm:flex px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-amber-300 text-xs font-bold shadow-lg items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {sessionType === 'interview' ? 'Phỏng vấn 3D' : 'Công sở 3D'} • Vòng {currentTurn}/{maxTurns}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Camera View Switcher */}
          <div className="flex items-center bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-full p-1 shadow-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('front')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                viewMode === 'front'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chính diện
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

          {/* Auto Rotation Button */}
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

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình 3D'}
            className="p-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white shadow-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Floating 3D NPC Label Card */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            👔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white drop-shadow">
                {npcName}
              </h4>
              {isSpeaking && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse font-semibold">
                  Đang nói...
                </span>
              )}
            </div>
            <p className="text-xs text-amber-400 font-medium">
              {npcTitle}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Right 3D Controls Hint */}
      <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-slate-400 pointer-events-none">
        <span>🖱️ Kéo chuột để xoay phòng 360° • Di chuột tạo hiệu ứng chiều sâu</span>
      </div>
    </div>
  )
}
export default InterviewRoom3D
