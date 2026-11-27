import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { authAPI } from '../../services/api'

export default function PersonalExport() {
  const { t, i18n } = useTranslation('profile')
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<'json' | 'zip' | 'html'>('json')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); trigger.current?.focus() }
  async function download() {
    if (lock.current) return
    lock.current = true; setBusy(true); setNotice('')
    try {
      const response = await authAPI.exportFile(format, i18n.language.startsWith('en') ? 'en' : 'vi')
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      const serverName = response.headers['content-disposition']?.match(/filename="(senpaiai-\d{4}-\d{2}-\d{2}\.(?:json|zip|html))"/)?.[1]
      anchor.download = serverName || `senpaiai-${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}.${format}`
      document.body.append(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      setNotice(t(response.headers['x-export-truncated'] === 'true' ? 'personalExport.truncated' : 'personalExport.done'))
    } catch { setNotice(t('personalExport.error')) }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <button ref={trigger} type="button" className="w-full btn btn-outline btn-sm" onClick={() => setOpen(true)}>{t('export')}</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="personal-export-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={e => {
      if (e.key === 'Escape' && !busy) close()
      if (e.key === 'Tab') {
        const controls = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')
        const first = controls[0], last = controls[controls.length - 1]
        if (!first) { e.preventDefault(); return }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }}>
      <div className="theme-card w-full max-w-lg max-h-[90dvh] overflow-auto rounded-2xl p-5 space-y-4 text-[color:var(--text)]">
        <h2 id="personal-export-title" className="font-semibold">{t('export')}</h2><p>{t('personalExport.confirm')}</p>
        <label className="block">{t('personalExport.format')}<select autoFocus disabled={busy} value={format} onChange={e => setFormat(e.target.value as typeof format)} className="block w-full mt-2 p-3 rounded-lg bg-[color:var(--card)] border border-[color:var(--border)]">{(['json', 'zip', 'html'] as const).map(kind => <option key={kind} value={kind}>{t(`personalExport.${kind}`)}</option>)}</select></label>
        <p>{t('personalExport.limits')}</p><p role="status" aria-live="polite">{busy ? t('personalExport.preparing') : notice}</p>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void download()}>{t('personalExport.download')}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={close}>{t('personalExport.close')}</button></div>
      </div>
    </div>}
  </>
}
