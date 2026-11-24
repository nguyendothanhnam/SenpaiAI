import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function PlacementEntry() {
  const { t } = useTranslation('placement')
  return <Link to="/placement" className="theme-card motion-reduce:transition-none block p-5 text-[color:var(--text)] focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]">
    <span className="block font-semibold">{t('title')}</span>
    <span className="mt-1 block text-sm text-[color:var(--text-muted)]">{t('entry')}</span>
  </Link>
}
