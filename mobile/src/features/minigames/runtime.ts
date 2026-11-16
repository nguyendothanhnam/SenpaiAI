import { reduceRound, type Action, type Round } from '@games/session'
/** Injectable clock keeps native timing testable; suspended time is never charged. */
export class GameRuntime {
  constructor(public round: Round, private changed: (round: Round) => void) {}
  dispatch(action: Action) {
    const next = reduceRound(this.round, action)
    if (next !== this.round) {
      this.round = next
      if (action.type !== 'tick' || next.session.game === 'falling' || next.session.game === 'memory' || next.session.game === 'battle' || next.session.game === 'ninja') this.changed(next)
    }
  }
  appState(state: string) { if (state !== 'active') this.dispatch({ type: 'pause' }) }
}
