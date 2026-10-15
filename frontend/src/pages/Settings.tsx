import { Moon, Monitor, Sun } from 'lucide-react'
import { useTheme } from '../themes/ThemeProvider'
import { ThemeMode, themeBackgrounds, themes } from '../themes/themes'

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function Settings() {
  const { mode, resolvedMode, themeId, backgroundId, setMode, setTheme, setBackground } = useTheme()
  const activeTheme = themes[themeId]
  const defaultBackground = activeTheme.background[resolvedMode]

  return (
    <section className="mx-auto max-w-4xl space-y-8 text-[color:var(--text)]">
      <header>
        <h1 className="font-heading text-3xl font-bold">Appearance</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">Customize SenpaiAI’s colors and visual style.</p>
      </header>

      <section className="theme-card p-6">
        <h2 className="text-lg font-semibold">Display mode</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">Choose light, dark, or follow your device settings.</p>
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
        <h2 className="text-lg font-semibold">Themes</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">Theme selection is available for preview. Point costs and lock status are ready for a future theme shop.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.values(themes).map((theme) => (
            <button key={theme.id} type="button" onClick={() => setTheme(theme.id)} aria-pressed={themeId === theme.id}
              className={`theme-card overflow-hidden text-left transition-all ${themeId === theme.id ? 'ring-2 ring-[color:var(--primary)]' : 'hover:-translate-y-0.5'}`}>
              <img src={theme.background.light} alt="" loading="lazy" className="h-28 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{theme.name}</h3>
                  <span className="text-xs text-[color:var(--text-muted)]">{theme.locked ? 'Locked' : `${theme.points} points`}</span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{theme.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Backgrounds</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Choose a scene for the current theme. The same scene works in light and dark mode.</p>
          </div>
          <button type="button" onClick={() => setBackground(null)} aria-pressed={!backgroundId}
            className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${!backgroundId ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--text)]' : 'border-[color:var(--border)] hover:bg-[color:var(--accent)]'}`}>
            Theme default
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {themeBackgrounds.map((background) => {
            const selected = backgroundId ? backgroundId === background.id : defaultBackground === background.image
            return (
              <button key={background.id} type="button" onClick={() => setBackground(background.id)} aria-pressed={selected}
                className={`theme-card overflow-hidden text-left transition-all ${selected ? 'ring-2 ring-[color:var(--primary)]' : 'hover:-translate-y-0.5'}`}>
                <img src={background.image} alt="" loading="lazy" className="h-24 w-full object-cover sm:h-28" />
                <span className="block px-3 py-2 text-sm font-medium">{background.name}</span>
              </button>
            )
          })}
        </div>
      </section>
    </section>
  )
}
