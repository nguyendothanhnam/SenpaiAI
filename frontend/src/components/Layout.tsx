import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  MessageCircle, 
  BookOpen, 
  Library, 
  User, 
  Menu, 
  X,
  LogOut,
  Brush,
  Moon,
  Sun,
  Settings as SettingsIcon,
  Brain,
  Coins,
  Flame,
} from 'lucide-react'
import { useAuth } from '../services/auth'
import { cn } from '../utils/helpers'
import { Gamepad2 } from 'lucide-react'
import catImage from "../img/cat-logo.webp";
import { useTheme } from '../themes/ThemeProvider'
import { themeBackgrounds, themes } from '../themes/themes'
import { useRewardsMe } from '../services/rewards'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'Grammar', href: '/grammar', icon: BookOpen },
  { name: 'Luyện ngữ pháp', href: '/grammar/practice', icon: Brain },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Games', href: '/games', icon: Gamepad2 },
  { name: 'Cửa hàng giao diện', href: '/shop', icon: Brush },
  { name: 'Hằng ngày', href: '/daily', icon: Flame },
  { name: 'Kanji Practice', href: '/kanji', icon: Brush },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
]

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const { data: rewards } = useRewardsMe(user?.id)
  const location = useLocation()
  const { mode, resolvedMode, setMode, themeId, backgroundId } = useTheme()
  const theme = themes[themeId]
  const isDark = resolvedMode === 'dark'
  const palette = theme.palettes[isDark ? 'dark' : 'light']
  const mascot = theme.mascot || catImage
  const background = themeBackgrounds.find((item) => item.id === backgroundId)?.image || theme.background[isDark ? 'dark' : 'light']
  const toggleMode = () => setMode(isDark ? 'light' : 'dark')

  return (
      <div className="theme-shell relative isolate min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      {background && <img src={background} alt="" aria-hidden="true" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover opacity-60" />}
      <div aria-hidden="true" className="theme-overlay pointer-events-none fixed inset-0 z-0" style={{ backgroundColor: palette.bgOverlay }} />
      <div className="relative z-10 min-h-screen">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
          <div className="theme-sidebar fixed inset-y-0 left-0 flex w-64 flex-col shadow-xl">
            <div className="theme-brand flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 shadow-sm">
                <img src={mascot} onError={(event) => { event.currentTarget.src = catImage }} alt="SenpaiAI Cat" className="h-11 w-11 object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight text-[color:var(--primary-contrast)]">SenpaiAI</h1>
                <p className="text-[10px] font-medium text-[color:var(--primary-contrast)] opacity-80">SenpaiAI</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-[color:var(--primary-contrast)] opacity-75 hover:opacity-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-[color:var(--accent)] text-[color:var(--primary)] font-semibold"
                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>
          <div className="border-t border-[color:var(--border)] p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)]">
                  <span className="text-sm font-medium text-[color:var(--primary-contrast)]">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-[color:var(--text)]">{user?.username}</p>
                <p className="text-xs font-medium text-[color:var(--primary)]">{user?.current_jlpt_level}</p>
                <p className="text-xs font-medium text-[color:var(--text-muted)]">{user?.exercise_points ?? 0} điểm bài tập</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 flex w-full items-center rounded-lg px-3 py-2 text-sm text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="theme-sidebar flex flex-col flex-grow border-r border-[color:var(--border)]">
          <div className="theme-brand flex h-16 items-center px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 shadow-sm">
                <img
                  src={mascot}
                  onError={(event) => { event.currentTarget.src = catImage }}
                  alt="SenpaiAI Cat"
                  className="h-11 w-11 object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight text-[color:var(--primary-contrast)]">SenpaiAI</h1>
                <p className="text-[10px] font-medium text-[color:var(--primary-contrast)] opacity-80">SenpaiAI</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-4 py-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-[color:var(--accent)] text-[color:var(--primary)] font-semibold"
                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>
          <div className="border-t border-[color:var(--border)] p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)]">
                  <span className="text-sm font-medium text-[color:var(--primary-contrast)]">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-[color:var(--text)]">{user?.username}</p>
                <p className="text-xs font-medium text-[color:var(--primary)]">{user?.current_jlpt_level}</p>
                <p className="text-xs font-medium text-[color:var(--text-muted)]">{user?.exercise_points ?? 0} điểm bài tập</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 flex w-full items-center rounded-lg px-3 py-2 text-sm text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="theme-topbar sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-[color:var(--border)] px-4 shadow-sm backdrop-blur sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-[color:var(--primary)] transition-colors hover:opacity-75 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-[color:var(--border)]" />
              <div className="flex items-center gap-x-2">
                <Link to="/shop" title="Điểm thưởng" className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm">
                  <Coins className="h-4 w-4" /><span>{rewards?.points_balance ?? 0}</span>
                </Link>
                <Link to="/daily" title="Streak và nhiệm vụ hằng ngày" className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm">
                  <Flame className="h-4 w-4" /><span>{rewards?.current_streak ?? 0}</span>
                </Link>
                <span className="hidden text-sm text-[color:var(--text-muted)] md:inline">JLPT Level:</span>
                <span className="rounded-pill bg-[color:var(--accent)] px-2 py-1 text-xs font-semibold text-[color:var(--primary)] sm:px-3 sm:text-sm">{user?.current_jlpt_level}</span>
                <span className="hidden rounded-pill bg-[color:var(--accent)] px-3 py-1 text-sm font-semibold text-[color:var(--primary)] sm:inline-flex">{user?.exercise_points ?? 0} điểm</span>
                <button type="button" onClick={toggleMode} aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title={`Chế độ: ${mode}`} className="rounded-full p-2 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]">
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      </div>
    </div>
  )
}

