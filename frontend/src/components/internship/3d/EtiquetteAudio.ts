/**
 * EtiquetteAudio: Procedural sound synthesizer using Web Audio API and Web Speech API.
 * Synthesizes realistic wooden door knocks, door latch clicks, and authentic Japanese phrases.
 * Runs 100% locally with zero external audio assets.
 */

class EtiquetteAudioService {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * Authentic 3-Knock sequence (Japanese business protocol: 3 knocks for interview room)
   */
  public playDoorKnocks(onFinished?: () => void): void {
    const ctx = this.getContext()
    if (!ctx) {
      if (onFinished) setTimeout(onFinished, 1200)
      return
    }

    const knockTimes = [0, 0.38, 0.76]
    knockTimes.forEach((delay) => {
      setTimeout(() => {
        this.synthesizeWoodKnock(ctx)
      }, delay * 1000)
    })

    if (onFinished) {
      setTimeout(onFinished, 1400)
    }
  }

  private synthesizeWoodKnock(ctx: AudioContext): void {
    const t = ctx.currentTime

    // Low-frequency body resonance (thud of heavy wood door)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08)

    gain.gain.setValueAtTime(0.7, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.09)

    // Sharp knuckle impact transient
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(800, t)
    filter.Q.setValueAtTime(3.0, t)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03)

    whiteNoise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    whiteNoise.start(t)
    whiteNoise.stop(t + 0.03)
  }

  /**
   * Soft wooden door swing & latch click
   */
  public playDoorOpen(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // Subtle wooden hinge creak / swing
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.linearRampToValueAtTime(120, t + 0.35)

    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.38)
  }

  public playDoorClose(): void {
    const ctx = this.getContext()
    if (!ctx) return
    const t = ctx.currentTime

    // Gentle soft click latch
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, t)
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.06)

    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.07)
  }

  /**
   * Speak authentic Japanese etiquette phrases via Web Speech API
   */
  public speakJapanese(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) setTimeout(onEnd, 1500)
      return
    }

    let isDone = false
    const safeEnd = () => {
      if (isDone) return
      isDone = true
      delete (window as any).__senpaiUtterance
      onEnd?.()
    }

    try {
      window.speechSynthesis.cancel() // clear any prior speech
      const utterance = new SpeechSynthesisUtterance(text)
      ;(window as any).__senpaiUtterance = utterance
      utterance.lang = 'ja-JP'
      utterance.rate = 0.95 // Polite, clear business pace
      utterance.pitch = 1.0

      // Try finding a Japanese voice
      const voices = window.speechSynthesis.getVoices()
      const jaVoice = voices.find((v) => v.lang.startsWith('ja') || v.name.includes('Japanese'))
      if (jaVoice) {
        utterance.voice = jaVoice
      }

      utterance.onend = () => {
        safeEnd()
      }
      utterance.onerror = () => {
        safeEnd()
      }

      // Safety fallback timeout in case Web Speech hangs or stalls
      setTimeout(safeEnd, 3500)

      window.speechSynthesis.speak(utterance)
    } catch {
      safeEnd()
    }
  }

  // Authentic Japanese business etiquette vocal phrases
  public speakNpcEnterInvite(onEnd?: () => void): void {
    this.speakJapanese('どうぞ、お入りください', onEnd)
  }

  public speakNpcSitInvite(onEnd?: () => void): void {
    this.speakJapanese('どうぞ、お掛けください', onEnd)
  }

  public speakCandidateShitsurei(onEnd?: () => void): void {
    this.speakJapanese('失礼いたします', onEnd)
  }

  public speakCandidateArigatou(onEnd?: () => void): void {
    this.speakJapanese('本日は誠にありがとうございました', onEnd)
  }
}

export const etiquetteAudio = new EtiquetteAudioService()
