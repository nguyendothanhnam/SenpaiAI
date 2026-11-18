import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Flag, Lightbulb, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDialogFocus } from '../../hooks/useDialogFocus'
export default function GameGuide({ gameId, name, onClose }: { gameId: string; name: string; onClose: () => void }) {
  const { t } = useTranslation('common'), ref = useRef<HTMLDivElement>(null), id = useId()
  useDialogFocus(ref, true, onClose)
  const steps = [1, 2, 3].map(step => t(`gameGuides.${gameId}.steps.${step}`))
  if (typeof document === 'undefined') return null
  return createPortal(<div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] shadow-2xl outline-none">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] p-5"><div className="flex items-center gap-3"><span className="rounded-2xl bg-[color:var(--accent)] p-3 text-[color:var(--primary)]"><BookOpen size={23} aria-hidden="true" /></span><div><p className="text-xs font-semibold text-[color:var(--text-muted)]">{t('gameHelp.title')}</p><h2 id={`${id}-title`} className="text-lg font-bold">{name}</h2></div></div><button type="button" onClick={onClose} aria-label={t('dialogs.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[color:var(--accent)]"><X size={20} /></button></div>
      <div className="space-y-5 p-5 sm:p-6"><div className="rounded-2xl bg-[color:var(--accent)] p-4"><p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[color:var(--primary)]"><Flag size={15} aria-hidden="true" />{t('gameHelp.goal')}</p><p className="text-sm leading-6">{t(`gameGuides.${gameId}.goal`)}</p></div><ol className="space-y-4">{Array.isArray(steps) && steps.map((step, index) => <li key={index} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-sm font-extrabold text-[color:var(--primary)]">{index + 1}</span><p className="pt-1 text-sm leading-6 text-[color:var(--text-muted)]">{step}</p></li>)}</ol><p className="flex gap-2 rounded-2xl border border-[color:var(--border)] p-4 text-sm leading-6 text-[color:var(--text-muted)]"><Lightbulb size={19} className="mt-1 shrink-0 text-amber-500" aria-hidden="true" />{t(`gameGuides.${gameId}.tip`)}</p><p className="text-xs leading-5 text-[color:var(--text-muted)]">{t('minigames.localNotice')}</p></div>
      <div className="border-t border-[color:var(--border)] p-4"><button type="button" onClick={onClose} className="min-h-[44px] w-full rounded-full bg-[#147A5E] px-5 py-3 text-sm font-bold text-white hover:bg-[#0F5132]">{t('gameHelp.understood')}</button></div>
    </section>
  </div>, document.body)
}
