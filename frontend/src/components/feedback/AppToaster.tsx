import { Toaster, toast, resolveValue } from 'react-hot-toast'
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
export default function AppToaster() {
  const { t } = useTranslation('common')
  return <Toaster position="top-right" containerStyle={{ top: 80, right: 16, left: 16 }} toastOptions={{ duration: 4500, error: { duration: 6500 } }}>{item => {
    const kind = item.type === 'error' ? 'error' : item.type === 'success' ? 'success' : item.type === 'loading' ? 'loading' : 'info'
    const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : kind === 'loading' ? Loader2 : Info
    return <div role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} className={`flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-[color:var(--text)] shadow-xl ${item.visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-[color:var(--accent)] text-[color:var(--primary)]'}`}><Icon size={21} aria-hidden="true" className={kind === 'loading' ? 'motion-safe:animate-spin' : ''} /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{t(`dialogs.${kind}`)}</p><div className="mt-1 break-words text-sm leading-5 text-[color:var(--text-muted)]">{resolveValue(item.message, item)}</div></div><button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[color:var(--accent)]" onClick={() => toast.dismiss(item.id)} aria-label={t('dialogs.close')}><X size={16} aria-hidden="true" /></button>
    </div>
  }}</Toaster>
}
