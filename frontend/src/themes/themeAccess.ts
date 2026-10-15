import { themes, themeBackgrounds } from './themes'

const STORAGE_KEY = 'senpai-ai-unlocked-v1'

interface UnlockedItems {
  themes: string[]
  backgrounds: string[]
}

const isDevelopmentUnlockEnabled = () =>
  import.meta.env.DEV &&
  (import.meta.env as ImportMetaEnv & { VITE_UNLOCK_ALL_THEMES?: string }).VITE_UNLOCK_ALL_THEMES === 'true'

// Keep persistence isolated here so these functions can later call the backend API.
function readUnlockedItems(): UnlockedItems {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      themes: Array.isArray(saved.themes) ? saved.themes.filter((id: unknown) => typeof id === 'string') : [],
      backgrounds: Array.isArray(saved.backgrounds) ? saved.backgrounds.filter((id: unknown) => typeof id === 'string') : [],
    }
  } catch {
    return { themes: [], backgrounds: [] }
  }
}

function writeUnlockedItems(items: UnlockedItems) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Access checks remain safe if browser storage is unavailable.
  }
}

export function isThemeUnlocked(themeId: string): boolean {
  const theme = themes[themeId]
  if (!theme) return false
  if (themeId === 'classic' || !theme.locked || theme.points <= 0 || isDevelopmentUnlockEnabled()) return true
  return readUnlockedItems().themes.includes(themeId)
}

export function isBackgroundUnlocked(backgroundId: string): boolean {
  const background = themeBackgrounds.find((item) => item.id === backgroundId)
  if (!background) return false
  if (!background.locked || background.points <= 0 || isDevelopmentUnlockEnabled()) return true
  return readUnlockedItems().backgrounds.includes(backgroundId)
}

export function unlockTheme(themeId: string): boolean {
  const theme = themes[themeId]
  if (!theme) return false
  if (themeId === 'classic' || !theme.locked || theme.points <= 0) return true
  const items = readUnlockedItems()
  if (!items.themes.includes(themeId)) items.themes.push(themeId)
  writeUnlockedItems(items)
  return true
}

export function unlockBackground(backgroundId: string): boolean {
  const background = themeBackgrounds.find((item) => item.id === backgroundId)
  if (!background) return false
  if (!background.locked || background.points <= 0) return true
  const items = readUnlockedItems()
  if (!items.backgrounds.includes(backgroundId)) items.backgrounds.push(backgroundId)
  writeUnlockedItems(items)
  return true
}

export function getUnlockedItems(): UnlockedItems {
  if (isDevelopmentUnlockEnabled()) {
    return {
      themes: Object.keys(themes),
      backgrounds: themeBackgrounds.map((item) => item.id),
    }
  }
  return {
    themes: Object.keys(themes).filter(isThemeUnlocked),
    backgrounds: themeBackgrounds.filter((item) => isBackgroundUnlocked(item.id)).map((item) => item.id),
  }
}
