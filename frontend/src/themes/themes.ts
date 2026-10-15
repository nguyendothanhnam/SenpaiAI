export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemePalette {
  bg: string
  bgElevated: string
  card: string
  cardGlass: string
  text: string
  textMuted: string
  border: string
  primary: string
  primaryContrast: string
  accent: string
  shadowCard: string
  radiusCard: string
  radiusPill: string
  fontHeading: string
  fontBody: string
  bgImage: string
  bgOverlay: string
}

export interface ThemeDefinition {
  id: string
  name: string
  description: string
  points: number
  locked: boolean
  mascot: string
  background: Record<'light' | 'dark', string>
  palettes: Record<'light' | 'dark', ThemePalette>
}

export interface ThemeBackground {
  id: string
  name: string
  image: string
}

export const themeBackgrounds: ThemeBackground[] = [
  { id: 'fuji-reading', name: 'Fuji Reading', image: '/themes/background1.webp' },
  { id: 'hydrangea-garden', name: 'Hydrangea Garden', image: '/themes/background2.webp' },
  { id: 'zen-samurai', name: 'Zen Samurai', image: '/themes/background3.webp' },
  { id: 'bamboo-shrine', name: 'Bamboo Shrine', image: '/themes/background4.webp' },
  { id: 'bamboo-night', name: 'Bamboo Night', image: '/themes/background5.webp' },
  { id: 'sakura-shrine', name: 'Sakura Shrine', image: '/themes/background6.webp' },
  { id: 'bamboo-path', name: 'Bamboo Path', image: '/themes/background7.webp' },
  { id: 'bonsai-tea', name: 'Bonsai Tea Garden', image: '/themes/background8.webp' },
  { id: 'spring-koinobori', name: 'Spring Koinobori', image: '/themes/background9.webp' },
  { id: 'sakura-picnic', name: 'Sakura Picnic', image: '/themes/background10.webp' },
  { id: 'cherry-torii', name: 'Cherry Blossom Torii', image: '/themes/background11.webp' },
  { id: 'calligraphy-cat', name: 'Calligraphy Cat', image: '/themes/background12.webp' },
  { id: 'sakura-path', name: 'Sakura Path', image: '/themes/background13.webp' },
]

const palette = (values: Omit<ThemePalette, 'bgImage' | 'bgOverlay'>, bgImage: string, bgOverlay: string): ThemePalette => ({
  ...values,
  bgImage,
  bgOverlay,
})

const shared = {
  shadowCard: '0 12px 36px rgb(24 54 48 / 12%)',
  radiusCard: '1.25rem',
  radiusPill: '9999px',
  fontHeading: 'Inter, "Noto Sans JP", system-ui, sans-serif',
  fontBody: 'Inter, "Noto Sans JP", system-ui, sans-serif',
}

export const themes: Record<string, ThemeDefinition> = {
  'than-khe': {
    id: 'than-khe',
    name: 'Thần Khê',
    description: 'Sắc mint dịu nhẹ, lấy cảm hứng từ khu vườn Nhật Bản.',
    points: 0,
    locked: false,
    mascot: '/themes/than-khe/cat.webp',
    background: {
      light: '/themes/background4.webp',
      dark: '/themes/background5.webp',
    },
    palettes: {
      light: palette({ ...shared, bg: '#e8f5ef', bgElevated: '#f5fbf7', card: '#ffffff', cardGlass: 'rgb(248 255 251 / 88%)', text: '#17352f', textMuted: '#526e66', border: '#c8e3d7', primary: '#21856d', primaryContrast: '#ffffff', accent: '#d3eee2' }, 'linear-gradient(135deg, #dff3e8 0%, #f8f5df 55%, #d8eee5 100%)', 'rgb(232 245 239 / 48%)'),
      dark: palette({ ...shared, shadowCard: '0 12px 36px rgb(0 0 0 / 28%)', bg: '#102b29', bgElevated: '#183936', card: '#1c403c', cardGlass: 'rgb(17 47 43 / 88%)', text: '#eef8f1', textMuted: '#b4d0c4', border: '#315d54', primary: '#74c9a7', primaryContrast: '#102b29', accent: '#28564b' }, 'linear-gradient(135deg, #102a2a 0%, #173d38 55%, #1a3531 100%)', 'rgb(8 25 25 / 38%)'),
    },
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    description: 'Tông hồng hoa anh đào nhẹ nhàng, ấm áp.',
    points: 0,
    locked: false,
    mascot: '/themes/sakura/cat.webp',
    background: {
      light: '/themes/background10.webp',
      dark: '/themes/background11.webp',
    },
    palettes: {
      light: palette({ ...shared, bg: '#fff2f1', bgElevated: '#fff9f6', card: '#ffffff', cardGlass: 'rgb(255 250 248 / 90%)', text: '#462b32', textMuted: '#765c62', border: '#f0d1d1', primary: '#a83f50', primaryContrast: '#ffffff', accent: '#f9dede' }, 'linear-gradient(135deg, #ffe4df 0%, #fff5e8 55%, #f7dfe5 100%)', 'rgb(255 242 239 / 48%)'),
      dark: palette({ ...shared, shadowCard: '0 12px 36px rgb(0 0 0 / 30%)', bg: '#2b1d25', bgElevated: '#392630', card: '#452d39', cardGlass: 'rgb(54 34 45 / 90%)', text: '#fff2ef', textMuted: '#dfc2c7', border: '#684452', primary: '#f09aaa', primaryContrast: '#321d25', accent: '#593644' }, 'linear-gradient(135deg, #32202b 0%, #4a2b3a 55%, #392532 100%)', 'rgb(30 17 25 / 66%)'),
    },
  },
}

export const defaultThemeId = 'than-khe'
