import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { defaultThemeId, ThemeMode, themeBackgrounds, themes } from './themes'

interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  themeId: string
  backgroundId: string | null
  setMode: (mode: ThemeMode) => void
  setTheme: (themeId: string) => void
  setBackground: (backgroundId: string | null) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'senpai-ai-theme-v2'

function getSavedPreferences(): { mode: ThemeMode; themeId: string; backgroundId: string | null } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const themeId = themes[saved.themeId] ? saved.themeId : defaultThemeId
    return {
      mode: ['light', 'dark', 'system'].includes(saved.mode) ? saved.mode : 'light',
      themeId,
      backgroundId: themeBackgrounds.some((background) => background.id === saved.backgroundId) ? saved.backgroundId : null,
    }
  } catch {
    return { mode: 'light', themeId: defaultThemeId, backgroundId: null }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(getSavedPreferences)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = preferences.mode === 'system' ? systemDark : preferences.mode === 'dark'
  const theme = themes[preferences.themeId]

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.theme = theme.id
    const values = theme.palettes[isDark ? 'dark' : 'light']
    const vars: Record<string, string> = {
      '--bg': values.bg,
      '--bg-elevated': values.bgElevated,
      '--card': values.card,
      '--card-glass': values.cardGlass,
      '--text': values.text,
      '--text-muted': values.textMuted,
      '--border': values.border,
      '--primary': values.primary,
      '--primary-contrast': values.primaryContrast,
      '--accent': values.accent,
      '--shadow-card': values.shadowCard,
      '--radius-card': values.radiusCard,
      '--radius-pill': values.radiusPill,
      '--font-heading': values.fontHeading,
      '--font-body': values.fontBody,
      '--bg-image': values.bgImage,
      '--bg-overlay': values.bgOverlay,
    }
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
  }, [isDark, theme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  const value = useMemo<ThemeContextValue>(() => ({
    mode: preferences.mode,
    resolvedMode: isDark ? 'dark' : 'light',
    themeId: preferences.themeId,
    backgroundId: preferences.backgroundId,
    setMode: (mode) => setPreferences((current) => ({ ...current, mode })),
    setTheme: (themeId) => {
      if (themes[themeId]) setPreferences((current) => ({ ...current, themeId, backgroundId: null }))
    },
    setBackground: (backgroundId) => {
      if (backgroundId === null || themeBackgrounds.some((background) => background.id === backgroundId)) {
        setPreferences((current) => ({ ...current, backgroundId }))
      }
    },
  }), [preferences, isDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
