export interface DialogOptions {
  message: string; title?: string; confirmLabel?: string; cancelLabel?: string; secondaryLabel?: string
  tone?: 'danger' | 'warning' | 'info'
}
export type DialogResult = 'confirm' | 'secondary' | null
interface Request { options: DialogOptions; resolve: (result: DialogResult) => void }
/** Explicit Promise results prevent a dismissed popup from approving an action. */
export class DialogQueue {
  private requests: Request[] = []
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.requests[0]?.options || null
  ask = (options: DialogOptions): Promise<DialogResult> => {
    if (!this.listeners.size || this.requests.some(request => request.options.message === options.message && request.options.title === options.title && request.options.tone === options.tone)) return Promise.resolve(null)
    return new Promise(resolve => { this.requests.push({ options, resolve }); this.notify() })
  }
  answer = (result: DialogResult, expected?: DialogOptions) => {
    if (expected && this.requests[0]?.options !== expected) return
    const request = this.requests.shift(); request?.resolve(result); this.notify()
  }
  cancelAll = () => { const requests = this.requests.splice(0); requests.forEach(request => request.resolve(null)); this.notify() }
  private notify() { this.listeners.forEach(listener => listener()) }
}
export const dialogQueue = new DialogQueue()
export const chooseDialog = (options: DialogOptions) => dialogQueue.ask(options)
export const confirmDialog = (message: string, options: Omit<DialogOptions, 'message' | 'secondaryLabel'> = {}) => chooseDialog({ ...options, message }).then(result => result === 'confirm')
