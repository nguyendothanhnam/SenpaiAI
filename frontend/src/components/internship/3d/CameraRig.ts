import * as THREE from 'three'

export type CameraView =
  | 'intro'
  | 'door_outside'
  | 'door_enter'
  | 'candidate_standing'
  | 'candidate_preview'
  | 'candidate'
  | 'pov'
  | 'close'
  | 'ots'
  | 'wide'
  | 'desk'
  | 'isometric'
  | 'exit_bow'

export interface CameraPreset {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

export class CameraRig {
  public camera: THREE.PerspectiveCamera
  private domElement?: HTMLElement
  private currentView: CameraView = 'intro'

  // Presets
  private presets: Record<CameraView, CameraPreset> = {
    intro: {
      position: new THREE.Vector3(0, 1.8, 4.6),
      target: new THREE.Vector3(0, 1.2, -1.0),
      fov: 52,
    },
    door_outside: {
      position: new THREE.Vector3(0.75, 1.62, 5.35), // Over-the-right-shoulder 3rd person view of candidate facing door
      target: new THREE.Vector3(0, 1.45, 3.8),
      fov: 48,
    },
    door_enter: {
      position: new THREE.Vector3(1.3, 1.55, 3.2), // Cinematic angle capturing candidate entering & closing door
      target: new THREE.Vector3(-0.1, 1.35, 3.5),
      fov: 50,
    },
    candidate_standing: {
      position: new THREE.Vector3(1.35, 1.55, 1.75), // 3/4 medium shot of candidate standing & bowing beside chair
      target: new THREE.Vector3(0.15, 1.25, 0.2),
      fov: 48,
    },
    candidate_preview: {
      position: new THREE.Vector3(1.8, 1.4, 4.05),
      target: new THREE.Vector3(0, 0.8, 4.5),
      fov: 48,
    },
    candidate: {
      position: new THREE.Vector3(1.75, 1.5, -0.1),
      target: new THREE.Vector3(0, 1.08, 1.1),
      fov: 48,
    },
    pov: {
      position: new THREE.Vector3(0, 1.36, 1.15), // Seated candidate eye level at table looking directly at NPC
      target: new THREE.Vector3(0, 1.28, -0.9),
      fov: 48,
    },
    close: {
      position: new THREE.Vector3(0.35, 1.35, 0.65), // Close perspective on interviewer
      target: new THREE.Vector3(0, 1.28, -0.9),
      fov: 42,
    },
    isometric: {
      position: new THREE.Vector3(2.8, 2.5, 2.9), // Wide cinematic isometric room overview
      target: new THREE.Vector3(0, 0.95, 0.1),
      fov: 46,
    },
    wide: {
      position: new THREE.Vector3(0, 1.45, 3.2),
      target: new THREE.Vector3(0, 1.1, -1.0),
      fov: 58,
    },
    ots: {
      position: new THREE.Vector3(-0.4, 1.25, 2.3),
      target: new THREE.Vector3(0.1, 1.15, -0.6),
      fov: 46,
    },
    desk: {
      position: new THREE.Vector3(0.2, 1.05, 1.5),
      target: new THREE.Vector3(0, 0.74, 1.1),
      fov: 42,
    },
    exit_bow: {
      position: new THREE.Vector3(0.75, 1.55, 2.1), // In-room view looking back at candidate bowing politely at door
      target: new THREE.Vector3(0, 1.35, 3.4),
      fov: 48,
    },
  }

  // Current interpolated state
  private currentPos = new THREE.Vector3(0, 1.8, 4.6)
  private currentTarget = new THREE.Vector3(0, 1.2, -1.0)
  private startPos = new THREE.Vector3(0, 1.8, 4.6)
  private startTarget = new THREE.Vector3(0, 1.2, -1.0)
  private targetPos = new THREE.Vector3(0, 1.38, 2.1)
  private lookAtTarget = new THREE.Vector3(0, 1.25, -1.0)

  // Transition & Interpolation
  private transitionProgress = 0
  private transitionDuration = 2.4
  private isTransitioning = true

  // Idle sway & breathing
  private elapsedTime = 0
  private idleSwayIntensity = 1.0

  // Manual Drag & Orbit offsets
  private manualYaw = 0
  private manualPitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private isPointerDown = false
  private prevPointer = { x: 0, y: 0 }
  private zoomOffset = 0
  private targetZoomOffset = 0

  // Event handlers for cleanup
  private onPointerDownBound: (e: PointerEvent) => void
  private onPointerMoveBound: (e: PointerEvent) => void
  private onPointerUpBound: (e: PointerEvent) => void
  private onWheelBound: (e: WheelEvent) => void

  constructor(camera: THREE.PerspectiveCamera, domElement?: HTMLElement) {
    this.camera = camera
    this.currentPos.copy(this.presets.intro.position)
    this.currentTarget.copy(this.presets.intro.target)
    this.targetPos.copy(this.presets.pov.position)
    this.lookAtTarget.copy(this.presets.pov.target)

    this.onPointerDownBound = this.onPointerDown.bind(this)
    this.onPointerMoveBound = this.onPointerMove.bind(this)
    this.onPointerUpBound = this.onPointerUp.bind(this)
    this.onWheelBound = this.onWheel.bind(this)

    if (domElement) {
      this.attach(domElement)
    }

    // Start with smooth intro dolly
    this.triggerIntroDolly()
  }

  public attach(domElement: HTMLElement): void {
    this.domElement = domElement
    domElement.addEventListener('pointerdown', this.onPointerDownBound)
    window.addEventListener('pointermove', this.onPointerMoveBound)
    window.addEventListener('pointerup', this.onPointerUpBound)
    domElement.addEventListener('wheel', this.onWheelBound, { passive: true })
  }

  public triggerIntroDolly(): void {
    this.currentView = 'intro'
    this.currentPos.copy(this.presets.intro.position)
    this.currentTarget.copy(this.presets.intro.target)
    this.startPos.copy(this.presets.intro.position)
    this.startTarget.copy(this.presets.intro.target)
    this.targetPos.copy(this.presets.pov.position)
    this.lookAtTarget.copy(this.presets.pov.target)
    this.transitionDuration = 2.6
    this.transitionProgress = 0
    this.isTransitioning = true
  }

  public setView(view: CameraView, duration: number = 1.2): void {
    this.currentView = view
    const preset = this.presets[view]

    this.startPos.copy(this.currentPos)
    this.startTarget.copy(this.currentTarget)
    this.targetPos.copy(preset.position)
    this.lookAtTarget.copy(preset.target)
    this.transitionDuration = Math.max(duration, 0.1)
    this.transitionProgress = 0
    this.isTransitioning = true

    // Reset manual rotation offsets gently
    this.targetYaw = 0
    this.targetPitch = 0
    this.targetZoomOffset = 0
  }

  public getView(): CameraView {
    return this.currentView
  }

  public update(dt: number): void {
    this.elapsedTime += dt

    // 1. Position & Target Interpolation (Custom Hermite/Smoothstep Easing, Zero external GSAP)
    if (this.isTransitioning) {
      this.transitionProgress += dt / this.transitionDuration
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0
        this.isTransitioning = false
        this.currentPos.copy(this.targetPos)
        this.currentTarget.copy(this.lookAtTarget)
      } else {
        // Smooth Hermite smoothstep factor: 3t^2 - 2t^3
        const t = this.transitionProgress
        const ease = t * t * (3 - 2 * t)
        this.currentPos.lerpVectors(this.startPos, this.targetPos, ease)
        this.currentTarget.lerpVectors(this.startTarget, this.lookAtTarget, ease)
      }
    } else {
      // Gentle follow to target
      this.currentPos.lerp(this.targetPos, Math.min(dt * 6.0, 1.0))
      this.currentTarget.lerp(this.lookAtTarget, Math.min(dt * 6.0, 1.0))
    }

    // 2. Manual interaction smoothing
    this.manualYaw = THREE.MathUtils.lerp(this.manualYaw, this.targetYaw, Math.min(dt * 8.0, 1.0))
    this.manualPitch = THREE.MathUtils.lerp(this.manualPitch, this.targetPitch, Math.min(dt * 8.0, 1.0))
    this.zoomOffset = THREE.MathUtils.lerp(this.zoomOffset, this.targetZoomOffset, Math.min(dt * 6.0, 1.0))

    // 3. Subtle human breathing & idle sway: sin(t * 0.4) * 0.02
    const swayX = Math.sin(this.elapsedTime * 0.42) * 0.016 * this.idleSwayIntensity
    const swayY = Math.cos(this.elapsedTime * 0.32) * 0.009 * this.idleSwayIntensity

    // 4. Combine into final camera position and orientation
    const posX = this.currentPos.x + swayX
    const posY = this.currentPos.y + swayY + this.manualPitch * 0.4
    const posZ = this.currentPos.z + this.zoomOffset

    // Rotate position around target based on manualYaw
    const radius = Math.sqrt(
      (posX - this.currentTarget.x) ** 2 + (posZ - this.currentTarget.z) ** 2
    )
    const baseAngle = Math.atan2(posX - this.currentTarget.x, posZ - this.currentTarget.z)
    const finalAngle = baseAngle + this.manualYaw

    this.camera.position.set(
      this.currentTarget.x + Math.sin(finalAngle) * radius,
      posY,
      this.currentTarget.z + Math.cos(finalAngle) * radius
    )

    this.camera.lookAt(
      this.currentTarget.x,
      this.currentTarget.y + this.manualPitch * 0.25,
      this.currentTarget.z
    )
  }

  // Pointer event listeners
  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return // Left click or touch only
    this.isPointerDown = true
    this.prevPointer = { x: e.clientX, y: e.clientY }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown) return
    const dx = e.clientX - this.prevPointer.x
    const dy = e.clientY - this.prevPointer.y
    this.prevPointer = { x: e.clientX, y: e.clientY }

    // Clamp manual rotation to realistic bounds (-0.35 to 0.35 rad)
    this.targetYaw = THREE.MathUtils.clamp(this.targetYaw - dx * 0.004, -0.4, 0.4)
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy * 0.003, -0.2, 0.25)
  }

  private onPointerUp(): void {
    this.isPointerDown = false
  }

  private onWheel(e: WheelEvent): void {
    // Clamp zoom offset (-0.6m to +0.8m)
    this.targetZoomOffset = THREE.MathUtils.clamp(
      this.targetZoomOffset + e.deltaY * 0.0015,
      -0.6,
      0.8
    )
  }

  public dispose(): void {
    if (this.domElement) {
      this.domElement.removeEventListener('pointerdown', this.onPointerDownBound)
      this.domElement.removeEventListener('wheel', this.onWheelBound)
    }
    window.removeEventListener('pointermove', this.onPointerMoveBound)
    window.removeEventListener('pointerup', this.onPointerUpBound)
  }
}
