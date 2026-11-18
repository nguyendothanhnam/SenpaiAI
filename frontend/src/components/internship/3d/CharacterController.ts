import * as THREE from 'three'

export type NPCAnimationState = 'idle' | 'talking' | 'nod' | 'bow' | 'pleased' | 'thinking'

export interface CharacterJoints {
  root: THREE.Group
  torso: THREE.Group
  chest: THREE.Mesh
  neck: THREE.Group
  head: THREE.Group
  leftEye: THREE.Mesh
  rightEye: THREE.Mesh
  mouth: THREE.Mesh
  leftArm: THREE.Group
  rightArm: THREE.Group
  leftForearm: THREE.Group
  rightForearm: THREE.Group
  glasses?: THREE.Group
}

export class CharacterController {
  public joints: CharacterJoints
  private currentState: NPCAnimationState = 'idle'
  private stateProgress = 0
  private stateDuration = 0
  private isOneShot = false
  private elapsedTime = 0

  // Blinking timer
  private nextBlinkTime = 2.5
  private isBlinking = false
  private blinkProgress = 0

  // Crossfade weights for smooth transition
  private targetWeights: Record<NPCAnimationState, number> = {
    idle: 1.0,
    talking: 0.0,
    nod: 0.0,
    bow: 0.0,
    pleased: 0.0,
    thinking: 0.0,
  }
  private currentWeights: Record<NPCAnimationState, number> = {
    idle: 1.0,
    talking: 0.0,
    nod: 0.0,
    bow: 0.0,
    pleased: 0.0,
    thinking: 0.0,
  }

  constructor(joints: CharacterJoints) {
    this.joints = joints
  }

  public play(state: NPCAnimationState, duration?: number): void {
    if (this.currentState === state && !this.isOneShot) return

    this.currentState = state
    this.stateProgress = 0

    // Set weights for crossfading
    for (const key of Object.keys(this.targetWeights) as NPCAnimationState[]) {
      this.targetWeights[key] = key === state ? 1.0 : 0.0
    }

    if (state === 'nod') {
      this.isOneShot = true
      this.stateDuration = duration || 1.3
    } else if (state === 'bow') {
      this.isOneShot = true
      this.stateDuration = duration || 2.0
    } else if (state === 'pleased') {
      this.isOneShot = true
      this.stateDuration = duration || 1.8
    } else if (state === 'thinking') {
      this.isOneShot = true
      this.stateDuration = duration || 2.2
    } else {
      this.isOneShot = false
      this.stateDuration = 0
    }
  }

  public setSpeaking(speaking: boolean): void {
    if (speaking && this.currentState !== 'talking') {
      this.play('talking')
    } else if (!speaking && this.currentState === 'talking') {
      this.play('idle')
    }
  }

  public triggerReaction(emotion: string): void {
    switch (emotion) {
      case 'happy':
        this.play('pleased')
        break
      case 'thinking':
      case 'strict':
        this.play('thinking')
        break
      case 'surprised':
        this.play('nod')
        break
      default:
        this.play('idle')
        break
    }
  }

  public triggerBow(): void {
    this.play('bow', 2.2)
  }

  public triggerNod(): void {
    this.play('nod', 1.4)
  }

  public update(dt: number): void {
    this.elapsedTime += dt

    // 1. Crossfade animation weights (0.25s smooth blend)
    const blendSpeed = Math.min(dt * 4.0, 1.0)
    for (const key of Object.keys(this.currentWeights) as NPCAnimationState[]) {
      this.currentWeights[key] = THREE.MathUtils.lerp(
        this.currentWeights[key],
        this.targetWeights[key],
        blendSpeed
      )
    }

    // 2. Handle one-shot action progression and return to idle
    if (this.isOneShot) {
      this.stateProgress += dt
      if (this.stateProgress >= this.stateDuration) {
        this.isOneShot = false
        this.play('idle')
      }
    }

    // 3. Natural Eye Blinking logic (every 2.5 - 4.5 seconds)
    if (!this.isBlinking && this.elapsedTime > this.nextBlinkTime) {
      this.isBlinking = true
      this.blinkProgress = 0
      this.nextBlinkTime = this.elapsedTime + 2.5 + Math.random() * 2.5
    }

    if (this.isBlinking) {
      this.blinkProgress += dt * 9.0 // Blink takes ~0.11s
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false
        this.joints.leftEye.scale.y = 1.0
        this.joints.rightEye.scale.y = 1.0
      } else {
        // Fast eyelid dip
        const blinkFactor = Math.sin(this.blinkProgress * Math.PI)
        const eyeScale = THREE.MathUtils.lerp(1.0, 0.08, blinkFactor)
        this.joints.leftEye.scale.y = eyeScale
        this.joints.rightEye.scale.y = eyeScale
      }
    }

    // 4. Procedural Bone & Joint Kinematics
    const { torso, neck, head, mouth, leftArm, rightArm, leftForearm, rightForearm } = this.joints

    // Base Reset values
    let torsoRotX = 0
    let torsoRotY = 0
    let neckRotX = 0
    let headRotX = 0
    let headRotY = 0
    let headRotZ = 0
    let mouthScaleY = 0.2
    let leftArmRotX = 0.5
    let rightArmRotX = 0.5
    let leftForearmRotX = 0.8
    let rightForearmRotX = 0.8

    // --- IDLE STATE: Gentle chest breathing & micro head motion ---
    const breath = Math.sin(this.elapsedTime * 1.8) * 0.015
    const headMicroSway = Math.sin(this.elapsedTime * 0.6) * 0.02
    this.joints.chest.scale.set(1.0 + breath * 0.5, 1.0 + breath, 1.0 + breath * 0.5)

    headRotX += Math.sin(this.elapsedTime * 0.9) * 0.012
    headRotY += headMicroSway

    // --- TALKING STATE: Mouth movement & expressive business gesturing ---
    const talkW = this.currentWeights.talking
    if (talkW > 0.001) {
      // Natural speech rhythm with modulated pauses
      const speechPhase = Math.sin(this.elapsedTime * 14.0) * Math.cos(this.elapsedTime * 4.0)
      mouthScaleY += Math.max(0, speechPhase) * 1.4 * talkW
      headRotX += Math.sin(this.elapsedTime * 6.5) * 0.035 * talkW
      headRotY += Math.cos(this.elapsedTime * 3.2) * 0.04 * talkW

      // Forearm gestures
      rightForearmRotX += Math.sin(this.elapsedTime * 5.0) * 0.15 * talkW
      leftForearmRotX += Math.cos(this.elapsedTime * 4.2) * 0.08 * talkW
    }

    // --- NOD STATE: Affirmative agreement nod ---
    const nodW = this.currentWeights.nod
    if (nodW > 0.001) {
      const nodT = (this.stateProgress / (this.stateDuration || 1.4)) * Math.PI * 2.0
      const nodMotion = Math.sin(nodT * 2.0) * (1.0 - this.stateProgress / this.stateDuration)
      headRotX += Math.max(0, nodMotion) * 0.28 * nodW
      neckRotX += Math.max(0, nodMotion) * 0.12 * nodW
    }

    // --- BOW (OJIGI) STATE: Formal Japanese Bow ---
    const bowW = this.currentWeights.bow
    if (bowW > 0.001) {
      const progress = Math.min(this.stateProgress / (this.stateDuration || 2.0), 1.0)
      // Bell-shaped bow curve: down smoothly, hold briefly, return politely
      let bowFactor = 0
      if (progress < 0.4) {
        // Bow down
        bowFactor = THREE.MathUtils.smoothstep(progress, 0, 0.4)
      } else if (progress < 0.65) {
        // Hold bow respectful
        bowFactor = 1.0
      } else {
        // Return up
        bowFactor = 1.0 - THREE.MathUtils.smoothstep(progress, 0.65, 1.0)
      }

      torsoRotX += bowFactor * 0.48 * bowW // 28-30 degrees polite Ojigi
      neckRotX += bowFactor * 0.15 * bowW
      headRotX += bowFactor * 0.12 * bowW
      // Hands placed firmly on desk during bow
      leftForearmRotX += bowFactor * 0.2 * bowW
      rightForearmRotX += bowFactor * 0.2 * bowW
    }

    // --- PLEASED STATE: Warm approving smile and nod ---
    const pleasedW = this.currentWeights.pleased
    if (pleasedW > 0.001) {
      const pleasedT = Math.sin((this.stateProgress / (this.stateDuration || 1.8)) * Math.PI)
      headRotX += -pleasedT * 0.08 * pleasedW // slight chin lift
      headRotZ += Math.sin(this.elapsedTime * 2.0) * 0.03 * pleasedW
      mouthScaleY += 0.4 * pleasedT * pleasedW
    }

    // --- THINKING STATE: Pensive consideration tilt ---
    const thinkW = this.currentWeights.thinking
    if (thinkW > 0.001) {
      const thinkT = Math.sin((this.stateProgress / (this.stateDuration || 2.2)) * Math.PI)
      headRotZ += 0.12 * thinkT * thinkW // tilt to side
      headRotY += -0.09 * thinkT * thinkW
      neckRotX += 0.06 * thinkT * thinkW
      rightForearmRotX += 0.25 * thinkT * thinkW
    }

    // 5. Apply rotations smoothly
    torso.rotation.x = torsoRotX
    torso.rotation.y = torsoRotY

    neck.rotation.x = neckRotX

    head.rotation.x = headRotX
    head.rotation.y = headRotY
    head.rotation.z = headRotZ

    mouth.scale.y = mouthScaleY

    leftArm.rotation.x = leftArmRotX
    rightArm.rotation.x = rightArmRotX
    leftForearm.rotation.x = leftForearmRotX
    rightForearm.rotation.x = rightForearmRotX
  }
}
