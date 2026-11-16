import type { DailyAnswerResult, DailyOverview } from '../../api/types'
import { dailyStateError, resultFromItem } from './logic'

interface Transport {
  today(): Promise<DailyOverview>
  answer(id: number, answer: unknown, time: number): Promise<DailyAnswerResult>
}
// Reconcile with server truth before every attempt, including retries after a
// lost response. Concurrent taps share one request; POST is never auto-retried.
export class DailySubmission {
  private pending = new Map<number, Promise<DailyAnswerResult>>()
  constructor(private transport: Transport) {}

  submit(task: DailyOverview, itemId: number, answer: unknown, time: number) {
    const existing = this.pending.get(itemId)
    if (existing) return existing
    const operation = this.perform(task, itemId, answer, time).finally(() => this.pending.delete(itemId))
    this.pending.set(itemId, operation)
    return operation
  }

  private async reconcile(task: DailyOverview, itemId: number) {
    const current = await this.transport.today()
    if (current.task_id !== task.task_id || current.date !== task.date) throw dailyStateError('task_expired')
    const item = current.items.find((entry) => entry.id === itemId)
    if (!item) throw dailyStateError('daily_item_not_found')
    return item.answered ? resultFromItem(current, item) : null
  }

  private async perform(task: DailyOverview, itemId: number, answer: unknown, time: number) {
    const recovered = await this.reconcile(task, itemId)
    if (recovered) return recovered
    try { return await this.transport.answer(itemId, answer, time) }
    catch (error) {
      try {
        const persisted = await this.reconcile(task, itemId)
        if (persisted) return persisted
      } catch (reconcileError) {
        if ((reconcileError as Error).message === 'task_expired') throw reconcileError
      }
      throw error
    }
  }
}
