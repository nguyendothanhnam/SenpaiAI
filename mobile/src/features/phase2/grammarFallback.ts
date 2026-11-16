import type { GrammarSession, SessionOptions } from '../../api/phase2Types'

export function shouldUseBank(error: unknown, mode: SessionOptions['mode']): boolean {
  const value = error as { code?: string; response?: { status?: number } }
  return mode !== 'bank' && value?.code !== 'ERR_CANCELED' && ![401, 403].includes(value?.response?.status || 0)
}
export function mixedNeedsBank(session: GrammarSession, options: SessionOptions): boolean {
  return options.mode === 'mixed' && Boolean(session.message) && session.questions.length > 0 && session.questions.length < options.count
}
