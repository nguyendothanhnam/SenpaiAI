import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Volume2 } from 'lucide-react'
import { listeningTimestamp } from '../../utils/listeningPresentation'
import './listening.css'

export function ListeningToggle({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={`listening-toggle ${checked ? 'is-active' : ''}`}>{children}</button>
}

export function ListeningTranscriptRow({ number, startMs, active, disabled, onReplay, controls, children }: {
  number: number; startMs: number; active: boolean; disabled?: boolean; onReplay: () => void; controls?: ReactNode; children: ReactNode
}) {
  const { t } = useTranslation('common')
  return <article aria-current={active ? 'true' : undefined} className={`listening-transcript-row ${active ? 'is-active' : ''}`} onClick={event => {
    if (disabled || (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"]'))) return
    onReplay()
  }}>
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      <button type="button" disabled={disabled} onClick={onReplay} aria-label={t('listening.ui.playLine', { number })} className="listening-timestamp mt-1"><Play className="h-3 w-3 shrink-0" aria-hidden="true" />{listeningTimestamp(startMs / 1000)}</button>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 sm:ml-[5.5rem]">
      <div className="flex flex-wrap gap-2">{controls}</div>
      <button type="button" disabled={disabled} onClick={onReplay} className="listening-replay"><Volume2 className="h-4 w-4" aria-hidden="true" />{t('listening.ui.listenThisLine')}</button>
    </div>
  </article>
}
