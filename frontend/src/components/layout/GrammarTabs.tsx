import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function GrammarTabs() {
  const { t } = useTranslation('nav')
  const { pathname } = useLocation()
  const practice = pathname.startsWith('/grammar/practice')
  const tabs = [
    { key: 'grammarTabs.analysis', href: '/grammar', active: !practice },
    { key: 'grammarTabs.practice', href: '/grammar/practice', active: practice },
  ]
  return <nav aria-label={t('grammarTabs.label')} className="mb-6 flex w-fit gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1">
    {tabs.map((tab) => <Link key={tab.href} to={tab.href} aria-current={tab.active ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab.active ? 'bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]'}`}>{t(tab.key)}</Link>)}
  </nav>
}
