import { useTranslation } from 'react-i18next'
import { lastKana, type Action, type Round } from '../../../../shared-games'
export default function ShiritoriGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), board = round.shiritori
  if (!board) return null
  return <div>
    <p className="mg-muted">{t('minigames.shiritoriControls')}</p>
    <div className="mg-prompt">{board.current.word}</div>
    <p className="mg-reading">{t('minigames.nextKana', { kana: lastKana(board.current.reading) })}</p>
    <div className="mg-options">{board.choices.map(word => <button type="button" className="mg-btn mg-option" key={word.id} onClick={() => onAction({ type: 'answer', value: word.id })}>{word.word}</button>)}</div>
    <p className="mg-muted" style={{ marginTop: 16 }}>{t('minigames.chain', { count: round.session.chain })}</p>
  </div>
}
