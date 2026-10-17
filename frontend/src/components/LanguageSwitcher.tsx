import { Globe2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('common')
  const { language, setLanguage } = useLanguage()
  return <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] p-1" aria-label={t('language')}>
    <Globe2 className="mx-1 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
    {(['vi', 'en'] as const).map((value) => <button key={value} type="button" onClick={() => setLanguage(value)} aria-pressed={language === value} className={`rounded-full px-2 py-1 text-xs font-semibold ${language === value ? 'bg-[color:var(--accent)] text-[color:var(--primary)]' : 'text-[color:var(--text-muted)]'}`}>
      {compact ? value.toUpperCase() : t(value === 'vi' ? 'vietnamese' : 'english')}
    </button>)}
  </div>
}
