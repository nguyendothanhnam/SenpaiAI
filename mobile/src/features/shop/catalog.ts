import { themes, themeBackgrounds, type ThemePalette } from '../../../../frontend/src/themes/themes'
import { nativeColor } from '../../theme/nativeStyle'
import type { ShopCatalog, ShopItem, ShopProfile } from './types'

export const nativeThemes = themes
export function hasTheme(id: string) { return Object.prototype.hasOwnProperty.call(themes, id) }
export function mobilePalette(id: string, mode: 'light' | 'dark'): ThemePalette {
  const palette = (hasTheme(id) ? themes[id] : themes.classic).palettes[mode]
  return { ...palette, bg: nativeColor(palette.bg), bgElevated: nativeColor(palette.bgElevated), card: nativeColor(palette.card), cardGlass: nativeColor(palette.cardGlass), text: nativeColor(palette.text), textMuted: nativeColor(palette.textMuted), border: nativeColor(palette.border), primary: nativeColor(palette.primary), primaryContrast: nativeColor(palette.primaryContrast), accent: nativeColor(palette.accent), bgOverlay: nativeColor(palette.bgOverlay) }
}
export interface CatalogEntry { item: ShopItem; supported: boolean; imagePath: string | null; mascotMissing: boolean }
export function mergeCatalog(catalog: ShopCatalog, mode: 'light' | 'dark', availableImages: ReadonlySet<string>): CatalogEntry[] {
  // Server catalog controls membership and price. Shared web data only controls presentation.
  return [...catalog.themes.map(item => ({ ...item, item_type: 'theme' as const })), ...catalog.backgrounds.map(item => ({ ...item, item_type: 'background' as const }))].map(item => {
    const theme = item.item_type === 'theme' && hasTheme(item.id) ? themes[item.id] : undefined
    const background = item.item_type === 'background' ? themeBackgrounds.find(background => background.id === item.id) : undefined
    const imagePath = theme ? theme.background[mode] || null : background?.image || item.image || null
    const supported = item.item_type === 'theme' ? !!theme : !!background && !!imagePath && availableImages.has(imagePath)
    return { item, supported, imagePath: imagePath && availableImages.has(imagePath) ? imagePath : null, mascotMissing: !!theme?.mascot && !availableImages.has(theme.mascot) }
  })
}
export function accountAppearance(profile?: ShopProfile) {
  const theme = profile?.active_theme_id
  return {
    themeId: theme && hasTheme(theme) && (theme === 'classic' || profile.unlocked?.themes.includes(theme)) ? theme : 'classic',
    backgroundId: profile?.active_background_id && profile.unlocked?.backgrounds.includes(profile.active_background_id) ? profile.active_background_id : null,
  }
}
export function activeImagePath(themeId: string, backgroundId: string | null, mode: 'light' | 'dark') {
  return themeBackgrounds.find(item => item.id === backgroundId)?.image || (hasTheme(themeId) ? themes[themeId].background[mode] : '') || null
}
