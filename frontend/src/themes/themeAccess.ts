import { themes, themeBackgrounds } from './themes'

interface UnlockedItems {
  themes: string[]
  backgrounds: string[]
}

let serverUnlockedItems: UnlockedItems = { themes: ['classic'], backgrounds: [] }

const isDevelopmentUnlockEnabled = () =>
  import.meta.env.DEV &&
  (import.meta.env as ImportMetaEnv & { VITE_UNLOCK_ALL_THEMES?: string }).VITE_UNLOCK_ALL_THEMES === 'true'

/** Called by ThemeProvider when authenticated rewards data changes. */
export function setServerUnlockedItems(items: UnlockedItems | null) {
  serverUnlockedItems = items
    ? { themes: ['classic', ...items.themes.filter((id) => id !== 'classic')], backgrounds: [...items.backgrounds] }
    : { themes: ['classic'], backgrounds: [] }
}

export function isThemeUnlocked(themeId: string): boolean {
  if (!themes[themeId]) return false
  return themeId === 'classic' || isDevelopmentUnlockEnabled() || serverUnlockedItems.themes.includes(themeId)
}

export function isBackgroundUnlocked(backgroundId: string): boolean {
  if (!themeBackgrounds.some((item) => item.id === backgroundId)) return false
  return isDevelopmentUnlockEnabled() || serverUnlockedItems.backgrounds.includes(backgroundId)
}

// Kept for existing call sites. Unlocking is controlled by the server now.
export function unlockTheme(themeId: string): boolean {
  return isThemeUnlocked(themeId)
}

export function unlockBackground(backgroundId: string): boolean {
  return isBackgroundUnlocked(backgroundId)
}

export function getUnlockedItems(): UnlockedItems {
  if (isDevelopmentUnlockEnabled()) {
    return { themes: Object.keys(themes), backgrounds: themeBackgrounds.map((item) => item.id) }
  }
  return { themes: [...serverUnlockedItems.themes], backgrounds: [...serverUnlockedItems.backgrounds] }
}
