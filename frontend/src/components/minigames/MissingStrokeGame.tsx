import { useTranslation } from 'react-i18next'
import type { Action, Round } from '../../../../shared-games'
export default function MissingStrokeGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), board = round.missing
  if (!board) return null
  return <div>
    <p className="mg-muted">{t('minigames2.missingControls')}</p>
    <div className="mg-section-heading"><span className="mg-pill">{t('minigames2.strokeProgress', { count: round.session.correct, total: 10 })}</span><span className="mg-pill">{t('minigames2.answerTime', { seconds: Math.floor(board.ageMs / 1000) })}</span></div>
    <svg viewBox={board.glyph.viewBox} role="img" aria-label={t('minigames2.incompleteKanji')} className="mg-missing-glyph">
      <path d="M54.5 0V109M0 54.5H109" stroke="var(--border)" strokeWidth=".5" strokeDasharray="2 2" />
      {board.glyph.paths.map((path, index) => index === board.hidden ? null : <path key={index} d={path} fill="none" stroke="var(--text)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <div className="mg-stroke-options">{board.choices.map((choice, index) => <button type="button" className="mg-btn mg-stroke-choice" key={choice.id} aria-label={t('minigames2.strokeOption', { index: index + 1 })} onClick={() => onAction({ type: 'answer', value: choice.id, questionId: String(board.questionId) })}>
      <span className="mg-key">{index + 1}</span><svg viewBox={choice.viewBox} aria-hidden="true"><path d="M54.5 0V109M0 54.5H109" stroke="var(--border)" strokeWidth=".5" strokeDasharray="2 2" /><path d={choice.path} fill="none" stroke="var(--primary)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>)}</div>
    <p className="mg-muted mg-attribution"><a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">{t('minigames2.strokeSource')}</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">{t('minigames2.strokeLicense')}</a></p>
  </div>
}
