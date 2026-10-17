import { CalendarCheck, MessageCircle, Library, BookOpen, Brush, Headphones, Gamepad2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from 'react-query'
import { Link, useLocation } from 'react-router-dom'
import { dailyAPI } from '../../services/api'
import { cn } from '../../utils/helpers'
import { useTranslation } from 'react-i18next'

type NavigationItem = {
  key: string
  href: string
  icon: LucideIcon
  matchPaths: string[]
  enabled?: boolean
}
type NavigationGroup = { labelKey?: string; items: NavigationItem[] }

const navigation: NavigationGroup[] = [
  { items: [
    { key: 'daily', href: '/daily', icon: CalendarCheck, matchPaths: ['/daily'] },
    { key: 'chat', href: '/chat', icon: MessageCircle, matchPaths: ['/chat'] },
    { key: 'library', href: '/library', icon: Library, matchPaths: ['/library'] },
  ] },
  { labelKey: 'groups.practice', items: [
    { key: 'grammar', href: '/grammar', icon: BookOpen, matchPaths: ['/grammar'] },
    { key: 'kanji', href: '/kanji', icon: Brush, matchPaths: ['/kanji'] },
    { key: 'listening', href: '/listening', icon: Headphones, matchPaths: ['/listening'], enabled: true },
    { key: 'games', href: '/games', icon: Gamepad2, matchPaths: ['/games'] },
  ] },
]

function isSelected(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('nav')
  const { pathname } = useLocation()
  const { data: today } = useQuery(['daily', 'today'], () => dailyAPI.getToday().then(({ data }) => data), { retry: false, staleTime: 60_000 })
  const hasPendingDaily = today?.status === 'in_progress'

  return <nav aria-label={t('mainMenu')} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
    <div className="space-y-5">
      {navigation.map((group, groupIndex) => {
        const items = group.items.filter((item) => item.enabled !== false)
        if (!items.length) return null
        return <section key={group.labelKey ?? `group-${groupIndex}`}>
          {group.labelKey && <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{t(group.labelKey)}</h2>}
          <ul className="space-y-1">{items.map((item) => {
            const active = isSelected(pathname, item.matchPaths)
            return <li key={item.key}><Link to={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn('group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active ? 'bg-[color:var(--accent)] font-semibold text-[color:var(--primary)]' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]')}>
              <item.icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{t(item.key)}</span>
              {item.key === 'daily' && hasPendingDaily && <span aria-label={t('dailyPending')} title={t('dailyPending')} className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />}
            </Link></li>
          })}</ul>
        </section>
      })}
    </div>
  </nav>
}
