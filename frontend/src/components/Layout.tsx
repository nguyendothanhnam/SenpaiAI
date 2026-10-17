import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Menu, Moon, Sun, X, Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth'
import { useTheme } from '../themes/ThemeProvider'
import { themeBackgrounds, themes } from '../themes/themes'
import { useRewardsMe } from '../services/rewards'
import catImage from '../img/cat-logo.webp'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationBell from './notifications/NotificationBell'
import SidebarNav from './layout/SidebarNav'
import UserMenu from './layout/UserMenu'

interface LayoutProps { children: ReactNode }

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation('nav')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const { data: rewards } = useRewardsMe(user?.id)
  const { mode, resolvedMode, setMode, themeId, backgroundId } = useTheme()
  const theme = themes[themeId]
  const isDark = resolvedMode === 'dark'
  const palette = theme.palettes[isDark ? 'dark' : 'light']
  const mascot = theme.mascot || catImage
  const background = themeBackgrounds.find((item) => item.id === backgroundId)?.image || theme.background[isDark ? 'dark' : 'light']
  const toggleMode = () => setMode(isDark ? 'light' : 'dark')
  const brand = <div className="theme-brand flex h-16 shrink-0 items-center gap-2 px-4">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 shadow-sm"><img src={mascot} onError={(event) => { event.currentTarget.src = catImage }} alt="SenpaiAI" className="h-11 w-11 object-contain" /></div>
    <div><h1 className="text-lg font-bold leading-tight text-[color:var(--primary-contrast)]">SenpaiAI</h1><p className="text-[10px] font-medium text-[color:var(--primary-contrast)] opacity-80">SenpaiAI</p></div>
  </div>

  return <div className="theme-shell relative isolate min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
    {background && <img src={background} alt="" aria-hidden="true" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover opacity-60" />}
    <div aria-hidden="true" className="theme-overlay pointer-events-none fixed inset-0 z-0" style={{ backgroundColor: palette.bgOverlay }} />
    <div className="relative z-10 min-h-screen">
      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <button type="button" aria-label={t('closeMenu')} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50" />
        <aside className="theme-sidebar fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-xl">
          <div className="flex items-center justify-between">{brand}<button type="button" onClick={() => setSidebarOpen(false)} aria-label={t('closeMenu')} className="mr-3 rounded-lg p-2 text-[color:var(--primary-contrast)] hover:bg-white/10"><X className="h-5 w-5" /></button></div>
          <SidebarNav onNavigate={() => setSidebarOpen(false)} />
          <UserMenu username={user?.username} level={user?.current_jlpt_level} points={user?.exercise_points ?? 0} onLogout={logout} onNavigate={() => setSidebarOpen(false)} />
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="theme-sidebar flex min-h-0 flex-1 flex-col border-r border-[color:var(--border)]">
          {brand}
          <SidebarNav />
          <UserMenu username={user?.username} level={user?.current_jlpt_level} points={user?.exercise_points ?? 0} onLogout={logout} />
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className="theme-topbar sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-[color:var(--border)] px-4 shadow-sm backdrop-blur sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" aria-label={t('openMenu')} className="-m-2.5 rounded-lg p-2.5 text-[color:var(--primary)] transition-colors hover:opacity-75 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="h-6 w-6" /></button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6"><div className="flex flex-1" /><div className="flex items-center gap-x-2 sm:gap-x-3 lg:gap-x-6">
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-[color:var(--border)]" />
            <Link to="/shop" title={t('rewardPoints')} className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm"><Coins className="h-4 w-4" /><span>{rewards?.points_balance ?? 0}</span></Link>
            <Link to="/daily" title={t('dailyStreak')} className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm"><Flame className="h-4 w-4" /><span>{rewards?.current_streak ?? 0}</span></Link>
            <span className="hidden text-sm text-[color:var(--text-muted)] md:inline">{t('jlptLevel')}</span>
            <span className="rounded-pill bg-[color:var(--accent)] px-2 py-1 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm">{user?.current_jlpt_level}</span>
            <LanguageSwitcher compact />
            <NotificationBell />
            <button type="button" onClick={toggleMode} aria-label={isDark ? t('switchLight') : t('switchDark')} title={t('mode', { mode })} className="rounded-full p-2 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          </div></div>
        </div>
        <main className="py-6"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div></main>
      </div>
    </div>
  </div>
}
