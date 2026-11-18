import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CATEGORIES, type Category } from '../../features/gameHub/catalog'
export default function FilterBar({ category, onCategory, search, onSearch }: { category: Category; onCategory: (category: Category) => void; search: string; onSearch: (value: string) => void }) {
  const { t } = useTranslation('common')
  return <div className="gh-glass flex min-w-0 flex-col gap-4 rounded-2xl p-3 xl:flex-row xl:items-center xl:justify-between">
    <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 xl:pb-0" role="group" aria-label={t('arcade.filterLabel')}>
      {CATEGORIES.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => onCategory(value)} className={`gh-filter min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#147A5E] ${category === value ? 'bg-[#147A5E] text-white shadow-sm' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--text)]'}`}>{t(`arcade.categories.${value}`)}</button>)}
    </div>
    <div className="relative min-w-0 xl:w-60 xl:shrink-0"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" /><input type="search" value={search} onChange={event => onSearch(event.target.value)} aria-label={t('arcade.searchLabel')} placeholder={t('arcade.searchPlaceholder')} className="gh-search min-h-[44px] w-full rounded-full border border-[color:var(--border)] bg-[color:var(--card)] py-2.5 pl-11 pr-10 text-sm text-[color:var(--text)] outline-none focus:border-[#147A5E] focus:ring-2 focus:ring-emerald-600/15" />{search && <button type="button" className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--text-muted)]" aria-label={t('arcade.clearSearch')} onClick={() => onSearch('')}><X size={15} aria-hidden="true" /></button>}</div>
  </div>
}
