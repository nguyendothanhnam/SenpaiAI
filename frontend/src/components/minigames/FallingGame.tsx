import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Action, Round } from '../../../../shared-games'
export default function FallingGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), [selected, setSelected] = useState<number | null>(null)
  const questions = round.falling.questions, active = questions.find(q => q.id === selected) || questions[0]
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (round.session.status !== 'playing' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return
      const index = Number(event.key) - 1
      if (active && index >= 0 && index < 4) { event.preventDefault(); onAction({ type: 'answer', value: active.options[index], id: active.id }) }
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [active, onAction, round.session.status])
  return <div>
    <p className="mg-muted">{t('minigames.fallingControls')}</p>
    <div className="mg-fall-arena" aria-label={t('minigames.fallingArena')}>
      {questions.map((q, index) => <button type="button" key={q.id} className="mg-falling" aria-pressed={active?.id === q.id} aria-label={t('minigames.selectKanji', { kanji: q.item.id })} onClick={() => setSelected(q.id)} style={{ left: `${index * 33 + 2}%`, transform: `translateY(${Math.min(1, q.ageMs / q.durationMs) * 200}px)` }}>{q.item.id}</button>)}
      <div className="mg-fall-floor" />
    </div>
    <div className="mg-options">{active?.options.map((option, index) => <button type="button" className="mg-btn mg-option" key={option} onClick={() => onAction({ type: 'answer', value: option, id: active.id })}><span className="mg-key">{index + 1}</span>{option}</button>)}</div>
  </div>
}
