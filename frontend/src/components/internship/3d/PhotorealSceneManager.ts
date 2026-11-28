import * as THREE from 'three'
import { eventBridge } from './EventBridge'
import { QualityManager } from './QualityManager'

export interface PhotorealSceneOptions {
  container: HTMLElement
  npcName: string
  npcTitle: string
  companyName: string
  industryId?: string
}

export type ArchvizCameraView =
  | 'pov'
  | 'ots'
  | 'wide'
  | 'desk'
  | 'door_outside'
  | 'candidate_preview'
  | 'candidate'
  | 'candidate_standing'
  | 'door_enter'
  | 'exit_bow'
  | 'close'
  | 'closeup'

/**
 * PhotorealSceneManager: Architectural Visualization (ArchViz) Engine.
 * Principles:
 * 1. Single Unified Plate per Camera Angle: The seated Japanese executive, conference table,
 *    room perspective, and natural lighting are unified in ONE photorealistic plate.
 *    ZERO billboard cutouts, zero mismatched edges or hovering 2D sprites.
 * 2. 4 Calibrated Angles: POV (Seated), OTS (Over-the-shoulder), Wide (Full room), Desk (Close-up).
 * 3. Screen-Space Perspective Parallax Shader with normalized 8-bit depth maps.
 * 4. Micro-dolly, subtle lens breathing, and ACES Filmic Tone Mapping.
 * 5. Full Japanese interview etiquette stage support (Knock, Enter, Bow, Sit, Exit).
 */
export class PhotorealSceneManager {
  private container: HTMLElement
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer
  public qualityManager: QualityManager
  public industryId: string = 'it'
  public companyName: string = '株式会社ネクステック'
  public npcName: string = '高橋 健一'
  public npcTitle: string = 'CTO / 面接官'

  // Clock & Animation Loop
  private clock = new THREE.Clock()
  private animFrameId: number | null = null
  private isRunning = true

  // Depth-Parallax Shader Quad
  private parallaxMaterial?: THREE.ShaderMaterial
  private parallaxMesh?: THREE.Mesh
  private mouseTarget = new THREE.Vector2(0, 0)
  private mouseCurrent = new THREE.Vector2(0, 0)
  private parallaxIntensity = 0.022

  // Texture Cache for All Unified Angles & Stages
  private textures: Record<string, THREE.Texture> = {}
  public currentAngle: string = 'pov'
  public currentStage: string = 'outside_door'
  public isSpeaking = false
  private speechMicroDrift = 0

  // Camera Dolly & Micro-Motion
  public currentCameraView: ArchvizCameraView = 'pov'
  private targetCameraPos = new THREE.Vector3(0, 0, 1.8)
  private currentCameraLookAt = new THREE.Vector3(0, 0, 0)
  private targetCameraLookAt = new THREE.Vector3(0, 0, 0)
  private baseFov = 46

  // Disposables & Events
  private eventUnbinders: (() => void)[] = []
  private resizeObserver?: ResizeObserver

  constructor(options: PhotorealSceneOptions) {
    this.container = options.container
    this.industryId = options.industryId || 'it'
    this.companyName = options.companyName || '株式会社ネクステック'
    this.npcName = options.npcName || '高橋 健一'
    this.npcTitle = options.npcTitle || 'CTO / 面接官'

    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight

    // 1. Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0f1d)

    // 2. Camera (Cinematic 50mm FOV, near 0.1, far 50)
    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.1, 50)
    this.camera.position.set(0, 0, 1.8)

    // 3. Quality & Renderer
    this.qualityManager = new QualityManager()

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.04

    this.container.appendChild(this.renderer.domElement)

    // 4. Preload Unified Plates & Init Shader Quad
    this.preloadTextures()
    this.initParallaxShader(width, height)

    // 5. Events & Mouse Parallax
    this.setupParallaxEvents()
    this.setupEventBridge()

    // 6. Start Loop
    this.startLoop()
  }

  // --- 1. PRELOAD TEXTURES FOR INSTANT SMOOTH CROSS-FADE ---
  private preloadTextures(): void {
    const texLoader = new THREE.TextureLoader()

    const loadTex = (key: string, url: string, isColor: boolean = true) => {
      this.textures[key] = texLoader.load(url, (tex) => {
        if (isColor) {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.minFilter = THREE.LinearMipmapLinearFilter
          tex.generateMipmaps = true
        }
      })
    }

    // Angle 1: Seated POV
    loadTex('pov_color', '/archviz/room_executive_pov.webp', true)
    loadTex('pov_depth', '/archviz/room_executive_depth.webp', false)

    // Angle 2: Over-The-Shoulder (OTS)
    loadTex('ots_color', '/archviz/room_executive_ots.webp', true)
    loadTex('ots_depth', '/archviz/room_executive_ots_depth.webp', false)

    // Angle 3: Wide Boardroom
    loadTex('wide_color', '/archviz/room_executive_wide.webp', true)
    loadTex('wide_depth', '/archviz/room_executive_wide_depth.webp', false)

    // Angle 4: Desk Close-up
    loadTex('desk_color', '/archviz/room_executive_desk.webp', true)
    loadTex('desk_depth', '/archviz/room_executive_desk_depth.webp', false)

    // Stage: Hallway Door
    loadTex('hallway_color', '/archviz/hallway_door.webp', true)
    loadTex('hallway_depth', '/archviz/hallway_door_depth.webp', false)

    // Stage: Exit Door
    loadTex('exit_color', '/archviz/exit_door.webp', true)
    loadTex('exit_depth', '/archviz/hallway_door_depth.webp', false)
  }

  // --- 2. SCREEN-SPACE PERSPECTIVE PARALLAX SHADER ---
  private initParallaxShader(width: number, height: number): void {
    const initColor = this.textures['hallway_color'] || this.textures['pov_color']
    const initDepth = this.textures['hallway_depth'] || this.textures['pov_depth']

    this.parallaxMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: initColor },
        tDepth: { value: initDepth },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uParallaxIntensity: { value: this.parallaxIntensity },
        uFocusDepth: { value: 0.58 }, // Focus plane on conference table
        uAspect: { value: width / height },
        uDollyZoom: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.999, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uMouse;
        uniform float uParallaxIntensity;
        uniform float uFocusDepth;
        uniform float uAspect;
        uniform float uDollyZoom;
        varying vec2 vUv;

        void main() {
          // Sample calibrated depth map
          float depth = texture2D(tDepth, vUv).r;
          
          // Screen-space perspective displacement
          vec2 parallaxOffset = uMouse * (depth - uFocusDepth) * uParallaxIntensity;
          parallaxOffset.x /= uAspect;

          // Apply subtle micro-dolly zoom from center
          vec2 centeredUv = (vUv - 0.5) * uDollyZoom + 0.5;
          vec2 sampleUv = clamp(centeredUv + parallaxOffset, vec2(0.001), vec2(0.999));
          vec4 sceneColor = texture2D(tColor, sampleUv);

          // Subtle optical cinematic vignette
          vec2 coord = (vUv - 0.5) * vec2(uAspect, 1.0);
          float dist = length(coord);
          float vignette = smoothstep(1.08, 0.44, dist);

          // Delicate natural film grain (prevents 8-bit banding on dark wood)
          float grain = (fract(sin(dot(vUv * 500.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.01;

          gl_FragColor = vec4(sceneColor.rgb * vignette + grain, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false,
    })

    const quadGeo = new THREE.PlaneGeometry(2, 2)
    this.parallaxMesh = new THREE.Mesh(quadGeo, this.parallaxMaterial)
    this.scene.add(this.parallaxMesh)
  }

  // --- 3. UNIFIED ANGLE SWITCHING (Cross-fade textures) ---
  public setAnglePlate(angleKey: 'pov' | 'ots' | 'wide' | 'desk' | 'hallway' | 'exit'): void {
    if (!this.parallaxMaterial) return
    this.currentAngle = angleKey

    const colorTex = this.textures[`${angleKey}_color`]
    const depthTex = this.textures[`${angleKey}_depth`]

    if (colorTex) {
      this.parallaxMaterial.uniforms.tColor.value = colorTex
    }
    if (depthTex) {
      this.parallaxMaterial.uniforms.tDepth.value = depthTex
    }

    // Set focal parallax intensity tuned per angle
    if (angleKey === 'desk') {
      this.parallaxIntensity = 0.035
      this.parallaxMaterial.uniforms.uFocusDepth.value = 0.8
    } else if (angleKey === 'wide') {
      this.parallaxIntensity = 0.018
      this.parallaxMaterial.uniforms.uFocusDepth.value = 0.45
    } else if (angleKey === 'ots') {
      this.parallaxIntensity = 0.026
      this.parallaxMaterial.uniforms.uFocusDepth.value = 0.55
    } else {
      // 'pov'
      this.parallaxIntensity = 0.022
      this.parallaxMaterial.uniforms.uFocusDepth.value = 0.58
    }
    this.parallaxMaterial.uniforms.uParallaxIntensity.value = this.parallaxIntensity
  }

  // --- 4. CAMERA VIEW CONTROLLER ---
  public setCameraView(view: ArchvizCameraView | string): void {
    this.currentCameraView = view as ArchvizCameraView

    if (view === 'door_outside' || view === 'candidate_preview') {
      this.setEtiquetteStage('outside_door')
    } else if (view === 'door_enter' || view === 'candidate_standing') {
      this.setEtiquetteStage('standing_chair')
    } else if (view === 'exit_bow') {
      this.setEtiquetteStage('exit_door')
    } else if (view === 'ots') {
      this.setAnglePlate('ots')
      this.targetCameraPos.set(0.04, 0, 1.76)
    } else if (view === 'wide') {
      this.setAnglePlate('wide')
      this.targetCameraPos.set(0, 0.02, 1.95)
    } else if (view === 'desk') {
      this.setAnglePlate('desk')
      this.targetCameraPos.set(0, -0.06, 1.62)
    } else if (view === 'close' || view === 'closeup') {
      this.setAnglePlate('pov')
      this.targetCameraPos.set(0, 0, 1.55)
    } else {
      // Default POV
      this.setAnglePlate('pov')
      this.targetCameraPos.set(0, 0, 1.8)
    }
  }

  // --- 5. ETIQUETTE STAGE CONTROLLER ---
  public setEtiquetteStage(stage: string): void {
    this.currentStage = stage

    if (
      stage === 'dress_check' ||
      stage === 'outside_door' ||
      stage === 'knocking'
    ) {
      // Outside hallway door view
      this.setAnglePlate('hallway')
      this.targetCameraPos.set(0, 0, 1.8)
    } else if (
      stage === 'door_opened' ||
      stage === 'standing_chair' ||
      stage === 'waiting_sit'
    ) {
      // Standing eye-level inside room
      this.setAnglePlate('pov')
      this.targetCameraPos.set(0, 0.12, 1.95)
    } else if (
      stage === 'exit_standing' ||
      stage === 'exit_door' ||
      stage === 'etiquette_mastered'
    ) {
      // Exit door view
      this.setAnglePlate('exit')
      this.targetCameraPos.set(0, 0, 1.8)
    } else {
      // Standard seated interview
      this.setAnglePlate('pov')
      this.targetCameraPos.set(0, 0, 1.8)
    }
  }

  // --- 6. CULTURAL GESTURES (Camera micro-motions) ---
  public triggerCandidateKnock(): void {
    // 3 subtle rhythmic camera vibration impulses
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.targetCameraPos.x = i % 2 === 0 ? 0.015 : -0.015
        setTimeout(() => {
          this.targetCameraPos.x = 0
        }, 80)
      }, i * 260)
    }
  }

  public triggerCandidateBow(_angle = 38, duration = 2.0): void {
    const origY = this.targetCameraPos.y
    this.targetCameraPos.y -= 0.15
    setTimeout(() => {
      this.targetCameraPos.y = origY
    }, duration * 450)
  }

  public triggerBow(): void {
    this.triggerCandidateBow(38, 2.0)
  }

  public triggerNod(): void {
    const origY = this.targetCameraPos.y
    this.targetCameraPos.y -= 0.04
    setTimeout(() => {
      this.targetCameraPos.y = origY
    }, 380)
  }

  public setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking
  }

  // Polymorphic API compatibility for existing parent hooks
  public cameraRig = {
    setView: (mode: string, _duration?: number) => {
      this.setCameraView(mode)
    },
  }

  public characterController = {
    triggerBow: () => this.triggerBow(),
    triggerNod: () => this.triggerNod(),
  }

  public setCandidateStance(stance: string): void {
    if (stance === 'outside') this.setEtiquetteStage('outside_door')
    else if (stance === 'doorway') this.setEtiquetteStage('door_opened')
    else if (stance === 'standing_chair') this.setEtiquetteStage('standing_chair')
    else if (stance === 'seated') this.setEtiquetteStage('sitting_interview')
    else if (stance === 'exit') this.setEtiquetteStage('exit_door')
  }

  public setCandidateGender(_gender: string): void {}
  public setDoorOpen(_isOpen: boolean): void {}
  public triggerCandidateCloseDoor(_isReverse?: boolean, onDone?: () => void): void {
    if (onDone) setTimeout(onDone, 500)
  }

  // --- 7. MOUSE & SENSOR PARALLAX ---
  private setupParallaxEvents(): void {
    const onMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      this.mouseTarget.set(x, y)
    }

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1)
        const y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1)
        this.mouseTarget.set(x, y)
      }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true })

    this.eventUnbinders.push(() => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('deviceorientation', onDeviceOrientation)
    })

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize()
    })
    this.resizeObserver.observe(this.container)
  }

  private setupEventBridge(): void {
    const unsubSpeakingStart = eventBridge.on('npc_speaking_start', () => {
      this.setSpeaking(true)
    })
    const unsubSpeakingEnd = eventBridge.on('npc_speaking_end', () => {
      this.setSpeaking(false)
    })
    const unsubCamera = eventBridge.on('camera_view_changed', (data: { mode: string }) => {
      this.setCameraView(data.mode)
    })

    this.eventUnbinders.push(unsubSpeakingStart, unsubSpeakingEnd, unsubCamera)
  }

  private handleResize(): void {
    if (!this.container || !this.renderer) return
    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)

    if (this.parallaxMaterial) {
      this.parallaxMaterial.uniforms.uAspect.value = width / height
    }
  }

  // --- 8. ANIMATION LOOP ---
  private startLoop(): void {
    const animate = () => {
      if (!this.isRunning) return
      this.animFrameId = requestAnimationFrame(animate)

      const delta = this.clock.getDelta()

      // Smooth lerp on mouse parallax
      this.mouseCurrent.lerp(this.mouseTarget, 0.055)
      if (this.parallaxMaterial) {
        this.parallaxMaterial.uniforms.uMouse.value.copy(this.mouseCurrent)
      }

      // Camera position interpolation
      this.camera.position.lerp(this.targetCameraPos, 0.06)
      this.currentCameraLookAt.lerp(this.targetCameraLookAt, 0.06)
      this.camera.lookAt(this.currentCameraLookAt)

      // Subtle organic breathing micro-drift when interviewer is speaking
      if (this.isSpeaking && this.parallaxMaterial) {
        this.speechMicroDrift += delta * 1.5
        const microZoom = 1.0 + Math.sin(this.speechMicroDrift) * 0.002
        this.parallaxMaterial.uniforms.uDollyZoom.value = microZoom
      } else if (this.parallaxMaterial) {
        this.parallaxMaterial.uniforms.uDollyZoom.value = 1.0
      }

      this.renderer.render(this.scene, this.camera)
    }

    this.animFrameId = requestAnimationFrame(animate)
  }

  // --- 9. DISPOSE ---
  public dispose(): void {
    this.isRunning = false
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    this.eventUnbinders.forEach((unsub) => unsub())
    this.eventUnbinders = []

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    Object.values(this.textures).forEach((tex) => tex.dispose())
    this.textures = {}

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else if (obj.material) {
          obj.material.dispose()
        }
      }
    })

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
