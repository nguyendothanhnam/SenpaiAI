import type { PlacementAnswer, PlacementAttempt, ServerClock } from './model'
import { anchorClock, currentQuestion, remainingSeconds } from './model'

interface Transport {
  get: (id: number) => Promise<PlacementAttempt>
  answer: (attempt: PlacementAttempt, answer: PlacementAnswer) => Promise<PlacementAttempt>
  submit: (id: number) => Promise<PlacementAttempt>
}
export interface ExamState { attempt: PlacementAttempt | null; clock: ServerClock | null; busy: boolean; needsSync: boolean; error: unknown }
export class PlacementController {
  private state: ExamState = { attempt: null, clock: null, busy: false, needsSync: false, error: undefined }
  private listeners = new Set<() => void>()
  private disposed = false
  constructor(private api: Transport, private now = () => performance.now()) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  dispose() { this.disposed = true; this.listeners.clear() }
  private update(change: Partial<ExamState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...change }; this.listeners.forEach(fn => fn())
  }
  accept(attempt: PlacementAttempt) {
    this.update({ attempt, clock: anchorClock(attempt, this.now()), needsSync: false, error: undefined })
  }
  suspend() { if (this.state.attempt?.status === 'in_progress') this.update({ needsSync: true }) }
  clear() { if (!this.state.busy) this.update({ attempt: null, clock: null, error: undefined, needsSync: false }) }
  // Synchronous gate covers the entire answer + optional submit transaction.
  async run(work: () => Promise<void>) {
    if (this.state.busy || this.disposed) return false
    this.update({ busy: true, error: undefined })
    try { await work(); return !this.disposed }
    catch (error) { this.update({ error, needsSync: true }); return false }
    finally { this.update({ busy: false }) }
  }
  async resume(id: number) { return this.run(async () => { this.accept(await this.api.get(id)) }) }
  async reconcile() {
    const id = this.state.attempt?.id
    if (id) return this.resume(id)
    return false
  }
  async answer(value: PlacementAnswer) {
    if (this.state.needsSync) return false
    return this.run(async () => {
      const attempt = this.state.attempt
      if (!attempt || attempt.status !== 'in_progress') return
      if (remainingSeconds(this.state.clock, this.now()) === 0) { this.accept(await this.api.submit(attempt.id)); return }
      if (!currentQuestion(attempt)) return
      this.accept(await this.api.answer(attempt, value))
      // A final committed response may hit the deadline while the request is in flight.
      if (this.state.attempt?.status === 'in_progress' && remainingSeconds(this.state.clock, this.now()) === 0) this.accept(await this.api.submit(attempt.id))
    })
  }
  async submit() {
    return this.run(async () => {
      let attempt = this.state.attempt
      if (!attempt || attempt.status !== 'in_progress' || attempt.assessment_mode === 'legacy') return
      // Resolve unknown write outcomes before trying another mutation.
      if (this.state.needsSync) { attempt = await this.api.get(attempt.id); this.accept(attempt) }
      if (attempt.status === 'in_progress') this.accept(await this.api.submit(attempt.id))
    })
  }
}
