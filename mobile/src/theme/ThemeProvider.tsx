import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useColorScheme } from 'react-native'
import { themes, type ThemeMode, type ThemePalette } from '../../../frontend/src/themes/themes'

export type MobileColors = Pick<ThemePalette, 'bg' | 'bgElevated' | 'card' | 'text' | 'textMuted' | 'border' | 'primary' | 'primaryContrast' | 'accent'>
// Registry is intentionally limited to Classic in phase 0. No copies of web colors.
export const nativeThemes = { classic: themes.classic }
export type MobileThemeId = keyof typeof nativeThemes
const KEY = 'senpaiai.theme-mode'
const isMode = (mode: unknown): mode is ThemeMode => ['light', 'dark', 'system'].includes(String(mode))
interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  colors: MobileColors
  ready: boolean
  error: boolean
  setMode: (mode: ThemeMode) => Promise<void>
}
const Context = createContext<ThemeContextValue>({ mode: 'system', resolvedMode: 'light', colors: themes.classic.palettes.light, ready: false, error: false, setMode: async () => undefined })

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme()
  const [mode, updateMode] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const resolvedMode = mode === 'system' ? systemMode === 'dark' ? 'dark' : 'light' : mode
  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(KEY).then((saved) => { if (active && isMode(saved)) updateMode(saved) })
      .catch(() => { if (active) setError(true) }).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])
  const setMode = useCallback(async (next: ThemeMode) => {
    updateMode(next)
    try { await AsyncStorage.setItem(KEY, next); setError(false) } catch { setError(true) }
  }, [])
  const value = useMemo(() => ({ mode, resolvedMode, colors: nativeThemes.classic.palettes[resolvedMode], ready, error, setMode }), [mode, resolvedMode, ready, error, setMode])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useTheme = () => useContext(Context)
