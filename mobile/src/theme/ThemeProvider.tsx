import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useColorScheme, type ImageSourcePropType } from 'react-native'
import { type ThemeMode, type ThemePalette } from '../../../frontend/src/themes/themes'
import { activeImagePath, hasTheme, mobilePalette, nativeThemes } from '../features/shop/catalog'
import { themeImages } from './assets'
import { colorAlpha, imageOverlay } from './nativeStyle'

export type MobileColors = Pick<ThemePalette, 'bg' | 'bgElevated' | 'card' | 'cardGlass' | 'bgImage' | 'primaryGradient' | 'text' | 'textMuted' | 'border' | 'primary' | 'primaryContrast' | 'accent'> & { screen: string; scrim: string; imageOverlay: string }
// Shared web palettes; account ownership is checked by the bridge and equip API.
export { nativeThemes }
export type MobileThemeId = string
const KEY = 'senpaiai.theme-mode'
const isMode = (mode: unknown): mode is ThemeMode => ['light', 'dark', 'system'].includes(String(mode))
interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  colors: MobileColors
  activeTheme: MobileThemeId
  activeBackground: string | null
  backgroundImage: ImageSourcePropType | null
  setAccountAppearance: (account: number | null, themeId: string, backgroundId: string | null) => void
  ready: boolean
  error: boolean
  setMode: (mode: ThemeMode) => Promise<void>
}
function colorsFor(id: string, mode: 'light' | 'dark'): MobileColors {
  const palette = mobilePalette(id, mode)
  return { ...palette, screen: 'transparent', scrim: colorAlpha(palette.bg, 0.84), imageOverlay: imageOverlay(palette, mode) }
}
const Context = createContext<ThemeContextValue>({ mode: 'system', resolvedMode: 'light', activeTheme: 'classic', activeBackground: null, backgroundImage: null, setAccountAppearance: () => undefined, colors: colorsFor('classic', 'light'), ready: false, error: false, setMode: async () => undefined })

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme()
  const [mode, updateMode] = useState<ThemeMode>('system')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [appearance, updateAppearance] = useState<{ account: number | null; themeId: string; backgroundId: string | null }>({ account: null, themeId: 'classic', backgroundId: null })
  const setAccountAppearance = useCallback((account: number | null, themeId: string, backgroundId: string | null) => updateAppearance(previous => {
    const next = { account, themeId: hasTheme(themeId) ? themeId : 'classic', backgroundId }
    return previous.account === next.account && previous.themeId === next.themeId && previous.backgroundId === next.backgroundId ? previous : next
  }), [])
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
  const value = useMemo(() => ({ mode, resolvedMode, activeTheme: appearance.themeId, activeBackground: appearance.backgroundId, backgroundImage: themeImages[activeImagePath(appearance.themeId, appearance.backgroundId, resolvedMode) || ''] || null, setAccountAppearance, colors: colorsFor(appearance.themeId, resolvedMode), ready, error, setMode }), [mode, resolvedMode, appearance, setAccountAppearance, ready, error, setMode])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useTheme = () => useContext(Context)
