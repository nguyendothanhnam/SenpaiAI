import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth'
import { rewardsAPI } from '../services/api'
import { rewardsMeKey, useRewardsMe } from '../services/rewards'
import { defaultThemeId, ThemeMode, themeBackgrounds, themes } from './themes'
import { isBackgroundUnlocked, isThemeUnlocked, setServerUnlockedItems } from './themeAccess'

interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  themeId: string
  backgroundId: string | null
  setMode: (mode: ThemeMode) => void
  setTheme: (themeId: string) => void
  setBackground: (backgroundId: string | null) => void
}

interface Preferences {
  mode: ThemeMode
  themeId: string
  backgroundId: string | null
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'senpai-ai-theme-v2'

function getSavedMode(): ThemeMode {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return ['light', 'dark', 'system'].includes(saved.mode) ? saved.mode : 'light'
  } catch {
    return 'light'
  }
}

const developmentUnlockEnabled = () => import.meta.env.DEV &&
  (import.meta.env as ImportMetaEnv & { VITE_UNLOCK_ALL_THEMES?: string }).VITE_UNLOCK_ALL_THEMES === 'true'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const rewards = useRewardsMe(user?.id)
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    mode: getSavedMode(), themeId: defaultThemeId, backgroundId: null,
  }))
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = preferences.mode === 'system' ? systemDark : preferences.mode === 'dark'
  const theme = themes[preferences.themeId] || themes[defaultThemeId]

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!user) {
      setServerUnlockedItems(null)
      setPreferences((current) => ({ ...current, themeId: defaultThemeId, backgroundId: null }))
      return
    }
    if (rewards.isError) {
      setServerUnlockedItems(null)
      setPreferences((current) => ({ ...current, themeId: defaultThemeId, backgroundId: null }))
      return
    }
    const data = rewards.data
    if (!data) return
    setServerUnlockedItems(data.unlocked)
    const themeId = themes[data.active_theme_id] && data.unlocked.themes.includes(data.active_theme_id)
      ? data.active_theme_id
      : defaultThemeId
    const backgroundId = data.active_background_id &&
      themeBackgrounds.some((item) => item.id === data.active_background_id) &&
      data.unlocked.backgrounds.includes(data.active_background_id)
      ? data.active_background_id
      : null
    setPreferences((current) => ({ ...current, themeId, backgroundId }))
  }, [user?.id, rewards.data, rewards.isError])

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
      '--primary-gradient': values.primaryGradient,
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: preferences.mode })) } catch { /* optional preference */ }
  }, [preferences.mode])

  const equipItem = async (payload: { theme_id?: string; background_id?: string | null }, next: Preferences) => {
    if (!user || rewards.isError) {
      setPreferences((current) => ({ ...current, themeId: defaultThemeId, backgroundId: null }))
      return
    }
    const previous = preferences
    setPreferences(next)
    try {
      const { data } = await rewardsAPI.equip(payload)
      const current = queryClient.getQueryData(rewardsMeKey(user.id)) as typeof rewards.data
      if (current) queryClient.setQueryData(rewardsMeKey(user.id), {
        ...current, active_theme_id: data.active_theme_id, active_background_id: data.active_background_id,
      })
      await queryClient.invalidateQueries(rewardsMeKey(user.id))
      await queryClient.invalidateQueries(['rewards', 'shop', user.id])
    } catch {
      setPreferences((currentPreferences) => ({
        ...currentPreferences,
        themeId: previous.themeId,
        backgroundId: previous.backgroundId,
      }))
      toast.error(t('themeShop.equipError'))
      void queryClient.invalidateQueries(rewardsMeKey(user.id))
    }
  }

  const value = useMemo<ThemeContextValue>(() => ({
    mode: preferences.mode,
    resolvedMode: isDark ? 'dark' : 'light',
    themeId: preferences.themeId,
    backgroundId: preferences.backgroundId,
    setMode: (mode) => setPreferences((current) => ({ ...current, mode })),
    setTheme: (themeId) => {
      if (!themes[themeId] || !isThemeUnlocked(themeId)) return
      const next = { ...preferences, themeId }
      if (developmentUnlockEnabled() && !rewards.data?.unlocked.themes.includes(themeId)) {
        setPreferences(next)
        return
      }
      if (preferences.themeId !== themeId) void equipItem({ theme_id: themeId }, next)
    },
    setBackground: (backgroundId) => {
      if (backgroundId !== null && (!themeBackgrounds.some((item) => item.id === backgroundId) || !isBackgroundUnlocked(backgroundId))) return
      const next = { ...preferences, backgroundId }
      if (developmentUnlockEnabled() && backgroundId && !rewards.data?.unlocked.backgrounds.includes(backgroundId)) {
        setPreferences(next)
        return
      }
      if (preferences.backgroundId !== backgroundId) void equipItem({ background_id: backgroundId }, next)
    },
  }), [preferences, isDark, user?.id, rewards.isError, rewards.data])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
