import { useLocation } from 'react-router-dom'
import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, Info, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dialogQueue } from '../../features/dialogs/queue'
import { useDialogFocus } from '../../hooks/useDialogFocus'

export default function AppDialogHost() {
  const { t } = useTranslation('common'), options = useSyncExternalStore(dialogQueue.subscribe, dialogQueue.snapshot, () => null)
  const location = useLocation()
  useEffect(() => { dialogQueue.cancelAll() }, [location.key])
  const ref = useRef<HTMLDivElement>(null), id = useId(), close = useCallback(() => { if (options) dialogQueue.answer(null, options) }, [options])
  useDialogFocus(ref, !!options, close)
  useEffect(() => () => dialogQueue.cancelAll(), [])
  if (!options || typeof document === 'undefined') return null
  const danger = options.tone === 'danger', Icon = danger ? ShieldAlert : options.tone === 'warning' ? AlertTriangle : Info
  return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] shadow-2xl outline-none">
      <div className={`h-1.5 ${danger ? 'bg-rose-500' : options.tone === 'warning' ? 'bg-amber-400' : 'bg-[color:var(--primary)]'}`} />
      <div className="p-6 sm:p-7"><div className="flex items-start justify-between gap-4"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${danger ? 'bg-rose-500/10 text-rose-500' : options.tone === 'warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-[color:var(--accent)] text-[color:var(--primary)]'}`}><Icon size={28} aria-hidden="true" /></div><button type="button" onClick={close} aria-label={t('dialogs.close')} className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]"><X size={20} aria-hidden="true" /></button></div>
        <h2 id={`${id}-title`} className="mt-5 break-words text-xl font-extrabold tracking-tight">{options.title || t(danger ? 'dialogs.dangerTitle' : 'dialogs.confirmTitle')}</h2><p id={`${id}-message`} className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--text-muted)]">{options.message}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 sm:px-7"><button type="button" data-autofocus onClick={close} className="min-h-[44px] rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold hover:bg-[color:var(--accent)]">{options.cancelLabel || t('dialogs.cancel')}</button>{options.secondaryLabel && <button type="button" onClick={() => dialogQueue.answer('secondary', options)} className="min-h-[44px] rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold hover:bg-[color:var(--accent)]">{options.secondaryLabel}</button>}<button type="button" onClick={() => dialogQueue.answer('confirm', options)} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#147A5E] hover:bg-[#0F5132]'}`}>{options.confirmLabel || t(danger ? 'dialogs.delete' : 'dialogs.continue')}<ArrowRight size={16} aria-hidden="true" /></button></div>
    </div>
  </div>, document.body)
}
