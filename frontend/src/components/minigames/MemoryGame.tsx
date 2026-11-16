import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Action, Round } from '../../../../shared-games'
export default function MemoryGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), memory = round.memory
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!memory || memory.phase !== 'input' || round.session.status !== 'playing' || event.repeat || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return
      const index = Number(event.key) - 1
      if (index >= 0 && index < memory.grid.length) { event.preventDefault(); onAction({ type: 'answer', value: memory.grid[index] }) }
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [memory, onAction, round.session.status])
  if (!memory) return null
  const index = Math.floor(memory.showingMs / memory.durationMs)
  const lit = memory.phase === 'showing' && index < memory.sequence.length && memory.showingMs % memory.durationMs < memory.durationMs * .72 ? memory.sequence[index] : null
  return <div>
    <p className="mg-reading" aria-live="polite">{t(memory.phase === 'showing' ? 'minigames.watch' : 'minigames.repeat')}</p>
    <p className="mg-muted" style={{ textAlign: 'center' }}>{t('minigames.memoryProgress', { length: memory.sequence.length, entered: memory.entered })}</p>
    <div className="mg-kana-grid">{memory.grid.map((kana, i) => <button type="button" key={kana} className={`mg-btn mg-kana-cell ${lit === kana ? 'mg-lit' : ''}`} disabled={memory.phase !== 'input'} aria-label={t('minigames.kanaKey', { kana, key: i + 1 })} onClick={() => onAction({ type: 'answer', value: kana })}>{kana}<small className="mg-key">{i + 1}</small></button>)}</div>
    <p className="mg-muted">{t('minigames.memoryControls')}</p>
  </div>
}
