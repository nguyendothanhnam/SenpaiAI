import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, GraduationCap, LockKeyhole, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LEVELS, type Level } from '../../../../shared-games'
import { supportedLevels, type HubGame } from '../../features/gameHub/catalog'

export default function LevelSelectModal({ game, preferredLevel, onClose, onStart }: { game: HubGame; preferredLevel?: string; onClose: () => void; onStart: (level: Level) => void }) {
  const { t } = useTranslation('common'), levels = supportedLevels(game)
  const [selected, setSelected] = useState<Level | undefined>(() => levels.find(level => level === preferredLevel) || levels[0])
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialog.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])]
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previousFocus?.focus() }
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(<div className="game-hub fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="gh-level-title" aria-describedby="gh-level-description" tabIndex={-1} className="my-auto w-full max-w-lg rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-[color:var(--text)] shadow-2xl outline-none sm:p-8">
      <div className="flex items-start justify-between gap-4"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--text)]"><GraduationCap size={26} aria-hidden="true" /></div><button type="button" onClick={onClose} aria-label={t('arcade.closeModal')} className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] hover:bg-[color:var(--accent)]"><X size={20} /></button></div>
      <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--text-muted)]">{t(game.title)}</p><h2 id="gh-level-title" className="mt-2 text-2xl font-extrabold">{t('arcade.chooseLevel')}</h2><p id="gh-level-description" className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">{t(game.engine ? 'arcade.levelHelp' : 'arcade.activityHelp')}</p>
      <div className="my-6 grid grid-cols-5 gap-2" role="group" aria-label={t('minigames.level')}>
        {LEVELS.map(level => { const enabled = levels.includes(level); return <button type="button" key={level} disabled={!enabled} aria-pressed={selected === level} onClick={() => setSelected(level)} className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-base font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)] ${!enabled ? 'cursor-not-allowed border-[color:var(--border)] text-[color:var(--text-muted)] opacity-45' : selected === level ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--text)] shadow-md shadow-black/10' : 'border-[color:var(--border)] hover:border-[color:var(--primary)]'}`} aria-label={t(enabled ? 'arcade.availableLevel' : 'arcade.unavailableLevel', { level })}>{level}{!enabled ? <LockKeyhole size={12} aria-hidden="true" /> : selected === level ? <Check size={13} aria-hidden="true" /> : <span className="h-[13px]" />}</button> })}
      </div>
      {levels.length < LEVELS.length && <p className="mb-5 text-xs leading-5 text-[color:var(--text-muted)]">{t('arcade.missingLevels', { levels: LEVELS.filter(level => !levels.includes(level)).join(', ') })}</p>}
      <button type="button" disabled={!selected} onClick={() => { if (selected) onStart(selected) }} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-bold text-[color:var(--text)] transition hover:opacity-90 disabled:opacity-50">{t(game.engine ? 'arcade.continueGame' : 'arcade.continueActivity', { level: selected })}<ArrowRight size={17} aria-hidden="true" /></button>
      <p className="mt-4 text-center text-[11px] leading-5 text-[color:var(--text-muted)]">{t('arcade.rewardNotice')}</p>
    </div>
  </div>, document.body)
}
