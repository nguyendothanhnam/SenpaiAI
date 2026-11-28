import { BadgeCheck, Compass, Clock3, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlacementLevel, PlacementMode } from '../../services/placement'

export default function PlacementSetup({ mode, level, levels, busy, available, onMode, onLevel, onStart }: {
  mode: PlacementMode; level: string; levels: PlacementLevel[]; busy: boolean; available: boolean
  onMode: (mode: PlacementMode) => void; onLevel: (level: string) => void; onStart: () => void
}) {
  const { t } = useTranslation('placement')
  const selected = levels.find(row => row.level === (mode === 'adaptive' ? 'N5' : level))
  const modes = [
    { value: 'adaptive' as const, icon: Compass, title: t('modeAdaptiveTitle'), text: t('modeAdaptiveDescription') },
    { value: 'confirmation' as const, icon: BadgeCheck, title: t('modeConfirmationTitle'), text: t('modeConfirmationDescription') },
  ]
  return <div className="theme-card motion-reduce:transition-none space-y-7 p-5 sm:p-8">
    <fieldset className="space-y-4"><legend className="mb-4 text-lg font-bold">{t('chooseMode')}</legend>
      {modes.map(({ value, icon: Icon, title, text }) => <label key={value} className={`relative flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-5 ${mode === value ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--card)]'} ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        <input type="radio" name="placement-mode" value={value} checked={mode === value} onChange={() => onMode(value)} disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--primary)]" />
        <Icon aria-hidden="true" className="hidden h-7 w-7 shrink-0 text-[color:var(--primary)] sm:block" />
        <span><span className="block text-lg font-semibold">{title}</span><span className="mt-1 block leading-relaxed text-[color:var(--text-muted)]">{text}</span></span>
      </label>)}
    </fieldset>
    {mode === 'confirmation' && <fieldset><legend className="mb-3 font-semibold">{t('chooseExpectedLevel')}</legend>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">{['N5', 'N4', 'N3', 'N2', 'N1'].map(value => {
        const row = levels.find(item => item.level === value)
        return <label key={value} title={row?.available ? t('availableLevel') : t('unavailableLevel')} className={`relative rounded-xl border-2 p-3 text-center ${level === value && row?.available ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)]'} ${!row?.available || busy ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
          <input type="radio" name="placement-level" value={value} checked={level === value} disabled={busy || !row?.available} onChange={() => onLevel(value)} className="absolute left-2 top-2 h-3 w-3 accent-[color:var(--primary)]" />
          <span className="mt-2 block text-xl font-bold">{value}</span>{level === value && row?.available && <Check aria-hidden="true" className="mx-auto mt-1 h-4 w-4 text-[color:var(--primary)]" />}
        </label>
      })}</div><p className="mt-3 text-sm text-[color:var(--text-muted)]">{t('selectionDoesNotSetLevel')}</p>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('unavailableExplanation')}</p>
    </fieldset>}
    {selected?.is_demo && <p role="note" className="rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] p-4 text-sm leading-relaxed">{t('demoNotice')}</p>}
    {!available && <p role="status" className="text-sm text-[color:var(--text-muted)]">{t('bankUnavailable')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--border)] pt-5">
      <p className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)]"><Clock3 aria-hidden="true" className="h-4 w-4" />{t('durationInfo', { questions: mode === 'confirmation' ? 30 : '20–30' })}</p>
      <button type="button" disabled={busy || !available} onClick={onStart} className="w-full rounded-xl bg-[color:var(--primary)] px-7 py-3 font-bold text-[color:var(--primary-contrast)] focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{t(busy ? 'loading' : 'start')}</button>
    </div>
  </div>
}
