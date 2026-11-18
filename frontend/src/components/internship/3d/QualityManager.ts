import * as THREE from 'three'

export type QualityLevel = 'low' | 'medium' | 'high'

export interface QualityConfig {
  level: QualityLevel
  pixelRatio: number
  shadows: boolean
  shadowMapSize: number
  toneMapping: THREE.ToneMapping
  targetFPS: number
  useInstancing: boolean
  enablePostProcessing: boolean
}

export class QualityManager {
  private currentLevel: QualityLevel = 'medium'
  private config: QualityConfig
  private fpsBuffer: number[] = []
  private maxBuffer = 60
  private lastTime = performance.now()
  private downgradeCountdown = 3.0 // seconds of low FPS before auto downgrade
  private onQualityChangeCallback?: (config: QualityConfig) => void

  constructor(initialLevel?: QualityLevel) {
    if (initialLevel) {
      this.currentLevel = initialLevel
    } else {
      this.currentLevel = this.detectOptimalQuality()
    }
    this.config = this.createConfig(this.currentLevel)
  }

  public detectOptimalQuality(): QualityLevel {
    // Detect mobile or low-end device
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768
    const lowCores = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4

    if (isMobile || isSmallScreen || lowCores) {
      return 'medium'
    }
    return 'high'
  }

  public getConfig(): QualityConfig {
    return this.config
  }

  public setQuality(level: QualityLevel): void {
    if (this.currentLevel === level) return
    this.currentLevel = level
    this.config = this.createConfig(level)
    if (this.onQualityChangeCallback) {
      this.onQualityChangeCallback(this.config)
    }
  }

  public onQualityChange(callback: (config: QualityConfig) => void): void {
    this.onQualityChangeCallback = callback
  }

  public updateFPS(): number {
    const now = performance.now()
    const delta = (now - this.lastTime) / 1000
    this.lastTime = now

    if (delta > 0) {
      const currentFPS = 1 / delta
      this.fpsBuffer.push(currentFPS)
      if (this.fpsBuffer.length > this.maxBuffer) {
        this.fpsBuffer.shift()
      }

      // Check for auto-downgrade if FPS is consistently low (< 24)
      if (this.fpsBuffer.length >= 30) {
        const avgFPS = this.getAverageFPS()
        if (avgFPS < 24 && this.currentLevel !== 'low') {
          this.downgradeCountdown -= delta
          if (this.downgradeCountdown <= 0) {
            console.warn(`[QualityManager] FPS dropped to ${avgFPS.toFixed(1)}. Auto-downgrading quality.`)
            this.setQuality(this.currentLevel === 'high' ? 'medium' : 'low')
            this.downgradeCountdown = 5.0
          }
        } else {
          this.downgradeCountdown = 3.0
        }
      }
    }
    return this.getAverageFPS()
  }

  public getAverageFPS(): number {
    if (this.fpsBuffer.length === 0) return 60
    const sum = this.fpsBuffer.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.fpsBuffer.length)
  }

  private createConfig(level: QualityLevel): QualityConfig {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    switch (level) {
      case 'low':
        return {
          level: 'low',
          pixelRatio: 1.0,
          shadows: false,
          shadowMapSize: 512,
          toneMapping: THREE.NoToneMapping,
          targetFPS: 30,
          useInstancing: true,
          enablePostProcessing: false,
        }
      case 'medium':
        return {
          level: 'medium',
          pixelRatio: Math.min(dpr, 1.5),
          shadows: true,
          shadowMapSize: 1024,
          toneMapping: THREE.ACESFilmicToneMapping,
          targetFPS: 60,
          useInstancing: true,
          enablePostProcessing: false,
        }
      case 'high':
      default:
        return {
          level: 'high',
          pixelRatio: Math.min(dpr, 2.0),
          shadows: true,
          shadowMapSize: 2048,
          toneMapping: THREE.ACESFilmicToneMapping,
          targetFPS: 60,
          useInstancing: true,
          enablePostProcessing: true,
        }
    }
  }
}
