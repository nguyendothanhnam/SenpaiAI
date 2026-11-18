import type { EndReason, Session } from './types'
export function finish(session: Session, reason: EndReason): Session { return { ...session, status: 'finished', reason } }
export function award(session: Session, points: number): Session {
  const chain = session.chain + 1
  return { ...session, score: session.score + Math.max(0, points), correct: session.correct + 1, chain, longestChain: Math.max(session.longestChain, chain) }
}
export function loseLife(session: Session): Session {
  const result = { ...session, lives: Math.max(0, session.lives - 1), mistakes: session.mistakes + 1, chain: 0 }
  return result.lives ? result : finish(result, 'lives')
}
