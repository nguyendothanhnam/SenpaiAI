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
    return this.ctx
  }

  /**
   * Authentic 3-Knock sequence (Japanese business protocol: 3 knocks for interview room)
   */
  public async playDoorKnocks(onFinished?: () => void): Promise<void> {
    const ctx = this.getContext()
    if (!ctx) {
      if (onFinished) setTimeout(onFinished, 1300)
      return
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {}
    }

    // Schedule 3 crisp rhythmic wooden door knocks directly on Web Audio timeline
    const t0 = ctx.currentTime + 0.05
    this.synthesizeWoodKnock(ctx, t0)
    this.synthesizeWoodKnock(ctx, t0 + 0.35)
    this.synthesizeWoodKnock(ctx, t0 + 0.70)

    if (onFinished) {
      setTimeout(onFinished, 1350)
    }
  }

  private synthesizeWoodKnock(ctx: AudioContext, startTime: number): void {
    const t = startTime

    // 1. Solid Heavy Wooden Door Body (Audible punchy fundamentals: 580Hz -> 260Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(580, t)
    osc1.frequency.exponentialRampToValueAtTime(260, t + 0.08)

    gain1.gain.setValueAtTime(1.2, t)
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(t)
    osc1.stop(t + 0.12)

    // 2. Secondary Door Cavity Resonance (320Hz -> 180Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(320, t)
    osc2.frequency.exponentialRampToValueAtTime(180, t + 0.10)

    gain2.gain.setValueAtTime(0.8, t)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.14)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(t)
    osc2.stop(t + 0.14)

    // 3. Crisp Knuckle Rap / Attack Click (Noise burst through bandpass 1600Hz)
    const bufferSize = Math.floor(ctx.sampleRate * 0.04)
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015))
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1600, t)
    filter.Q.setValueAtTime(2.0, t)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(1.0, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.005, t + 0.04)

    whiteNoise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    whiteNoise.start(t)
    whiteNoise.stop(t + 0.04)
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
