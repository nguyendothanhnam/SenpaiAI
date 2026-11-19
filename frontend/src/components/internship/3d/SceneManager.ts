import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { CharacterController, type CharacterJoints } from './CharacterController'
import { QualityManager, type QualityConfig } from './QualityManager'
import { eventBridge } from './EventBridge'
import { createCandidateAppearance } from './CandidateAppearance'

export interface SceneManagerOptions {
  container: HTMLElement
  npcName: string
  npcTitle: string
  companyName: string
  industryId?: string
}

export class SceneManager {
  private container: HTMLElement
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer
  public cameraRig: CameraRig
  public qualityManager: QualityManager
  public characterController: CharacterController
  public industryId: string = 'it'

  // Lighting
  private hemiLight: THREE.HemisphereLight
  private sunLight: THREE.DirectionalLight
  private faceLight: THREE.PointLight

  // Clock & Loop
  private clock = new THREE.Clock()
  private animFrameId: number | null = null
  private isRunning = true
  private isTabVisible = true

  // Entrance Door & South Wall
  private doorPivot?: THREE.Group
  private targetDoorAngle = 0
  private isDoorOpen = false

  // Candidate Avatar & Animation
  private candidateGroup?: THREE.Group
  private candidateTorso?: THREE.Group
  private candidateHead?: THREE.Group
  private candidateNeck?: THREE.Group
  private candidateLeftArm?: THREE.Group
  private candidateRightArm?: THREE.Group
  private candidateLeftForearm?: THREE.Group
  private candidateRightForearm?: THREE.Group
  private candidateLeftLeg?: THREE.Group
  private candidateRightLeg?: THREE.Group
  private candidateLeftShin?: THREE.Group
  private candidateRightShin?: THREE.Group
  private candidatePositionTarget = new THREE.Vector3(0, 0, 4.5)
  private candidateRotationTarget = Math.PI
  private targetTorsoY = 0.72
  private isCandidateBowing = false
  private candidateBowProgress = 0
  private candidateBowDuration = 2.0
  private candidateBowAngle = 0.65 // ~37 degrees Keirei
  private isCandidateKnocking = false
  private candidateKnockProgress = 0
  private candidateKnockDuration = 1.3
  private candidateGender: 'male' | 'female' = 'male'
  private candidateTieMesh?: THREE.Mesh
  private candidateHairMesh?: THREE.Mesh
  private candidateAppearance?: ReturnType<typeof createCandidateAppearance>

  // Candidate Walking & Sitting Animation
  private walkPhase = 0
  private isCandidateWalking = false
  private sittingProgress = 0 // 0 = standing, 1 = sitting
  private targetSittingProgress = 0

  // Candidate Door Closing Action
  private isCandidateClosingDoor = false
  private candidateCloseDoorProgress = 0
  private candidateCloseDoorDuration = 2.0
  private candidateCloseDoorInside = true
  private onCloseDoorComplete?: () => void

  // Props & Meshes to clean
  private disposableTextures: THREE.Texture[] = []
  private eventUnbinders: (() => void)[] = []
  private resizeObserver?: ResizeObserver

  constructor(options: SceneManagerOptions) {
    this.container = options.container
    this.industryId = options.industryId || 'it'
    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight

    // 1. Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xf1f5f9) // Soft airy daylight tone

    // 2. Camera (FOV 50, near 0.1, far 60)
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 60)

    // 3. Quality Manager
    this.qualityManager = new QualityManager()
    const qConfig = this.qualityManager.getConfig()

    // 4. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: qConfig.level !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(qConfig.pixelRatio)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = qConfig.toneMapping
    this.renderer.toneMappingExposure = 1.05

    if (qConfig.shadows) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    this.container.appendChild(this.renderer.domElement)

    // 5. Camera Rig
    this.cameraRig = new CameraRig(this.camera, this.renderer.domElement)

    // 6. Lighting (Warm Japanese Daylight Room)
    this.hemiLight = new THREE.HemisphereLight(0xfff5ea, 0x8c827a, 0.95)
    this.scene.add(this.hemiLight)

    this.sunLight = new THREE.DirectionalLight(0xffe2be, 2.2)
    this.sunLight.position.set(4.5, 7.5, 3.5)
    this.sunLight.castShadow = qConfig.shadows
    this.sunLight.shadow.mapSize.set(qConfig.shadowMapSize, qConfig.shadowMapSize)
    this.sunLight.shadow.camera.near = 0.5
    this.sunLight.shadow.camera.far = 25
    this.sunLight.shadow.camera.left = -6
    this.sunLight.shadow.camera.right = 6
    this.sunLight.shadow.camera.top = 6
    this.sunLight.shadow.camera.bottom = -6
    this.sunLight.shadow.bias = -0.0005
    this.scene.add(this.sunLight)

    // Gentle facial fill light for NPC
    this.faceLight = new THREE.PointLight(0xfff0dd, 0.65, 5)
    this.faceLight.position.set(0, 1.6, 0.2)
    this.scene.add(this.faceLight)

    // 7. Build Scene Geometry
    this.buildRoomEnvironment(options.companyName)
    this.buildCandidateAvatar()
    const joints = this.buildStylizedNPC(options.npcName, options.npcTitle)
    this.characterController = new CharacterController(joints)

    // 8. Event Listeners (Resize, Tab Visibility, WebGL Context)
    this.setupLifecycleEvents()

    // 9. Subscribe to EventBridge
    this.setupEventBridge()

    // 10. Start Animation Loop
    this.startLoop()
  }

  private setupLifecycleEvents(): void {
    // Window Resize Observer
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          this.camera.aspect = width / height
          this.camera.updateProjectionMatrix()
          this.renderer.setSize(width, height)
        }
      }
    })
    this.resizeObserver.observe(this.container)

    // Tab visibility handling (pause loop when hidden)
    const handleVisibilityChange = () => {
      this.isTabVisible = document.visibilityState === 'visible'
      if (this.isTabVisible && this.isRunning && this.animFrameId === null) {
        this.clock.start()
        this.startLoop()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // WebGL Context Lost & Restored
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      console.warn('[SceneManager] WebGL Context Lost! Freezing loop.')
      this.stopLoop()
    })

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.info('[SceneManager] WebGL Context Restored! Reinitializing.')
      this.startLoop()
    })
  }

  private setupEventBridge(): void {
    this.eventUnbinders.push(
      eventBridge.on('npc_speaking_start', () => {
        this.characterController.setSpeaking(true)
      }),
      eventBridge.on('npc_speaking_end', () => {
        this.characterController.setSpeaking(false)
      }),
      eventBridge.on('score_received', (payload: any) => {
        if (payload?.emotion) {
          this.characterController.triggerReaction(payload.emotion)
        } else {
          const manner = payload?.manner || 80
          if (manner >= 85) {
            this.characterController.play('pleased')
          } else if (manner < 65) {
            this.characterController.play('thinking')
          } else {
            this.characterController.triggerNod()
          }
        }
      }),
      eventBridge.on('camera_view_changed', (payload: any) => {
        if (payload?.mode) {
          this.cameraRig.setView(payload.mode)
          if (this.candidateGroup) {
            this.candidateGroup.visible = payload.mode !== 'pov'
          }
        }
      }),
      eventBridge.on('door_open', () => {
        this.setDoorOpen(true)
      }),
      eventBridge.on('door_close', () => {
        this.setDoorOpen(false)
      }),
      eventBridge.on('candidate_bow', () => {
        this.triggerCandidateBow(38, 2.0)
      }),
      eventBridge.on('candidate_knock', () => {
        this.triggerCandidateKnock()
      }),
      eventBridge.on('skip_to_interview', () => {
        this.setDoorOpen(false)
        this.setCandidateStance('seated')
        this.cameraRig.setView('pov')
      }),
      eventBridge.on('quality_changed', (payload: any) => {
        if (payload?.level) {
          this.qualityManager.setQuality(payload.level)
          this.applyQualityConfig(this.qualityManager.getConfig())
        }
      })
    )
  }

  private applyQualityConfig(config: QualityConfig): void {
    this.renderer.setPixelRatio(config.pixelRatio)
    this.renderer.toneMapping = config.toneMapping
    this.sunLight.castShadow = config.shadows
    this.renderer.shadowMap.enabled = config.shadows
    if (config.shadows) {
      this.sunLight.shadow.mapSize.set(config.shadowMapSize, config.shadowMapSize)
    }
  }

  // --- 3D ENVIRONMENT CREATION ---
  private buildRoomEnvironment(companyName: string): void {
    const ind = this.industryId || 'it'

    // 1. Color and material palette per industry
    let floorColor = 0x8a5a36
    let floorRoughness = 0.55
    let floorMetalness = 0.05
    let wallColor = 0xf1f5f9
    let tableColor = 0xb45309
    let tableRoughness = 0.4
    let tableMetalness = 0.1

    if (ind === 'it') {
      floorColor = 0x334155 // Modern slate tile
      floorRoughness = 0.45
      wallColor = 0xf8fafc // Clean tech off-white
      tableColor = 0x0f172a // Dark sleek tech table
      tableRoughness = 0.3
      tableMetalness = 0.2
    } else if (ind === 'hospitality') {
      floorColor = 0xc5b47a // Woven Tatami straw green-gold
      floorRoughness = 0.8
      wallColor = 0xf5ebd9 // Traditional Kyomachiya plaster
      tableColor = 0x78350f // Dark Japanese Hinoki cypress
      tableRoughness = 0.6
      tableMetalness = 0.0
    } else if (ind === 'kaigo') {
      floorColor = 0xdfb48c // Warm natural birch / light oak
      floorRoughness = 0.45
      wallColor = 0xfff7ed // Gentle warm sakura blush
      tableColor = 0xd97706 // Friendly honey oak table
      tableRoughness = 0.4
      tableMetalness = 0.05
    } else if (ind === 'engineering') {
      floorColor = 0x475569 // Heavy industrial concrete slate
      floorRoughness = 0.7
      wallColor = 0xe2e8f0 // Cool blueprint studio grey
      tableColor = 0x92400e // Sturdy heavy-duty drafting table
      tableRoughness = 0.5
      tableMetalness = 0.1
    } else if (ind === 'manufacturing') {
      floorColor = 0x166534 // High-gloss factory green epoxy floor
      floorRoughness = 0.22
      floorMetalness = 0.15
      wallColor = 0xf8fafc // Cleanroom bright white
      tableColor = 0x334155 // Precision composite inspection table
      tableRoughness = 0.3
      tableMetalness = 0.25
    } else if (ind === 'business') {
      floorColor = 0x1e293b // Deep royal navy executive carpet
      floorRoughness = 0.9
      wallColor = 0x451a03 // Rich dark mahogany wood paneling
      tableColor = 0x3b0764 // High-gloss luxury mahogany boardroom table
      tableRoughness = 0.15
      tableMetalness = 0.2
    }

    // Floor Mesh
    const floorGeo = new THREE.PlaneGeometry(8, 9)
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: floorRoughness,
      metalness: floorMetalness,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Tatami Border Ribbons for Hospitality (Traditional Kyoto Ryokan)
    if (ind === 'hospitality') {
      const tatamiBorderMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.7 })
      const borderLines = [
        [-2.0, 0, 4.0, 0.03],
        [2.0, 0, 4.0, 0.03],
        [0, -1.5, 0.03, 5.0],
        [0, 1.5, 0.03, 5.0],
        [-2.0, -1.5, 0.03, 3.0],
        [2.0, 1.5, 0.03, 3.0],
      ]
      borderLines.forEach(([x, z, w, d]) => {
        const border = new THREE.Mesh(new THREE.BoxGeometry(w, 0.003, d), tatamiBorderMat)
        border.position.set(x, 0.002, z)
        this.scene.add(border)
      })
    }

    // Walls (North, West, East, South)
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.85,
    })

    // Back Wall (Behind NPC) with large window cutout
    const backWallGroup = new THREE.Group()
    backWallGroup.position.set(0, 1.6, -3.5)

    // Left & Right pillar walls
    const pillarGeo = new THREE.BoxGeometry(1.6, 3.2, 0.2)
    const leftPillar = new THREE.Mesh(pillarGeo, wallMat)
    leftPillar.position.set(-2.8, 0, 0)
    leftPillar.receiveShadow = true
    backWallGroup.add(leftPillar)

    const rightPillar = new THREE.Mesh(pillarGeo, wallMat)
    rightPillar.position.set(2.8, 0, 0)
    rightPillar.receiveShadow = true
    backWallGroup.add(rightPillar)

    // Industry accents on pillars
    if (ind === 'hospitality') {
      // Dark cedar timber beams on pillars
      const cedarMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.6 })
      const leftBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.22), cedarMat)
      leftBeam.position.set(-2.0, 0, 0)
      backWallGroup.add(leftBeam)
      const rightBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.22), cedarMat)
      rightBeam.position.set(2.0, 0, 0)
      backWallGroup.add(rightBeam)
    } else if (ind === 'engineering') {
      // Exposed structural steel I-beam
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
      const steelBeam = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 0.24), steelMat)
      steelBeam.position.set(0, 1.55, 0.02)
      backWallGroup.add(steelBeam)
    } else if (ind === 'business') {
      // Polished brass trim molding
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 })
      const brassTrim = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 0.22), brassMat)
      brassTrim.position.set(0, -0.75, 0.01)
      backWallGroup.add(brassTrim)
    }

    // Top Header & Bottom Wall below window
    const headerGeo = new THREE.BoxGeometry(4.0, 0.6, 0.2)
    const headerWall = new THREE.Mesh(headerGeo, wallMat)
    headerWall.position.set(0, 1.3, 0)
    headerWall.receiveShadow = true
    backWallGroup.add(headerWall)

    const bottomGeo = new THREE.BoxGeometry(4.0, 0.8, 0.2)
    const bottomWall = new THREE.Mesh(bottomGeo, wallMat)
    bottomWall.position.set(0, -1.2, 0)
    bottomWall.receiveShadow = true
    backWallGroup.add(bottomWall)

    // Glass Window Pane
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.35,
    })
    const glassGeo = new THREE.PlaneGeometry(3.9, 1.8)
    const glass = new THREE.Mesh(glassGeo, glassMat)
    glass.position.set(0, 0.1, -0.05)
    backWallGroup.add(glass)

    // Distant Backdrop Window Texture per Industry
    const skylineTex = this.createBackdropTexture(ind)
    this.disposableTextures.push(skylineTex)
    const backdropGeo = new THREE.PlaneGeometry(12, 6)
    const backdropMat = new THREE.MeshBasicMaterial({ map: skylineTex })
    const backdrop = new THREE.Mesh(backdropGeo, backdropMat)
    backdrop.position.set(0, 1.8, -4.5)
    this.scene.add(backdrop)

    this.scene.add(backWallGroup)

    // Side Walls
    const sideWallGeo = new THREE.BoxGeometry(0.2, 3.2, 8)
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat)
    leftWall.position.set(-3.9, 1.6, 0.5)
    leftWall.receiveShadow = true
    this.scene.add(leftWall)

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat)
    rightWall.position.set(3.9, 1.6, 0.5)
    rightWall.receiveShadow = true
    this.scene.add(rightWall)

    // Left Wall Artwork / Board tailored to the Industry
    const wallArtwork = this.createWallArtwork(ind, companyName)
    this.scene.add(wallArtwork)

    // Wall Clock
    const clockGroup = new THREE.Group()
    clockGroup.position.set(3.75, 2.2, -0.8)
    clockGroup.rotation.y = -Math.PI / 2
    const clockFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
    )
    clockFrame.rotation.x = Math.PI / 2
    clockGroup.add(clockFrame)
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    clockFace.position.z = 0.026
    clockGroup.add(clockFace)

    // Clock Hands (10:00 - Standard Corporate Interview Time)
    const clockHandMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, 0.005), clockHandMat)
    hourHand.position.set(-0.038, 0.038, 0.028)
    hourHand.rotation.z = Math.PI / 4
    clockGroup.add(hourHand)

    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.005), clockHandMat)
    minuteHand.position.set(0, 0.075, 0.029)
    clockGroup.add(minuteHand)

    const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16), clockHandMat)
    centerPin.rotation.x = Math.PI / 2
    centerPin.position.z = 0.03
    clockGroup.add(centerPin)
    this.scene.add(clockGroup)

    // Main Meeting Table
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 1.1),
      new THREE.MeshStandardMaterial({
        color: tableColor,
        roughness: tableRoughness,
        metalness: tableMetalness,
      })
    )
    tableTop.position.set(0, 0.74, 0.1)
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    this.scene.add(tableTop)

    // Table Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.74, 16)
    const legPositions = [
      [-0.95, 0.37, -0.42],
      [0.95, 0.37, -0.42],
      [-0.95, 0.37, 0.42],
      [0.95, 0.37, 0.42],
    ]
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(x, y, z)
      leg.castShadow = true
      this.scene.add(leg)
    })

    // Industry Specific Table Props (Laptop, Teapot, Hard Hat, Gear Box, Leather Folio, etc.)
    const tablePropsGroup = this.createTableProps(ind, companyName)
    this.scene.add(tablePropsGroup)

    // Potted Office Plant / Ikebana / Bonsai
    const plantGroup = new THREE.Group()
    plantGroup.position.set(2.4, 0, -2.4)
    const potMat = new THREE.MeshStandardMaterial({
      color: ind === 'hospitality' ? 0x292524 : 0xffffff,
      roughness: 0.3,
    })
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.18, 0.45, 16),
      potMat
    )
    pot.position.y = 0.225
    pot.castShadow = true
    plantGroup.add(pot)

    const leavesMat = new THREE.MeshStandardMaterial({
      color: ind === 'kaigo' ? 0xf43f5e : ind === 'hospitality' ? 0x15803d : 0x16a34a,
      roughness: 0.6,
    })
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.08), leavesMat)
      leaf.position.set(
        (Math.random() - 0.5) * 0.28,
        0.48 + i * 0.1,
        (Math.random() - 0.5) * 0.28
      )
      leaf.castShadow = true
      plantGroup.add(leaf)
    }
    this.scene.add(plantGroup)

    // Candidate Chair (Front of table)
    const candChair = this.createErgonomicChair()
    candChair.position.set(0, 0, 1.1)
    candChair.rotation.y = Math.PI
    this.scene.add(candChair)

    // South Wall & Entrance Door (z = 3.8)
    const southWallGroup = new THREE.Group()
    southWallGroup.position.set(0, 0, 3.8)

    // Left wall segment (x from -3.9 to -0.6)
    const southLeftWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.2, 0.2), wallMat)
    southLeftWall.position.set(-2.25, 1.6, 0)
    southLeftWall.receiveShadow = true
    southWallGroup.add(southLeftWall)

    // Right wall segment (x from 0.6 to 3.9)
    const southRightWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.2, 0.2), wallMat)
    southRightWall.position.set(2.25, 1.6, 0)
    southRightWall.receiveShadow = true
    southWallGroup.add(southRightWall)

    // Header wall above doorway (y from 2.3 to 3.2)
    const southHeaderWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.2), wallMat)
    southHeaderWall.position.set(0, 2.75, 0)
    southHeaderWall.receiveShadow = true
    southWallGroup.add(southHeaderWall)

    // Doorway Frame (Dark architectural timber)
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.24), doorFrameMat)
    leftPost.position.set(-0.6, 1.15, 0)
    southWallGroup.add(leftPost)

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.24), doorFrameMat)
    rightPost.position.set(0.6, 1.15, 0)
    southWallGroup.add(rightPost)

    const topPost = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 0.24), doorFrameMat)
    topPost.position.set(0, 2.3, 0)
    southWallGroup.add(topPost)

    // Outside Hallway Corridor Floor (z = 3.8 to 6.2)
    const hallwayFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    )
    hallwayFloor.rotation.x = -Math.PI / 2
    hallwayFloor.position.set(0, 0.002, 5.3)
    this.scene.add(hallwayFloor)

    // Corridor ceiling light outside
    const corridorLight = new THREE.PointLight(0xfff3e0, 0.75, 6)
    corridorLight.position.set(0, 2.6, 4.6)
    this.scene.add(corridorLight)

    // Entrance Door (Hinged pivot at x = -0.57)
    this.doorPivot = new THREE.Group()
    this.doorPivot.position.set(-0.57, 0, 0)

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x7c2d12, // Rich Japanese architectural cedar / walnut
      roughness: 0.45,
      metalness: 0.05,
    })
    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(1.14, 2.26, 0.05), doorMat)
    doorSlab.position.set(0.57, 1.13, 0)
    doorSlab.castShadow = true
    doorSlab.receiveShadow = true
    this.doorPivot.add(doorSlab)

    // Inset Panels
    const insetMat = new THREE.MeshStandardMaterial({ color: 0x5a1e0b, roughness: 0.5 })
    const topInset = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.056), insetMat)
    topInset.position.set(0.57, 1.55, 0)
    this.doorPivot.add(topInset)

    const botInset = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.056), insetMat)
    botInset.position.set(0.57, 0.6, 0)
    this.doorPivot.add(botInset)

    // Dual Silver Lever Handles (Outside + Inside)
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
    const handleBaseOut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16), chromeMat)
    handleBaseOut.rotation.x = Math.PI / 2
    handleBaseOut.position.set(1.0, 1.05, 0.035)
    this.doorPivot.add(handleBaseOut)

    const leverOut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), chromeMat)
    leverOut.position.set(0.95, 1.05, 0.05)
    this.doorPivot.add(leverOut)

    const handleBaseIn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16), chromeMat)
    handleBaseIn.rotation.x = Math.PI / 2
    handleBaseIn.position.set(1.0, 1.05, -0.035)
    this.doorPivot.add(handleBaseIn)

    const leverIn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), chromeMat)
    leverIn.position.set(0.95, 1.05, -0.05)
    this.doorPivot.add(leverIn)

    // Japanese Signboard on Door Outside: 「面接室」 (Interview Room)
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 256
    signCanvas.height = 128
    const sCtx = signCanvas.getContext('2d')
    if (sCtx) {
      sCtx.fillStyle = '#f8fafc'
      sCtx.fillRect(0, 0, 256, 128)
      sCtx.strokeStyle = '#334155'
      sCtx.lineWidth = 8
      sCtx.strokeRect(4, 4, 248, 120)

      sCtx.fillStyle = '#0f172a'
      sCtx.font = 'bold 36px sans-serif'
      sCtx.textAlign = 'center'
      sCtx.fillText('面 接 室', 128, 58)

      sCtx.fillStyle = '#64748b'
      sCtx.font = 'bold 15px sans-serif'
      sCtx.fillText('INTERVIEW ROOM', 128, 92)
    }
    const signTex = new THREE.CanvasTexture(signCanvas)
    this.disposableTextures.push(signTex)
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.015),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
    )
    signMesh.position.set(0.57, 1.6, 0.035)
    this.doorPivot.add(signMesh)

    southWallGroup.add(this.doorPivot)
    this.scene.add(southWallGroup)
  }

  private createBackdropTexture(ind: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.CanvasTexture(canvas)

    if (ind === 'hospitality') {
      // Kyoto Twilight / Dawn Mist & Pagoda Silhouette & Sakura
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#99f6e4')
      skyGrad.addColorStop(0.35, '#fed7aa')
      skyGrad.addColorStop(0.7, '#fbcfe8')
      skyGrad.addColorStop(1, '#ffedd5')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      // Distant Higashiyama mountains
      ctx.fillStyle = '#64748b'
      ctx.beginPath()
      ctx.moveTo(0, 180)
      ctx.bezierCurveTo(90, 150, 170, 170, 260, 140)
      ctx.bezierCurveTo(340, 120, 430, 160, 512, 150)
      ctx.lineTo(512, 256)
      ctx.lineTo(0, 256)
      ctx.fill()

      // Traditional 5-Story Kyoto Pagoda (五重塔)
      ctx.fillStyle = '#334155'
      const px = 140
      const py = 120
      for (let i = 0; i < 5; i++) {
        const rw = 44 - i * 5
        const ry = py + i * 16
        ctx.fillRect(px - rw / 2, ry, rw, 4)
        ctx.fillRect(px - (rw - 10) / 2, ry + 4, rw - 10, 12)
      }
      ctx.fillRect(px - 2, py - 20, 4, 20)

      // Sakura Branch with Blossoms
      ctx.strokeStyle = '#451a03'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(512, 30)
      ctx.quadraticCurveTo(420, 50, 360, 90)
      ctx.stroke()

      ctx.fillStyle = '#f472b6'
      const petals = [
        [370, 85], [355, 95], [380, 100], [420, 45], [440, 35],
        [400, 60], [460, 55], [330, 110], [315, 125], [340, 130]
      ]
      petals.forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    } else if (ind === 'kaigo') {
      // Sunny Osaka Green Park with Cherry Blossom Trees
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#38bdf8')
      skyGrad.addColorStop(0.65, '#e0f2fe')
      skyGrad.addColorStop(1, '#fef9c3')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      // Green rolling lawn
      ctx.fillStyle = '#4ade80'
      ctx.beginPath()
      ctx.moveTo(0, 190)
      ctx.bezierCurveTo(150, 160, 300, 210, 512, 175)
      ctx.lineTo(512, 256)
      ctx.lineTo(0, 256)
      ctx.fill()

      // Full blooming Sakura Trees
      const trees = [
        [90, 140, 38],
        [220, 150, 32],
        [410, 135, 42],
      ]
      trees.forEach(([tx, ty, tr]) => {
        ctx.fillStyle = '#78350f'
        ctx.fillRect(tx - 4, ty, 8, 55)
        ctx.fillStyle = '#f472b6'
        ctx.beginPath()
        ctx.arc(tx, ty - 6, tr, 0, Math.PI * 2)
        ctx.arc(tx - 18, ty + 4, tr * 0.75, 0, Math.PI * 2)
        ctx.arc(tx + 18, ty + 4, tr * 0.75, 0, Math.PI * 2)
        ctx.fill()
      })

      // Drifting gentle petals
      ctx.fillStyle = '#fbcfe8'
      for (let p = 0; p < 18; p++) {
        const px = (p * 29) % 512
        const py = 60 + ((p * 47) % 150)
        ctx.beginPath()
        ctx.ellipse(px, py, 4, 2, Math.PI / 4, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (ind === 'engineering') {
      // Construction Skyline: Cranes, Bridges, Structural Frames
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#0284c7')
      skyGrad.addColorStop(0.7, '#e0f2fe')
      skyGrad.addColorStop(1, '#ffedd5')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      // Distant industrial hills & suspension bridge towers
      ctx.fillStyle = '#64748b'
      ctx.fillRect(360, 90, 8, 120)
      ctx.fillRect(440, 90, 8, 120)

      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(330, 160)
      ctx.quadraticCurveTo(400, 185, 470, 160)
      ctx.stroke()

      // Silhouette buildings under construction
      ctx.fillStyle = '#475569'
      ctx.fillRect(40, 90, 60, 140)
      ctx.fillRect(150, 70, 70, 160)
      ctx.fillRect(250, 110, 55, 120)

      // Tower Cranes (Iconic Japanese Construction Crane in Bright Orange)
      ctx.fillStyle = '#ea580c'
      ctx.strokeStyle = '#ea580c'
      ctx.lineWidth = 3
      ctx.fillRect(175, 30, 4, 70)
      ctx.strokeRect(130, 30, 85, 4)
      ctx.beginPath()
      ctx.moveTo(177, 18)
      ctx.lineTo(135, 30)
      ctx.moveTo(177, 18)
      ctx.lineTo(210, 30)
      ctx.stroke()

      ctx.fillRect(70, 55, 4, 60)
      ctx.strokeRect(35, 55, 65, 4)
    } else if (ind === 'manufacturing') {
      // Yokohama Industrial Port & Manufacturing Plant Bay
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#0369a1')
      skyGrad.addColorStop(0.7, '#bae6fd')
      skyGrad.addColorStop(1, '#f1f5f9')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      // Water bay
      ctx.fillStyle = '#0284c7'
      ctx.fillRect(0, 210, 512, 46)

      // Container port cranes
      ctx.fillStyle = '#dc2626'
      ctx.fillRect(320, 130, 6, 80)
      ctx.fillRect(305, 130, 45, 6)
      ctx.fillRect(420, 120, 6, 90)
      ctx.fillRect(400, 120, 50, 6)

      // Plant facility buildings
      ctx.fillStyle = '#475569'
      ctx.fillRect(20, 130, 120, 80)
      ctx.fillRect(160, 145, 90, 65)

      // Cargo Container Ship
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.moveTo(250, 215)
      ctx.lineTo(340, 215)
      ctx.lineTo(330, 225)
      ctx.lineTo(260, 225)
      ctx.fill()
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(265, 206, 18, 9)
      ctx.fillStyle = '#2563eb'
      ctx.fillRect(285, 206, 18, 9)
      ctx.fillStyle = '#16a34a'
      ctx.fillRect(305, 206, 18, 9)
    } else if (ind === 'business') {
      // Tokyo Marunouchi Financial Center (Tokyo Station Dome & Sleek Glass Towers)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#1e3a8a')
      skyGrad.addColorStop(0.7, '#93c5fd')
      skyGrad.addColorStop(1, '#fed7aa')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      // Tokyo Station Red-Brick Dome silhouette
      ctx.fillStyle = '#991b1b'
      ctx.fillRect(200, 150, 100, 70)
      ctx.beginPath()
      ctx.arc(250, 150, 32, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(247, 110, 6, 12)

      // Towers
      const towers = [
        [15, 40, 55, 180, '#334155'],
        [80, 25, 60, 195, '#1e293b'],
        [145, 65, 50, 155, '#334155'],
        [310, 30, 65, 190, '#1e293b'],
        [385, 50, 55, 170, '#334155'],
        [445, 20, 60, 200, '#1e293b'],
      ]
      towers.forEach(([x, y, w, h, col]) => {
        ctx.fillStyle = col as string
        ctx.fillRect(x as number, y as number, w as number, h as number)
        ctx.fillStyle = '#fef08a'
        for (let r = (y as number) + 12; r < 210; r += 16) {
          for (let c = (x as number) + 8; c < (x as number) + (w as number) - 8; c += 12) {
            if (Math.random() > 0.45) ctx.fillRect(c, r, 5, 7)
          }
        }
      })
    } else {
      // IT - Tokyo Shinjuku Tech Skyline
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256)
      skyGrad.addColorStop(0, '#0284c7')
      skyGrad.addColorStop(0.7, '#e0f2fe')
      skyGrad.addColorStop(1, '#ffedd5')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, 512, 256)

      ctx.fillStyle = '#475569'
      const buildings = [
        [10, 80, 45, 176],
        [60, 35, 50, 221],
        [120, 85, 60, 171],
        [190, 25, 45, 231],
        [245, 65, 55, 191],
        [310, 45, 40, 211],
        [360, 95, 65, 161],
        [435, 40, 50, 216],
      ]
      buildings.forEach(([x, y, w, h]) => {
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = '#fef08a'
        for (let r = y + 10; r < 240; r += 16) {
          for (let c = x + 8; c < x + w - 8; c += 12) {
            if (Math.random() > 0.4) ctx.fillRect(c, r, 4, 6)
          }
        }
        ctx.fillStyle = '#475569'
      })
    }

    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }

  private createWallArtwork(ind: string, companyName: string): THREE.Mesh {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const geo = new THREE.PlaneGeometry(1.8, 0.95)
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }))
    }

    if (ind === 'hospitality') {
      // Authentic Japanese Hanging Scroll (Kakejiku 掛け軸)
      ctx.fillStyle = '#fef9c3'
      ctx.fillRect(0, 0, 512, 256)
      ctx.fillStyle = '#78350f'
      ctx.fillRect(0, 0, 512, 24)
      ctx.fillRect(0, 232, 512, 24)
      ctx.fillStyle = '#b45309'
      ctx.fillRect(0, 24, 30, 208)
      ctx.fillRect(482, 24, 30, 208)

      ctx.fillStyle = '#1c1917'
      ctx.font = 'bold 36px serif'
      ctx.textAlign = 'center'
      ctx.fillText('一 期 一 会', 256, 85)

      ctx.font = '18px serif'
      ctx.fillStyle = '#44403c'
      ctx.fillText('心からのおもてなしと感謝の心', 256, 130)

      ctx.fillStyle = '#dc2626'
      ctx.fillRect(238, 150, 36, 36)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px serif'
      ctx.fillText('雅', 256, 175)

      ctx.font = 'bold 16px sans-serif'
      ctx.fillStyle = '#78350f'
      ctx.fillText(`【${companyName || 'ホテル雅・京都'} 支配人室】`, 256, 218)
    } else if (ind === 'kaigo') {
      // Healthcare Care Center Vision Board
      ctx.fillStyle = '#fff7ed'
      ctx.fillRect(0, 0, 512, 256)
      ctx.strokeStyle = '#f43f5e'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, 502, 246)

      ctx.fillStyle = '#e11d48'
      ctx.font = 'bold 26px sans-serif'
      ctx.fillText('🌸【さくらケア・真心と思いやり】', 30, 52)

      ctx.fillStyle = '#334155'
      ctx.font = '19px sans-serif'
      ctx.fillText('1. 利用者様の尊厳と笑顔を守る介護', 35, 100)
      ctx.fillText('2. チームケアと丁寧なコミュニケーション', 35, 140)
      ctx.fillText('3. 安心・安全な心温まる福祉環境', 35, 180)

      ctx.fillStyle = '#059669'
      ctx.font = 'bold 17px sans-serif'
      ctx.fillText(`施設: ${companyName || '社会福祉法人さくらケア'}`, 35, 224)
    } else if (ind === 'engineering') {
      // Construction Green Cross Safety Banner
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 512, 256)
      ctx.strokeStyle = '#15803d'
      ctx.lineWidth = 12
      ctx.strokeRect(6, 6, 500, 244)

      ctx.fillStyle = '#15803d'
      ctx.fillRect(40, 32, 14, 40)
      ctx.fillRect(27, 45, 40, 14)

      ctx.font = 'bold 30px sans-serif'
      ctx.fillText('安 全 第 一 ・ 品 質 至 上', 85, 62)

      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText('1. 指差呼称の徹底 (Pointing & Calling)', 40, 115)
      ctx.fillText('2. 整理整頓と保護具完全着用 (5S & PPE)', 40, 155)
      ctx.fillText('3. ゼロ災で行こう・ヨシ！', 40, 195)

      ctx.fillStyle = '#15803d'
      ctx.font = 'bold 17px sans-serif'
      ctx.fillText(`事業所: ${companyName || '大和建設株式会社'}・安全衛生推進部`, 40, 232)
    } else if (ind === 'manufacturing') {
      // 5S Factory Quality Slogan Banner
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, 512, 256)
      ctx.strokeStyle = '#1d4ed8'
      ctx.lineWidth = 12
      ctx.strokeRect(6, 6, 500, 244)

      ctx.fillStyle = '#1e3a8a'
      ctx.font = 'bold 26px sans-serif'
      ctx.fillText('【品質第一・不良ゼロ推進 (Zero Defect)】', 30, 52)

      const boxes = ['整理', '整頓', '清掃', '清潔', '躾']
      boxes.forEach((txt, idx) => {
        const bx = 30 + idx * 90
        ctx.fillStyle = '#2563eb'
        ctx.fillRect(bx, 75, 78, 38)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(txt, bx + 39, 101)
      })

      ctx.textAlign = 'left'
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 19px sans-serif'
      ctx.fillText('ルール: 異常時は「止める・呼ぶ・待つ」を徹底！', 30, 158)
      ctx.fillText('カイゼン活動 (Kaizen) で世界標準のものづくり', 30, 192)

      ctx.fillStyle = '#2563eb'
      ctx.font = 'bold 17px sans-serif'
      ctx.fillText(`工場: ${companyName || '明星精密工業株式会社'}・品質保証部`, 30, 230)
    } else if (ind === 'business') {
      // Global Trading Board
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, 512, 256)
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, 502, 246)

      ctx.fillStyle = '#f59e0b'
      ctx.font = 'bold 26px sans-serif'
      ctx.fillText('【丸の内商事・グローバル貿易戦略】', 30, 52)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '19px sans-serif'
      ctx.fillText('1. 日越包括的貿易パートナーシップ推進', 35, 100)
      ctx.fillText('2. サプライチェーン最適化と海外市場開拓', 35, 140)
      ctx.fillText('3. 信用第一・顧客価値の創造 (Trust & Value)', 35, 180)

      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 17px sans-serif'
      ctx.fillText(`会社: ${companyName || '丸の内商事株式会社'}・国際営業部`, 35, 224)
    } else {
      // IT Whiteboard
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 512, 256)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 12
      ctx.strokeRect(6, 6, 500, 244)

      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('【ネクステック・開発本部】', 40, 55)

      ctx.font = '20px sans-serif'
      ctx.fillStyle = '#334155'
      ctx.fillText('1. クラウド基盤設計 & マイクロサービス', 45, 105)
      ctx.fillText('2. アジャイル開発スプリント計画', 45, 145)
      ctx.fillText('3. 実習生採用選考 (Ho-Ren-So 評価)', 45, 185)

      ctx.fillStyle = '#0284c7'
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(`会社: ${companyName || '株式会社ネクステック'}`, 45, 225)
    }

    const tex = new THREE.CanvasTexture(canvas)
    this.disposableTextures.push(tex)
    const geo = new THREE.PlaneGeometry(1.8, 0.95)
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(-3.75, 1.7, -0.6)
    mesh.rotation.y = Math.PI / 2
    return mesh
  }

  private createTableProps(ind: string, companyName: string): THREE.Group {
    const group = new THREE.Group()

    // 1. Evaluation Sheet (面接評価シート) tailored to industry
    const evalCanvas = document.createElement('canvas')
    evalCanvas.width = 256
    evalCanvas.height = 320
    const evCtx = evalCanvas.getContext('2d')
    if (evCtx) {
      evCtx.fillStyle = '#f8fafc'
      evCtx.fillRect(0, 0, 256, 320)
      evCtx.strokeStyle = '#cbd5e1'
      evCtx.lineWidth = 4
      evCtx.strokeRect(4, 4, 248, 312)

      evCtx.fillStyle = '#0f172a'
      evCtx.font = 'bold 18px sans-serif'
      const title =
        ind === 'it'
          ? '【IT開発採用評価】'
          : ind === 'hospitality'
          ? '【接客おもてなし評価】'
          : ind === 'kaigo'
          ? '【介護福祉適性評価】'
          : ind === 'engineering'
          ? '【施工管理技術評価】'
          : ind === 'manufacturing'
          ? '【製造品質管理評価】'
          : '【国際営業適性評価】'
      evCtx.fillText(title, 25, 36)

      evCtx.fillStyle = '#475569'
      evCtx.font = '11px sans-serif'
      evCtx.fillText(`社名: ${companyName.slice(0, 16)}`, 25, 56)
      evCtx.fillText('対象: 実習生選考', 25, 76)
      evCtx.fillText('評価項目:', 25, 100)
      evCtx.fillText('・自己紹介・志望動機', 35, 124)
      evCtx.fillText('・ビジネスマナー / 敬語', 35, 152)
      evCtx.fillText('・報連相 (Ho-Ren-So)', 35, 180)
      evCtx.fillText('・熱意と逆質問', 35, 208)

      evCtx.fillStyle = '#dc2626'
      evCtx.font = 'bold 20px sans-serif'
      evCtx.fillText('【選考中】', 135, 275)
    }
    const evalTex = new THREE.CanvasTexture(evalCanvas)
    this.disposableTextures.push(evalTex)
    const evalSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.3),
      new THREE.MeshStandardMaterial({ map: evalTex, roughness: 0.4 })
    )
    evalSheet.rotation.x = -Math.PI / 2
    evalSheet.rotation.z = -0.06
    evalSheet.position.set(-0.25, 0.785, -0.15)
    group.add(evalSheet)

    // Ballpoint Pen
    const penMat = new THREE.MeshStandardMaterial({
      color: ind === 'business' ? 0xd97706 : 0x0f172a,
      metalness: 0.8,
      roughness: 0.2,
    })
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 8), penMat)
    pen.rotation.x = Math.PI / 2
    pen.rotation.z = 0.25
    pen.position.set(-0.42, 0.785, -0.12)
    group.add(pen)

    // Interviewer Acrylic Nameplate (面接官)
    const npCanvas = document.createElement('canvas')
    npCanvas.width = 256
    npCanvas.height = 64
    const npCtx = npCanvas.getContext('2d')
    if (npCtx) {
      npCtx.fillStyle = '#0f172a'
      npCtx.fillRect(0, 0, 256, 64)
      npCtx.fillStyle = '#f8fafc'
      npCtx.font = 'bold 26px sans-serif'
      npCtx.textAlign = 'center'
      npCtx.fillText('面 接 官', 128, 42)
    }
    const npTex = new THREE.CanvasTexture(npCanvas)
    this.disposableTextures.push(npTex)
    const nameplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.07, 0.06),
      new THREE.MeshStandardMaterial({ map: npTex, roughness: 0.3 })
    )
    nameplate.position.set(-0.15, 0.81, 0.25)
    nameplate.rotation.y = 0.05
    group.add(nameplate)

    // Dossier Folder
    const folderColor =
      ind === 'kaigo'
        ? 0xf43f5e
        : ind === 'engineering'
        ? 0x0284c7
        : ind === 'hospitality'
        ? 0x78350f
        : ind === 'business'
        ? 0x0f172a
        : 0x1e3a8a
    const folder = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.015, 0.24),
      new THREE.MeshStandardMaterial({ color: folderColor, roughness: 0.5 })
    )
    folder.position.set(0.22, 0.79, -0.08)
    folder.rotation.y = 0.08
    folder.castShadow = true
    group.add(folder)

    // 2. Industry-Specific Unique 3D Props!
    if (ind === 'it') {
      // Laptop with Glowing Code Editor
      const laptopGroup = new THREE.Group()
      laptopGroup.position.set(0.62, 0.78, -0.1)
      laptopGroup.rotation.y = -0.2

      const laptopBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.012, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 })
      )
      laptopGroup.add(laptopBase)

      const screenGroup = new THREE.Group()
      screenGroup.position.set(0, 0.006, -0.11)
      screenGroup.rotation.x = -Math.PI / 1.75

      const screenLid = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.008),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 })
      )
      screenLid.position.y = 0.1
      screenGroup.add(screenLid)

      const ideCanvas = document.createElement('canvas')
      ideCanvas.width = 256
      ideCanvas.height = 160
      const idCtx = ideCanvas.getContext('2d')
      if (idCtx) {
        idCtx.fillStyle = '#0f172a'
        idCtx.fillRect(0, 0, 256, 160)
        idCtx.fillStyle = '#38bdf8'
        idCtx.font = 'bold 11px monospace'
        idCtx.fillText('import { React } from "react"', 12, 22)
        idCtx.fillStyle = '#4ade80'
        idCtx.fillText('const NexTechEngine = () => {', 12, 42)
        idCtx.fillStyle = '#fbbf24'
        idCtx.fillText('  const [score, setScore] = useState(100)', 24, 62)
        idCtx.fillStyle = '#f472b6'
        idCtx.fillText('  return <AICandidate pass={true} />', 24, 82)
        idCtx.fillStyle = '#4ade80'
        idCtx.fillText('}', 12, 102)
      }
      const ideTex = new THREE.CanvasTexture(ideCanvas)
      this.disposableTextures.push(ideTex)
      const screenDisplay = new THREE.Mesh(
        new THREE.PlaneGeometry(0.29, 0.17),
        new THREE.MeshBasicMaterial({ map: ideTex })
      )
      screenDisplay.position.set(0, 0.1, 0.005)
      screenGroup.add(screenDisplay)

      laptopGroup.add(screenGroup)
      group.add(laptopGroup)

      const mugMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 16), mugMat)
      mug.position.set(-0.65, 0.82, -0.15)
      group.add(mug)
    } else if (ind === 'hospitality') {
      // Kyusu Teapot & 2 Yunomi Matcha Cups
      const kyusuMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.4 })
      const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), kyusuMat)
      teapot.position.set(-0.65, 0.84, -0.12)
      group.add(teapot)

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
      )
      handle.rotation.z = Math.PI / 2.3
      handle.position.set(-0.73, 0.87, -0.12)
      group.add(handle)

      for (let c = 0; c < 2; c++) {
        const cx = 0.55 + c * 0.14
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.03, 0.065, 16),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
        )
        cup.position.set(cx, 0.81, -0.12)
        group.add(cup)

        const matcha = new THREE.Mesh(
          new THREE.CircleGeometry(0.033, 16),
          new THREE.MeshBasicMaterial({ color: 0x22c55e })
        )
        matcha.rotation.x = -Math.PI / 2
        matcha.position.set(cx, 0.84, -0.12)
        group.add(matcha)
      }
    } else if (ind === 'kaigo') {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.035, 0.07, 16),
        new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.3 })
      )
      cup.position.set(-0.65, 0.815, -0.15)
      group.add(cup)

      const miniPot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
      )
      miniPot.position.set(0.68, 0.81, -0.12)
      group.add(miniPot)

      const miniFlower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.045),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 })
      )
      miniFlower.position.set(0.68, 0.86, -0.12)
      group.add(miniFlower)
    } else if (ind === 'engineering') {
      // Yellow Hard Hat (Nón bảo hộ ⛑️)
      const hatGroup = new THREE.Group()
      hatGroup.position.set(0.65, 0.83, -0.12)
      hatGroup.rotation.y = -0.4

      const hatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.2 })
      const hatDome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hatMat)
      hatGroup.add(hatDome)

      const hatBrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.012, 16),
        hatMat
      )
      hatBrim.position.y = 0.005
      hatGroup.add(hatBrim)

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.002), new THREE.MeshBasicMaterial({ color: 0x15803d }))
      crossH.position.set(0, 0.04, 0.092)
      hatGroup.add(crossH)
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.002), new THREE.MeshBasicMaterial({ color: 0x15803d }))
      crossV.position.set(0, 0.04, 0.092)
      hatGroup.add(crossV)

      group.add(hatGroup)

      // Rolled-out Blueprints
      const bpCanvas = document.createElement('canvas')
      bpCanvas.width = 256
      bpCanvas.height = 256
      const bCtx = bpCanvas.getContext('2d')
      if (bCtx) {
        bCtx.fillStyle = '#0284c7'
        bCtx.fillRect(0, 0, 256, 256)
        bCtx.strokeStyle = '#bae6fd'
        bCtx.lineWidth = 2
        for (let g = 0; g < 256; g += 24) {
          bCtx.beginPath()
          bCtx.moveTo(g, 0)
          bCtx.lineTo(g, 256)
          bCtx.moveTo(0, g)
          bCtx.lineTo(256, g)
          bCtx.stroke()
        }
        bCtx.strokeStyle = '#ffffff'
        bCtx.lineWidth = 4
        bCtx.strokeRect(30, 40, 196, 176)
        bCtx.strokeRect(50, 60, 80, 70)
        bCtx.strokeRect(140, 60, 60, 70)
      }
      const bpTex = new THREE.CanvasTexture(bpCanvas)
      this.disposableTextures.push(bpTex)
      const blueprint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.28),
        new THREE.MeshStandardMaterial({ map: bpTex, roughness: 0.5 })
      )
      blueprint.rotation.x = -Math.PI / 2
      blueprint.rotation.z = 0.15
      blueprint.position.set(-0.62, 0.785, -0.1)
      group.add(blueprint)
    } else if (ind === 'manufacturing') {
      // Clear Acrylic Sample Display Box with Precision Metal Gear
      const gearBoxGroup = new THREE.Group()
      gearBoxGroup.position.set(0.64, 0.82, -0.1)

      const acrylicMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.8,
      })
      const acrylicBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), acrylicMat)
      gearBoxGroup.add(acrylicBox)

      const gearMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 })
      const gearCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 16), gearMat)
      gearBoxGroup.add(gearCenter)
      for (let t = 0; t < 8; t++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.025, 0.014), gearMat)
        const angle = (t * Math.PI) / 4
        tooth.position.set(Math.cos(angle) * 0.052, 0, Math.sin(angle) * 0.052)
        tooth.rotation.y = -angle
        gearBoxGroup.add(tooth)
      }
      group.add(gearBoxGroup)

      const caliperMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.18), caliperMat)
      caliper.position.set(-0.65, 0.785, -0.15)
      caliper.rotation.y = 0.3
      group.add(caliper)
    } else if (ind === 'business') {
      // Leather Card Case (Meishi-ire) & Gold Pen
      const caseMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4 })
      const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.08), caseMat)
      caseMesh.position.set(0.62, 0.79, -0.1)
      group.add(caseMesh)

      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.055),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      )
      card.rotation.x = -Math.PI / 2
      card.position.set(0.62, 0.8, -0.1)
      group.add(card)

      const goldPen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.15, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.15 })
      )
      goldPen.rotation.x = Math.PI / 2
      goldPen.rotation.z = -0.3
      goldPen.position.set(-0.65, 0.785, -0.12)
      group.add(goldPen)
    }

    return group
  }

  // --- STYLIZED CANDIDATE AVATAR & APPAREL ---
  private buildCandidateAvatar(): void {
    this.candidateGroup = new THREE.Group()
    this.candidateGroup.name = 'Candidate_Avatar'
    this.candidateGroup.position.set(0, 0, 4.5) // Starts outside room facing door
    this.candidateGroup.rotation.y = Math.PI // Faces -Z (towards the interview door)

    const suitMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })

    // Articulated Legs: Thigh (Upper Leg) + Shin (Lower Leg) + Dress Shoes
    const thighGeo = new THREE.BoxGeometry(0.13, 0.36, 0.14)
    const shinGeo = new THREE.BoxGeometry(0.12, 0.34, 0.13)
    const shoeGeo = new THREE.BoxGeometry(0.13, 0.08, 0.22)

    // Left Leg
    this.candidateLeftLeg = new THREE.Group()
    this.candidateLeftLeg.position.set(-0.11, 0.68, 0) // Hip pivot
    const leftThighMesh = new THREE.Mesh(thighGeo, suitMat)
    leftThighMesh.position.y = -0.18
    leftThighMesh.castShadow = true
    this.candidateLeftLeg.add(leftThighMesh)

    this.candidateLeftShin = new THREE.Group()
    this.candidateLeftShin.position.set(0, -0.36, 0) // Knee pivot
    const leftShinMesh = new THREE.Mesh(shinGeo, suitMat)
    leftShinMesh.position.y = -0.17
    leftShinMesh.castShadow = true
    this.candidateLeftShin.add(leftShinMesh)

    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat)
    leftShoe.position.set(0, -0.32, 0.04)
    this.candidateLeftShin.add(leftShoe)
    this.candidateLeftLeg.add(this.candidateLeftShin)
    this.candidateGroup.add(this.candidateLeftLeg)

    // Right Leg
    this.candidateRightLeg = new THREE.Group()
    this.candidateRightLeg.position.set(0.11, 0.68, 0) // Hip pivot
    const rightThighMesh = new THREE.Mesh(thighGeo, suitMat)
    rightThighMesh.position.y = -0.18
    rightThighMesh.castShadow = true
    this.candidateRightLeg.add(rightThighMesh)

    this.candidateRightShin = new THREE.Group()
    this.candidateRightShin.position.set(0, -0.36, 0) // Knee pivot
    const rightShinMesh = new THREE.Mesh(shinGeo, suitMat)
    rightShinMesh.position.y = -0.17
    rightShinMesh.castShadow = true
    this.candidateRightShin.add(rightShinMesh)

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat)
    rightShoe.position.set(0, -0.32, 0.04)
    this.candidateRightShin.add(rightShoe)
    this.candidateRightLeg.add(this.candidateRightShin)
    this.candidateGroup.add(this.candidateRightLeg)

    // Torso Base (Pelvis & Chest)
    this.candidateTorso = new THREE.Group()
    this.candidateTorso.position.set(0, 0.72, 0)
    this.candidateGroup.add(this.candidateTorso)

    // Suit Jacket
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.24), suitMat)
    chestMesh.position.y = 0.26
    chestMesh.castShadow = true
    this.candidateTorso.add(chestMesh)

    // White Shirt
    const shirtMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.36, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    )
    shirtMesh.position.set(0, 0.31, 0.12)
    this.candidateTorso.add(shirtMesh)

    // Necktie (Male)
    this.candidateTieMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.3, 0.015),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }) // Elegant dark navy silk tie
    )
    this.candidateTieMesh.position.set(0, 0.27, 0.132)
    this.candidateTorso.add(this.candidateTieMesh)

    // Arms
    const armGeo = new THREE.BoxGeometry(0.1, 0.26, 0.1)
    this.candidateLeftArm = new THREE.Group()
    this.candidateLeftArm.position.set(-0.25, 0.44, 0)
    const leftUpperArm = new THREE.Mesh(armGeo, suitMat)
    leftUpperArm.position.y = -0.13
    this.candidateLeftArm.add(leftUpperArm)

    this.candidateLeftForearm = new THREE.Group()
    this.candidateLeftForearm.position.set(0, -0.26, 0)
    const leftArmFore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.09), suitMat)
    leftArmFore.position.y = -0.13
    this.candidateLeftForearm.add(leftArmFore)
    const handMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 })
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), handMat)
    leftHand.position.y = -0.29
    this.candidateLeftForearm.add(leftHand)
    this.candidateLeftArm.add(this.candidateLeftForearm)
    this.candidateTorso.add(this.candidateLeftArm)

    this.candidateRightArm = new THREE.Group()
    this.candidateRightArm.position.set(0.25, 0.44, 0)
    const rightUpperArm = new THREE.Mesh(armGeo, suitMat)
    rightUpperArm.position.y = -0.13
    this.candidateRightArm.add(rightUpperArm)

    this.candidateRightForearm = new THREE.Group()
    this.candidateRightForearm.position.set(0, -0.26, 0)
    const rightArmFore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.09), suitMat)
    rightArmFore.position.y = -0.13
    this.candidateRightForearm.add(rightArmFore)
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), handMat)
    rightHand.position.y = -0.29
    this.candidateRightForearm.add(rightHand)
    this.candidateRightArm.add(this.candidateRightForearm)
    this.candidateTorso.add(this.candidateRightArm)

    // Neck & Head
    this.candidateNeck = new THREE.Group()
    this.candidateNeck.position.set(0, 0.52, 0)
    this.candidateTorso.add(this.candidateNeck)

    this.candidateHead = new THREE.Group()
    this.candidateHead.position.set(0, 0.12, 0)
    this.candidateNeck.add(this.candidateHead)

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.24), handMat)
    headMesh.castShadow = true
    this.candidateHead.add(headMesh)

    // Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    this.candidateHairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.26), hairMat)
    this.candidateHairMesh.position.set(0, 0.15, 0.01)
    this.candidateHead.add(this.candidateHairMesh)

    this.candidateAppearance = createCandidateAppearance({ head: this.candidateHead, jacket: chestMesh, tie: this.candidateTieMesh, hair: this.candidateHairMesh })
    this.candidateAppearance.setGender(this.candidateGender)
    this.scene.add(this.candidateGroup)
  }

  // --- STYLIZED JAPANESE NPC & JOINTS ---
  private buildStylizedNPC(npcName: string, npcTitle: string): CharacterJoints {
    const ind = this.industryId || 'it'
    const isFemale = ind === 'kaigo' // Suzuki Misaki is Female Director

    const root = new THREE.Group()
    root.name = 'NPC_Interviewer'
    root.position.set(0, 0, -0.9) // Sitting behind desk facing candidate

    // Ergonomic Executive Chair for NPC
    const bossChair = this.createErgonomicChair()
    bossChair.position.set(0, 0, -0.2)
    root.add(bossChair)

    // Torso Base / Pelvis
    const torso = new THREE.Group()
    torso.position.set(0, isFemale ? 0.66 : 0.68, -0.15)
    root.add(torso)

    // 1. Outfit styling per Industry
    let suitColor = 0x1e293b
    let suitRoughness = 0.7
    let tieColor = 0x991b1b
    let hasGlasses = false
    let hasPocketSquare = false
    let hasGoldVest = false
    let hasConstructionCollar = false
    let hasFactoryZipper = false

    if (ind === 'it') {
      suitColor = 0x1e3a8a // Modern tech navy
      tieColor = 0x0284c7 // Tech cyan silk tie
      hasGlasses = true
    } else if (ind === 'hospitality') {
      suitColor = 0x09090b // Pitch black luxury 3-piece
      tieColor = 0x881337 // Burgundy silk
      hasGoldVest = true
    } else if (ind === 'kaigo') {
      suitColor = 0xe11d48 // Warm coral rose medical blazer
      suitRoughness = 0.6
    } else if (ind === 'engineering') {
      suitColor = 0x475569 // Rugged steel-grey work jacket (Sagyougi)
      tieColor = 0x1e293b // Dark rugged tie
      hasConstructionCollar = true
    } else if (ind === 'manufacturing') {
      suitColor = 0x0284c7 // Industrial blue supervisor jumper
      hasFactoryZipper = true
      hasGlasses = true
    } else if (ind === 'business') {
      suitColor = 0x18181b // Pinstripe charcoal black
      tieColor = 0x991b1b // Deep burgundy executive tie
      hasPocketSquare = true
    }

    const suitMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: suitRoughness })

    // Chest / Jacket Mesh
    const chestWidth = isFemale ? 0.44 : 0.48
    const chestHeight = isFemale ? 0.52 : 0.54
    const chestDepth = isFemale ? 0.25 : 0.28
    const chest = new THREE.Mesh(new THREE.BoxGeometry(chestWidth, chestHeight, chestDepth), suitMat)
    chest.position.y = chestHeight / 2
    chest.castShadow = true
    torso.add(chest)

    // Inner Shirt / Blouse
    const shirtWidth = isFemale ? 0.16 : 0.18
    const shirtHeight = isFemale ? 0.34 : 0.38
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(shirtWidth, shirtHeight, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    )
    shirt.position.set(0, 0.32, chestDepth / 2)
    torso.add(shirt)

    // Optional: Gold Vest for Hospitality General Manager
    if (hasGoldVest) {
      const vestMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.2 })
      const leftVest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.02), vestMat)
      leftVest.position.set(-0.07, 0.28, chestDepth / 2 + 0.01)
      torso.add(leftVest)
      const rightVest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.02), vestMat)
      rightVest.position.set(0.07, 0.28, chestDepth / 2 + 0.01)
      torso.add(rightVest)

      // Gold Lapel Pin / Hotel Emblem
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12), pinMat)
      pin.rotation.x = Math.PI / 2
      pin.position.set(0.16, 0.42, chestDepth / 2 + 0.01)
      torso.add(pin)
    }

    // Optional: Construction Contrast Collar for Engineering
    if (hasConstructionCollar) {
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.03), collarMat)
      collar.position.set(0, 0.46, chestDepth / 2 + 0.005)
      torso.add(collar)
    }

    // Optional: Factory Zipper & Dual QC Pens for Manufacturing
    if (hasFactoryZipper) {
      const zipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 })
      const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.38, 0.02), zipMat)
      zipper.position.set(0, 0.29, chestDepth / 2 + 0.012)
      torso.add(zipper)

      // QC Pens in breast pocket
      const qcPenMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.3 })
      const pen1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8), qcPenMat)
      pen1.position.set(0.15, 0.38, chestDepth / 2 + 0.012)
      torso.add(pen1)
      const pen2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.3 })
      )
      pen2.position.set(0.165, 0.38, chestDepth / 2 + 0.012)
      torso.add(pen2)
    }

    // Tie (for non-female & non-zipper roles)
    if (!isFemale && !hasFactoryZipper) {
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.32, 0.02),
        new THREE.MeshStandardMaterial({ color: tieColor, roughness: 0.5 })
      )
      tie.position.set(0, 0.27, chestDepth / 2 + 0.02)
      torso.add(tie)
    }

    // Optional: White Silk Pocket Square for Business
    if (hasPocketSquare) {
      const squareMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      const sq = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.01), squareMat)
      sq.position.set(0.14, 0.38, chestDepth / 2 + 0.012)
      torso.add(sq)
    }

    // Lapel Badge with NPC Name & Title
    const badgeCanvas = document.createElement('canvas')
    badgeCanvas.width = 128
    badgeCanvas.height = 48
    const bCtx = badgeCanvas.getContext('2d')
    if (bCtx) {
      bCtx.fillStyle = '#f8fafc'
      bCtx.fillRect(0, 0, 128, 48)
      bCtx.strokeStyle = isFemale ? '#f43f5e' : ind === 'engineering' ? '#15803d' : '#334155'
      bCtx.lineWidth = 4
      bCtx.strokeRect(2, 2, 124, 44)

      bCtx.fillStyle = '#0f172a'
      bCtx.font = 'bold 15px sans-serif'
      bCtx.fillText(npcName.slice(0, 8), 8, 20)
      bCtx.fillStyle = '#64748b'
      bCtx.font = '11px sans-serif'
      bCtx.fillText(npcTitle.slice(0, 10), 8, 38)
    }
    const badgeTex = new THREE.CanvasTexture(badgeCanvas)
    this.disposableTextures.push(badgeTex)
    const badgeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.04, 0.01),
      new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.3 })
    )
    badgeMesh.position.set(-0.16, 0.38, chestDepth / 2 + 0.01)
    torso.add(badgeMesh)

    // Neck
    const neck = new THREE.Group()
    neck.position.set(0, chestHeight, 0)
    torso.add(neck)
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(isFemale ? 0.065 : 0.08, isFemale ? 0.075 : 0.09, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 })
    )
    neckMesh.position.y = 0.06
    neck.add(neckMesh)

    // Head
    const head = new THREE.Group()
    head.position.set(0, 0.14, 0)
    neck.add(head)

    // Face mesh
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.45 })
    const headWidth = isFemale ? 0.28 : 0.3
    const headHeight = isFemale ? 0.32 : 0.34
    const headDepth = isFemale ? 0.26 : 0.28
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(headWidth, headHeight, headDepth), faceMat)
    headMesh.castShadow = true
    head.add(headMesh)

    // Hair Styling per Character (Female hairstyle with bun/bangs for Kaigo, slicked back for hospitality, crew cut for engineering, etc.)
    const hairColor = isFemale ? 0x5c3a21 : ind === 'engineering' ? 0x0f172a : 0x18181b
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 })

    if (isFemale) {
      // Elegant female bun & bangs (Suzuki Misaki)
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.28), hairMat)
      hairTop.position.set(0, headHeight / 2 + 0.02, 0.01)
      head.add(hairTop)

      // Bangs
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.03), hairMat)
      bangs.position.set(0, headHeight / 2 - 0.03, headDepth / 2 + 0.005)
      head.add(bangs)

      // Tied bun at back
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), hairMat)
      bun.position.set(0, 0.04, -headDepth / 2 - 0.04)
      head.add(bun)

      // Hair clasp barrette
      const clasp = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.015),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
      )
      clasp.position.set(0, 0.04, -headDepth / 2 - 0.01)
      head.add(clasp)
    } else if (ind === 'engineering') {
      // Crew-cut short cropped hair (Sato Tsuyoshi)
      const crewHair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.06, 0.29), hairMat)
      crewHair.position.set(0, headHeight / 2 + 0.01, 0.005)
      head.add(crewHair)
    } else {
      // Neat Japanese executive hairstyle
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.3), hairMat)
      hairTop.position.set(0, headHeight / 2 + 0.02, 0.01)
      head.add(hairTop)
    }

    // Eyes with eyelids
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b })
    const eyeGeo = new THREE.BoxGeometry(0.045, isFemale ? 0.035 : 0.04, 0.02)

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
    leftEye.position.set(-0.07, 0.04, headDepth / 2 + 0.002)
    head.add(leftEye)

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
    rightEye.position.set(0.07, 0.04, headDepth / 2 + 0.002)
    head.add(rightEye)

    // Optional: Eyeglasses for IT (Takahashi) and Manufacturing (Watanabe)
    let glassesGroup: THREE.Group | undefined
    if (hasGlasses) {
      glassesGroup = new THREE.Group()
      glassesGroup.position.set(0, 0.04, headDepth / 2 + 0.012)
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })

      // Left lens frame
      const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), frameMat)
      leftFrame.position.x = -0.07
      glassesGroup.add(leftFrame)

      // Right lens frame
      const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), frameMat)
      rightFrame.position.x = 0.07
      glassesGroup.add(rightFrame)

      // Bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), frameMat)
      glassesGroup.add(bridge)

      head.add(glassesGroup)
    }

    // Mouth
    const mouthMat = new THREE.MeshBasicMaterial({ color: isFemale ? 0xf43f5e : 0x881337 })
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.07 : 0.08, 0.025, 0.01), mouthMat)
    mouth.position.set(0, -0.07, headDepth / 2 + 0.002)
    head.add(mouth)

    // Arms & Forearms
    const armWidth = isFemale ? 0.1 : 0.12
    const leftArm = new THREE.Group()
    leftArm.position.set(-(chestWidth / 2 + 0.04), 0.46, 0)
    torso.add(leftArm)
    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, 0.26, armWidth), suitMat)
    leftUpperArm.position.y = -0.13
    leftArm.add(leftUpperArm)

    const leftForearm = new THREE.Group()
    leftForearm.position.set(0, -0.26, 0)
    leftArm.add(leftForearm)
    const leftArmFore = new THREE.Mesh(new THREE.BoxGeometry(armWidth * 0.9, 0.28, armWidth * 0.9), suitMat)
    leftArmFore.position.set(0.05, 0.05, 0.14)
    leftArmFore.rotation.x = Math.PI / 2.8
    leftForearm.add(leftArmFore)

    const rightArm = new THREE.Group()
    rightArm.position.set(chestWidth / 2 + 0.04, 0.46, 0)
    torso.add(rightArm)
    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, 0.26, armWidth), suitMat)
    rightUpperArm.position.y = -0.13
    rightArm.add(rightUpperArm)

    const rightForearm = new THREE.Group()
    rightForearm.position.set(0, -0.26, 0)
    rightArm.add(rightForearm)
    const rightArmFore = new THREE.Mesh(new THREE.BoxGeometry(armWidth * 0.9, 0.28, armWidth * 0.9), suitMat)
    rightArmFore.position.set(-0.05, 0.05, 0.14)
    rightArmFore.rotation.x = Math.PI / 2.8
    rightForearm.add(rightArmFore)

    this.scene.add(root)

    return {
      root,
      torso,
      chest,
      neck,
      head,
      leftEye,
      rightEye,
      mouth,
      leftArm,
      rightArm,
      leftForearm,
      rightForearm,
      glasses: glassesGroup,
    }
  }

  private createErgonomicChair(): THREE.Group {
    const chair = new THREE.Group()
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })

    // Seat cushion
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), chairMat)
    seat.position.y = 0.46
    seat.castShadow = true
    chair.add(seat)

    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.06), chairMat)
    back.position.set(0, 0.78, -0.22)
    back.castShadow = true
    chair.add(back)

    // Central Stem & Star Base
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 16), chromeMat)
    stem.position.y = 0.21
    chair.add(stem)

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 5), chromeMat)
    base.position.y = 0.04
    chair.add(base)

    return chair
  }

  // --- RENDER LOOP ---
  private startLoop(): void {
    const render = () => {
      if (!this.isRunning) return
      this.animFrameId = requestAnimationFrame(render)

      if (!this.isTabVisible) return

      const dt = this.clock.getDelta()

      // Track FPS & update quality if needed
      this.qualityManager.updateFPS()

      // Update camera smooth dolly & sway
      this.cameraRig.update(dt)

      // Update Character procedural animation
      this.characterController.update(dt)

      // Update Door angle
      if (this.doorPivot) {
        this.doorPivot.rotation.y = THREE.MathUtils.lerp(
          this.doorPivot.rotation.y,
          this.targetDoorAngle,
          Math.min(dt * 4.5, 1.0)
        )
      }

      // Update Candidate Avatar
      if (this.candidateGroup) {
        const distToTarget = this.candidateGroup.position.distanceTo(this.candidatePositionTarget)
        const isTranslating = distToTarget > 0.04

        // Smooth position translation
        this.candidateGroup.position.lerp(this.candidatePositionTarget, Math.min(dt * 3.2, 1.0))

        // Shortest-arc rotation interpolation
        let rotDiff = (this.candidateRotationTarget - this.candidateGroup.rotation.y) % (Math.PI * 2)
        if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
        if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
        this.candidateGroup.rotation.y += rotDiff * Math.min(dt * 4.5, 1.0)

        // Smooth sitting progress interpolation
        this.sittingProgress = THREE.MathUtils.lerp(
          this.sittingProgress,
          this.targetSittingProgress,
          Math.min(dt * 3.5, 1.0)
        )

        // Lerp Torso Height smoothly for standing/seated transitions
        if (this.candidateTorso) {
          this.candidateTorso.position.y = THREE.MathUtils.lerp(
            this.candidateTorso.position.y,
            this.targetTorsoY,
            Math.min(dt * 4.0, 1.0)
          )
        }

        // Lerp hip height based on sitting progress
        if (this.candidateLeftLeg && this.candidateRightLeg) {
          const hipY = THREE.MathUtils.lerp(0.68, 0.46, this.sittingProgress)
          this.candidateLeftLeg.position.y = hipY
          this.candidateRightLeg.position.y = hipY
        }

        // Kinematics: Walking vs Standing vs Sitting
        if (isTranslating && !this.isCandidateClosingDoor && this.targetSittingProgress === 0) {
          this.isCandidateWalking = true
          this.walkPhase += dt * 8.5

          const stride = Math.sin(this.walkPhase)
          const kneeFlexLeft = Math.max(0, Math.sin(this.walkPhase - 0.4))
          const kneeFlexRight = Math.max(0, -Math.sin(this.walkPhase - 0.4))

          if (this.candidateLeftLeg) {
            this.candidateLeftLeg.rotation.x = stride * 0.42
          }
          if (this.candidateLeftShin) {
            this.candidateLeftShin.rotation.x = kneeFlexLeft * 0.48
          }
          if (this.candidateRightLeg) {
            this.candidateRightLeg.rotation.x = -stride * 0.42
          }
          if (this.candidateRightShin) {
            this.candidateRightShin.rotation.x = kneeFlexRight * 0.48
          }

          // Arm natural swing in opposite phase
          if (this.candidateLeftArm && !this.isCandidateKnocking && !this.isCandidateBowing && !this.isCandidateClosingDoor) {
            this.candidateLeftArm.rotation.x = -stride * 0.3
            this.candidateLeftArm.rotation.z = 0
          }
          if (this.candidateRightArm && !this.isCandidateKnocking && !this.isCandidateBowing && !this.isCandidateClosingDoor) {
            this.candidateRightArm.rotation.x = stride * 0.3
            this.candidateRightArm.rotation.z = 0
          }

          // Subtle natural vertical body bob
          if (this.candidateTorso) {
            const bob = Math.abs(Math.sin(this.walkPhase * 2)) * 0.02
            this.candidateTorso.position.y = this.targetTorsoY + bob
          }
        } else {
          this.isCandidateWalking = false
          // Return legs smoothly to standing (0) or sitting (90 deg)
          const targetLegX = -this.sittingProgress * (Math.PI / 2)
          const targetShinX = this.sittingProgress * (Math.PI / 2)

          if (this.candidateLeftLeg) {
            this.candidateLeftLeg.rotation.x = THREE.MathUtils.lerp(
              this.candidateLeftLeg.rotation.x,
              targetLegX,
              Math.min(dt * 7.0, 1.0)
            )
          }
          if (this.candidateRightLeg) {
            this.candidateRightLeg.rotation.x = THREE.MathUtils.lerp(
              this.candidateRightLeg.rotation.x,
              targetLegX,
              Math.min(dt * 7.0, 1.0)
            )
          }
          if (this.candidateLeftShin) {
            this.candidateLeftShin.rotation.x = THREE.MathUtils.lerp(
              this.candidateLeftShin.rotation.x,
              targetShinX,
              Math.min(dt * 7.0, 1.0)
            )
          }
          if (this.candidateRightShin) {
            this.candidateRightShin.rotation.x = THREE.MathUtils.lerp(
              this.candidateRightShin.rotation.x,
              targetShinX,
              Math.min(dt * 7.0, 1.0)
            )
          }
        }

        // Seated hand posture on thighs/lap (when seated or transitioning to seated)
        if (
          this.sittingProgress > 0.05 &&
          !this.isCandidateBowing &&
          !this.isCandidateWalking &&
          !this.isCandidateKnocking &&
          !this.isCandidateClosingDoor
        ) {
          if (this.candidateLeftArm && this.candidateRightArm) {
            this.candidateLeftArm.rotation.x = THREE.MathUtils.lerp(this.candidateLeftArm.rotation.x, 0.5, Math.min(dt * 6.0, 1.0))
            this.candidateRightArm.rotation.x = THREE.MathUtils.lerp(this.candidateRightArm.rotation.x, 0.5, Math.min(dt * 6.0, 1.0))
            if (this.candidateLeftForearm) {
              this.candidateLeftForearm.rotation.x = THREE.MathUtils.lerp(this.candidateLeftForearm.rotation.x, 0.75, Math.min(dt * 6.0, 1.0))
            }
            if (this.candidateRightForearm) {
              this.candidateRightForearm.rotation.x = THREE.MathUtils.lerp(this.candidateRightForearm.rotation.x, 0.75, Math.min(dt * 6.0, 1.0))
            }
            if (this.candidateGender === 'female') {
              this.candidateLeftArm.rotation.z = THREE.MathUtils.lerp(this.candidateLeftArm.rotation.z, 0.2, Math.min(dt * 6.0, 1.0))
              this.candidateRightArm.rotation.z = THREE.MathUtils.lerp(this.candidateRightArm.rotation.z, -0.2, Math.min(dt * 6.0, 1.0))
            } else {
              this.candidateLeftArm.rotation.z = THREE.MathUtils.lerp(this.candidateLeftArm.rotation.z, 0, Math.min(dt * 6.0, 1.0))
              this.candidateRightArm.rotation.z = THREE.MathUtils.lerp(this.candidateRightArm.rotation.z, 0, Math.min(dt * 6.0, 1.0))
            }
          }
        }

        // Candidate 2-Handed Door Closing Animation
        if (this.isCandidateClosingDoor) {
          this.candidateCloseDoorProgress += dt
          const p = Math.min(this.candidateCloseDoorProgress / this.candidateCloseDoorDuration, 1.0)

          if (p < 0.25) {
            // Phase 1: Reaching both hands up toward the door handle and door edge
            const reach = p / 0.25
            if (this.candidateRightArm && this.candidateRightForearm) {
              this.candidateRightArm.rotation.x = -reach * 0.85
              this.candidateRightArm.rotation.z = -reach * 0.15
              this.candidateRightForearm.rotation.x = -reach * 0.65
            }
            if (this.candidateLeftArm && this.candidateLeftForearm) {
              this.candidateLeftArm.rotation.x = -reach * 0.75
              this.candidateLeftArm.rotation.z = reach * 0.2
              this.candidateLeftForearm.rotation.x = -reach * 0.55
            }
          } else if (p < 0.75) {
            // Phase 2: Pulling / swinging the door shut smoothly
            const closeT = (p - 0.25) / 0.5
            const openAngle = -Math.PI / 1.85
            this.targetDoorAngle = THREE.MathUtils.lerp(openAngle, 0, closeT)

            if (this.candidateCloseDoorInside) {
              // Inside room: pulling inward door towards frame
              if (this.candidateRightArm && this.candidateRightForearm) {
                this.candidateRightArm.rotation.x = -0.85 + closeT * 0.15
                this.candidateRightArm.rotation.z = -0.15 + closeT * 0.05
                this.candidateRightForearm.rotation.x = -0.65 + closeT * 0.1
              }
              if (this.candidateLeftArm && this.candidateLeftForearm) {
                this.candidateLeftArm.rotation.x = -0.75 + closeT * 0.15
                this.candidateLeftArm.rotation.z = 0.2 - closeT * 0.05
                this.candidateLeftForearm.rotation.x = -0.55 + closeT * 0.1
              }
            } else {
              // Outside hallway: reaching forward to push door into frame
              if (this.candidateRightArm && this.candidateRightForearm) {
                this.candidateRightArm.rotation.x = -0.75 + closeT * 0.1
                this.candidateRightArm.rotation.z = -0.1
                this.candidateRightForearm.rotation.x = -0.5
              }
              if (this.candidateLeftArm && this.candidateLeftForearm) {
                this.candidateLeftArm.rotation.x = -0.75 + closeT * 0.1
                this.candidateLeftArm.rotation.z = 0.1
                this.candidateLeftForearm.rotation.x = -0.5
              }
            }
          } else if (p < 0.85) {
            // Phase 3: Door latch shut
            this.targetDoorAngle = 0
            this.isDoorOpen = false
          } else {
            // Phase 4: Arms lower smoothly back to candidate sides
            const lower = (p - 0.85) / 0.15
            if (this.candidateRightArm && this.candidateRightForearm) {
              this.candidateRightArm.rotation.x = -(1 - lower) * 0.7
              this.candidateRightArm.rotation.z = -(1 - lower) * 0.1
              this.candidateRightForearm.rotation.x = -(1 - lower) * 0.55
            }
            if (this.candidateLeftArm && this.candidateLeftForearm) {
              this.candidateLeftArm.rotation.x = -(1 - lower) * 0.6
              this.candidateLeftArm.rotation.z = (1 - lower) * 0.15
              this.candidateLeftForearm.rotation.x = -(1 - lower) * 0.45
            }
          }

          if (p >= 1.0) {
            this.isCandidateClosingDoor = false
            this.targetDoorAngle = 0
            this.isDoorOpen = false
            if (this.candidateRightArm) {
              this.candidateRightArm.rotation.x = 0
              this.candidateRightArm.rotation.z = 0
            }
            if (this.candidateRightForearm) this.candidateRightForearm.rotation.x = 0
            if (this.candidateLeftArm) {
              this.candidateLeftArm.rotation.x = 0
              this.candidateLeftArm.rotation.z = 0
            }
            if (this.candidateLeftForearm) this.candidateLeftForearm.rotation.x = 0

            const cb = this.onCloseDoorComplete
            this.onCloseDoorComplete = undefined
            cb?.()
          }
        }

        // Candidate 3-Knock animation
        if (this.isCandidateKnocking && this.candidateRightArm && this.candidateRightForearm) {
          this.candidateKnockProgress += dt
          const p = this.candidateKnockProgress / this.candidateKnockDuration
          if (p < 0.15) {
            // Lift arm toward door
            const lift = p / 0.15
            this.candidateRightArm.rotation.x = -lift * 1.15
            this.candidateRightArm.rotation.z = -lift * 0.15
            this.candidateRightForearm.rotation.x = -lift * 0.95
          } else if (p < 0.85) {
            // 3 distinct rhythmic knocks (matching audio sequence)
            const knockCycle = (this.candidateKnockProgress - 0.15) * 3.5
            const tap = Math.sin(knockCycle * Math.PI * 2)
            this.candidateRightArm.rotation.x = -1.15 + (tap > 0 ? tap * 0.18 : 0)
            this.candidateRightForearm.rotation.x = -0.95 + (tap > 0 ? tap * 0.22 : 0)
          } else if (p < 1.0) {
            // Lower arm smoothly back to side
            const lower = (p - 0.85) / 0.15
            this.candidateRightArm.rotation.x = -(1 - lower) * 1.15
            this.candidateRightArm.rotation.z = -(1 - lower) * 0.15
            this.candidateRightForearm.rotation.x = -(1 - lower) * 0.95
          } else {
            this.isCandidateKnocking = false
            this.candidateRightArm.rotation.x = 0
            this.candidateRightArm.rotation.z = 0
            this.candidateRightForearm.rotation.x = 0
          }
        }

        // Candidate bow progression
        if (this.isCandidateBowing && this.candidateTorso) {
          this.candidateBowProgress += dt
          const progress = Math.min(this.candidateBowProgress / this.candidateBowDuration, 1.0)
          let bowFactor = 0
          if (progress < 0.4) {
            bowFactor = THREE.MathUtils.smoothstep(progress, 0, 0.4)
          } else if (progress < 0.7) {
            bowFactor = 1.0
          } else {
            bowFactor = 1.0 - THREE.MathUtils.smoothstep(progress, 0.7, 1.0)
          }

          this.candidateTorso.rotation.x = bowFactor * this.candidateBowAngle
          if (this.candidateHead) {
            this.candidateHead.rotation.x = bowFactor * 0.12
          }
          if (this.candidateLeftArm && this.candidateRightArm && !this.isCandidateKnocking) {
            if (this.candidateGender === 'female') {
              this.candidateLeftArm.rotation.x = -bowFactor * 0.35
              this.candidateLeftArm.rotation.z = bowFactor * 0.3
              this.candidateRightArm.rotation.x = -bowFactor * 0.35
              this.candidateRightArm.rotation.z = -bowFactor * 0.3
            } else {
              this.candidateLeftArm.rotation.x = bowFactor * 0.2
              this.candidateRightArm.rotation.x = bowFactor * 0.2
            }
          }

          if (progress >= 1.0) {
            this.isCandidateBowing = false
            this.candidateTorso.rotation.x = 0
            if (this.candidateHead) this.candidateHead.rotation.x = 0
            if (this.candidateLeftArm) {
              this.candidateLeftArm.rotation.x = 0
              this.candidateLeftArm.rotation.z = 0
            }
            if (this.candidateRightArm) {
              this.candidateRightArm.rotation.x = 0
              this.candidateRightArm.rotation.z = 0
            }
          }
        }
      }

      // Render Scene
      this.renderer.render(this.scene, this.camera)
    }

    this.isRunning = true
    this.clock.start()
    this.animFrameId = requestAnimationFrame(render)
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    this.isRunning = false
  }

  // --- ETIQUETTE & INTERACTION HELPERS ---
  public setDoorOpen(isOpen: boolean): void {
    this.isDoorOpen = isOpen
    this.targetDoorAngle = isOpen ? -Math.PI / 1.85 : 0
  }

  public getIsDoorOpen(): boolean {
    return this.isDoorOpen
  }

  public triggerCandidateCloseDoor(inside: boolean = true, onComplete?: () => void): void {
    this.isCandidateClosingDoor = true
    this.candidateCloseDoorProgress = 0
    this.candidateCloseDoorDuration = 2.0
    this.candidateCloseDoorInside = inside
    this.onCloseDoorComplete = onComplete
  }

  public setCandidateStance(stance: 'outside' | 'doorway' | 'standing_chair' | 'seated' | 'exit'): void {
    if (!this.candidateGroup) return
    switch (stance) {
      case 'outside':
        this.candidatePositionTarget.set(0, 0, 4.5)
        this.candidateRotationTarget = Math.PI // Faces door at z=3.8
        this.candidateGroup.visible = true
        this.targetTorsoY = 0.72
        this.targetSittingProgress = 0
        break
      case 'doorway':
        this.candidatePositionTarget.set(0.18, 0, 3.25)
        this.candidateRotationTarget = 0.35 // Turned slightly toward door (20 deg), back not fully to interviewer
        this.candidateGroup.visible = true
        this.targetTorsoY = 0.72
        this.targetSittingProgress = 0
        break
      case 'standing_chair':
        this.candidatePositionTarget.set(0.48, 0, 1.3)
        this.candidateRotationTarget = Math.PI // Faces interviewer at table
        this.candidateGroup.visible = true
        this.targetTorsoY = 0.72
        this.targetSittingProgress = 0
        break
      case 'seated':
        this.candidatePositionTarget.set(0, 0, 1.1)
        this.candidateRotationTarget = Math.PI // Faces interviewer at table
        this.candidateGroup.visible = this.cameraRig.getView() !== 'pov'
        this.targetTorsoY = 0.48
        this.targetSittingProgress = 1.0
        break
      case 'exit':
        this.candidatePositionTarget.set(0, 0, 3.4)
        this.candidateRotationTarget = Math.PI // Faces interviewer from doorway for final bow
        this.candidateGroup.visible = true
        this.targetTorsoY = 0.72
        this.targetSittingProgress = 0
        break
    }
  }

  public triggerCandidateKnock(): void {
    this.isCandidateKnocking = true
    this.candidateKnockProgress = 0
    this.candidateKnockDuration = 1.3
  }

  public triggerCandidateBow(angleDeg: number = 38, duration: number = 2.0): void {
    this.isCandidateBowing = true
    this.candidateBowProgress = 0
    this.candidateBowDuration = duration
    this.candidateBowAngle = (angleDeg * Math.PI) / 180
  }

  public setCandidateGender(gender: 'male' | 'female'): void {
    this.candidateGender = gender
    this.candidateAppearance?.setGender(gender)
    if (this.candidateGroup) this.candidateGroup.userData.gender = gender
  }

  // --- MEMORY DISPOSAL ---
  public dispose(): void {
    this.stopLoop()

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    this.cameraRig.dispose()
    this.eventUnbinders.forEach((unbind) => unbind())
    this.eventUnbinders = []

    // Dispose all textures
    this.disposableTextures.forEach((tex) => tex.dispose())
    this.disposableTextures = []

    // Traverse scene and dispose geometries/materials
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose())
        } else if (mesh.material) {
          mesh.material.dispose()
        }
      }
    })

    // Remove canvas & dispose renderer
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    this.renderer.dispose()
  }
}
