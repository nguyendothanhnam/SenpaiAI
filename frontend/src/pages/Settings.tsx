import { Lock, Moon, Monitor, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'
import { ThemeMode, themeBackgrounds, themes } from '../themes/themes'
import { isBackgroundUnlocked, isThemeUnlocked } from '../themes/themeAccess'

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo thiết bị', icon: Monitor },
]

const lockedMessage = 'Mục này đang khóa. Mở cửa hàng để xem giá và mua bằng điểm.'

export default function Settings() {
  const { mode, resolvedMode, themeId, backgroundId, setMode, setTheme, setBackground } = useTheme()
  const navigate = useNavigate()
  const activeTheme = themes[themeId]
  const defaultBackground = activeTheme.background[resolvedMode]

  return (
    <section className="mx-auto max-w-4xl space-y-8 text-[color:var(--text)]">
      <header>
        <h1 className="font-heading text-3xl font-bold">Giao diện</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">Tùy chỉnh màu sắc và phong cách hiển thị của SenpaiAI.</p>
      </header>

      <section className="theme-card p-6">
        <h2 className="text-lg font-semibold">Chế độ hiển thị</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">Chọn giao diện sáng, tối hoặc theo thiết bị.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {modes.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value}
              className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm transition-colors ${mode === value ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--accent)]'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Chủ đề</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Chế độ sáng và tối luôn miễn phí cho mọi chủ đề.</p>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-[color:var(--primary)] hover:underline">Cửa hàng giao diện</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.values(themes).map((theme) => {
            const unlocked = isThemeUnlocked(theme.id)
            const status = !unlocked
              ? `Khóa • ${theme.points} điểm`
              : theme.points === 0
                ? 'Miễn phí'
                : 'Đã mở khóa'
            return (
              <button key={theme.id} type="button" onClick={() => {
                if (!unlocked) {
                  toast(lockedMessage)
                  navigate('/shop')
                  return
                }
                setTheme(theme.id)
              }} aria-pressed={themeId === theme.id}
                className={`theme-card overflow-hidden text-left transition-all ${!unlocked ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5'} ${themeId === theme.id ? 'ring-2 ring-[color:var(--primary)]' : ''}`}>
                {theme.background.light ? (
                  <img src={theme.background.light} alt="" loading="lazy" className="h-28 w-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="h-28 w-full" style={{ backgroundImage: theme.palettes.light.bgImage }} />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{theme.name}</h3>
                    <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
                      {!unlocked && <Lock aria-hidden="true" className="h-3.5 w-3.5" />}{status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">{theme.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Hình nền</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Chọn khung cảnh cho giao diện, dùng được ở cả chế độ sáng và tối.</p>
          </div>
          <button type="button" onClick={() => setBackground(null)} aria-pressed={!backgroundId}
            className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${!backgroundId ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--text)]' : 'border-[color:var(--border)] hover:bg-[color:var(--accent)]'}`}>
            Nền mặc định
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {themeBackgrounds.map((background) => {
            const selected = backgroundId ? backgroundId === background.id : defaultBackground === background.image
            const unlocked = isBackgroundUnlocked(background.id)
            const status = unlocked ? 'Đã mở khóa' : `Khóa • ${background.points} điểm`
            return (
              <button key={background.id} type="button" onClick={() => {
                if (!unlocked) {
                  toast(lockedMessage)
                  navigate('/shop')
                  return
                }
                setBackground(background.id)
              }} aria-pressed={selected}
                className={`theme-card overflow-hidden text-left transition-all ${!unlocked ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5'} ${selected ? 'ring-2 ring-[color:var(--primary)]' : ''}`}>
                <img src={background.image} alt="" loading="lazy" className="h-24 w-full object-cover sm:h-28" />
                <span className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                  <span>{background.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[color:var(--text-muted)]">
                    {!unlocked && <Lock aria-hidden="true" className="h-3.5 w-3.5" />}{status}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </section>
  )
}
