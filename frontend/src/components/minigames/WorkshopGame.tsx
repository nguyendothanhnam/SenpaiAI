import { useTranslation } from 'react-i18next'
import { assembledWord, compoundsFor, LEVELS, type Action, type Round } from '../../../../shared-games'
const recipes = LEVELS.flatMap(compoundsFor)
export function RecipeCollection({ ids }: { ids: string[] }) {
  const { t } = useTranslation('common')
  return <details className="mg-collection"><summary>{t('minigames2.collection', { count: ids.length, total: recipes.length })}</summary>{ids.length ? <ul>{ids.map(id => { const item = recipes.find(item => item.id === id); return item ? <li key={id}><strong>{item.word}</strong><span>{item.reading}</span><small>{item.meaning}</small></li> : null })}</ul> : <p className="mg-muted">{t('minigames2.collectionEmpty')}</p>}</details>
}
export default function WorkshopGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), board = round.workshop
  if (!board) return null
  const value = assembledWord(board)
  return <div>
    <span className="mg-pill">{t('minigames2.recipeProgress', { count: board.used.length, total: 8 })}</span>
    <p className="mg-muted" style={{ marginTop: 12 }}>{t('minigames2.workshopControls')}</p>
    <h2 className="mg-prompt">{board.target.meaning}</h2><p className="mg-reading">{board.target.reading}</p>
    <div className="mg-recipe-slots" aria-label={t('minigames2.assembledWord')}>{Array.from({ length: board.target.word.length }, (_, i) => <span key={i}>{value[i] || '＿'}</span>)}</div>
    <div className="mg-kanji-cards">{board.cards.map(card => <button type="button" key={card.id} className="mg-btn mg-kanji-card" disabled={board.selected.includes(card.id) || board.selected.length === board.target.word.length} onClick={() => onAction({ type: 'tile', id: card.id })}>{card.kanji}</button>)}</div>
    <div className="mg-actions"><button type="button" className="mg-btn mg-btn-primary" disabled={board.selected.length !== board.target.word.length} onClick={() => onAction({ type: 'answer', value, questionId: String(board.questionId) })}>{t('minigames2.forge')}</button><button type="button" className="mg-btn" disabled={!board.selected.length} onClick={() => onAction({ type: 'undo' })}>{t('minigames2.undoCard')}</button><button type="button" className="mg-btn" disabled={!board.selected.length} onClick={() => onAction({ type: 'clear' })}>{t('minigames2.clearCards')}</button></div>
  </div>
}
