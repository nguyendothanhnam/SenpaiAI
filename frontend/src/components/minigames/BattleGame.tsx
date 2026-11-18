import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { battleRules, type Action, type Round } from '../../../../shared-games'
export default function BattleGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), [selected, setSelected] = useState<string | null>(null), board = round.battle
  useEffect(() => { setSelected(null) }, [board?.boardId])
  if (!board) return null
  const rules = battleRules(round.session.level, round.session.difficulty, board.stage)
  return <div>
    <div className="mg-section-heading"><span className="mg-pill">{t('minigames2.stage', { stage: board.stage, total: 5 })}</span><span className="mg-pill">{t('minigames2.combo', { count: board.combo })}</span></div>
    <div className="mg-monster">
      <svg viewBox="0 0 200 120" role="img" aria-label={t(board.boss ? 'minigames2.boss' : 'minigames2.monster')}>
        {board.boss && <path d="M50 35 45 10 80 24 100 2 120 24 155 10 150 35Z" fill="var(--primary)" />}
        <path d="M55 34Q30 36 35 65L25 90 50 84 60 108 80 94 100 110 120 94 140 108 150 84 175 90 165 65Q170 36 145 34Z" fill="var(--accent)" stroke="var(--primary)" strokeWidth="3" />
        <circle cx="75" cy="60" r="10" fill="var(--card)" /><circle cx="125" cy="60" r="10" fill="var(--card)" /><circle cx="77" cy="61" r="4" fill="var(--text)" /><circle cx="123" cy="61" r="4" fill="var(--text)" /><path d="M85 80Q100 90 115 80" fill="none" stroke="var(--primary)" strokeWidth="4" />
      </svg>
      <div><h2>{t(board.boss ? 'minigames2.boss' : 'minigames2.monster')}</h2><p>{t('minigames2.monsterHp', { hp: board.hp, max: board.maxHp })}</p><div className="mg-progress" role="progressbar" aria-label={t('minigames2.hp')} aria-valuemin={0} aria-valuemax={board.maxHp} aria-valuenow={board.hp}><div style={{ width: `${100 * board.hp / board.maxHp}%` }} /></div><p className="mg-muted">{t('minigames2.attackIn', { seconds: Math.ceil(board.attackInMs / 1000) })}</p><div className="mg-progress"><div style={{ width: `${Math.max(0, 100 * board.attackInMs / rules.attackMs)}%` }} /></div></div>
    </div>
    <p className="mg-muted">{t('minigames2.battleControls')}</p>
    <div className="mg-match-columns"><div><h3>{t('minigames2.wordColumn')}</h3>{board.pairs.map(pair => <button type="button" key={pair.id} className={`mg-btn mg-match ${selected === pair.id ? 'mg-selected' : ''}`} aria-pressed={selected === pair.id} disabled={board.matched.includes(pair.id)} onClick={() => setSelected(pair.id)}>{pair.word}<small>{pair.reading}</small></button>)}</div><div><h3>{t('minigames2.meaningColumn')}</h3>{board.rightOrder.map(id => { const pair = board.pairs.find(pair => pair.id === id)!; return <button type="button" key={id} className="mg-btn mg-match" disabled={!selected || board.matched.includes(id)} onClick={() => { if (selected) onAction({ type: 'match', wordId: selected, meaningId: id, boardId: board.boardId }); setSelected(null) }}>{pair.meaning}</button> })}</div></div>
  </div>
}
