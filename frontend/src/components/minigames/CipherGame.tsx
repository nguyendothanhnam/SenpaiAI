import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Action, Round } from '../../../../shared-games'
export default function CipherGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), [answer, setAnswer] = useState(''), cipher = round.cipher
  useEffect(() => { setAnswer('') }, [cipher?.word.id])
  if (!cipher) return null
  return <div>
    <p className="mg-muted">{t('minigames.cipherControls')}</p>
    <div className="mg-code" aria-label={t('minigames.encryptedWord')}>{cipher.encoded.map((char, index) => <span key={index}>{char}<small>{cipher.revealed.includes(index) ? cipher.plain[index] : '·'}</small></span>)}</div>
    <form onSubmit={event => { event.preventDefault(); onAction({ type: 'answer', value: answer, questionId: cipher.word.id }) }}>
      <label className="mg-field">{t('minigames.decodedWord')}<input className="mg-input" value={answer} onChange={event => setAnswer(event.target.value)} autoComplete="off" spellCheck={false} maxLength={30} /></label>
      <div className="mg-actions" style={{ marginTop: 12 }}><button type="submit" className="mg-btn mg-btn-primary" disabled={!answer.trim()}>{t('minigames.check')}</button><button type="button" className="mg-btn" disabled={cipher.revealed.length === cipher.plain.length} onClick={() => onAction({ type: 'hint' })}>{t('minigames.hint')}</button><button type="button" className="mg-btn" onClick={() => setAnswer(answer.slice(0, -1))}>{t('minigames.erase')}</button></div>
    </form>
    <details open><summary className="mg-back" style={{ marginTop: 16, cursor: 'pointer' }}>{t('minigames.cipherTable')}</summary><p className="mg-muted">{t('minigames.tableControls')}</p><div className="mg-table">{cipher.table.map(pair => <button type="button" className="mg-btn" key={pair.code} aria-label={t('minigames.codePair', { code: pair.code, plain: pair.plain })} onClick={() => setAnswer(value => (value + pair.plain).slice(0, 30))}>{pair.code} → {pair.plain}</button>)}</div></details>
  </div>
}
