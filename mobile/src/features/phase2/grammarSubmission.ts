import type { GrammarAnswer } from '../../api/phase2Types'

export function uncertainAnswerError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  return !status || status >= 500 || status === 409 || status === 408
}

// This API cannot read an existing attempt. A lost response must never cause a
// blind second POST; only a new session can clear an uncertain question.
export class GrammarSubmission {
  private pending = new Map<number, Promise<GrammarAnswer>>()
  private saved = new Map<number, GrammarAnswer>()
  private uncertain = new Set<number>()
  constructor(private post: (id: number, answer: unknown, time: number) => Promise<GrammarAnswer>) {}
  submit(id: number, answer: unknown, time: number): Promise<GrammarAnswer> {
    const running = this.pending.get(id)
    if (running) return running
    const saved = this.saved.get(id)
    if (saved) return Promise.resolve(saved)
    if (this.uncertain.has(id)) return Promise.reject(new Error('uncertain_grammar_answer'))
    const request = Promise.resolve().then(() => this.post(id, answer, time)).then(result => {
      this.saved.set(id, result)
      return result
    }).catch(error => {
      if (uncertainAnswerError(error)) this.uncertain.add(id)
      throw error
    }).finally(() => this.pending.delete(id))
    this.pending.set(id, request)
    return request
  }
}
