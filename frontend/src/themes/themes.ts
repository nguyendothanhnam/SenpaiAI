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
  primaryGradient: string
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
  mascot: string | null
  background: Record<'light' | 'dark', string>
  palettes: Record<'light' | 'dark', ThemePalette>
}

export interface ThemeBackground {
  id: string
  name: string
  image: string
  points: number
  locked: boolean
}

export const themeBackgrounds: ThemeBackground[] = [
  { id: 'fuji-reading', name: 'Đọc sách dưới núi Phú Sĩ', image: '/themes/background1.webp', points: 100, locked: true },
  { id: 'hydrangea-garden', name: 'Vườn cẩm tú cầu', image: '/themes/background2.webp', points: 100, locked: true },
  { id: 'zen-samurai', name: 'Vườn thiền Samurai', image: '/themes/background3.webp', points: 100, locked: true },
  { id: 'bamboo-shrine', name: 'Đền giữa rừng trúc', image: '/themes/background4.webp', points: 100, locked: true },
  { id: 'bamboo-night', name: 'Rừng trúc đêm', image: '/themes/background5.webp', points: 100, locked: true },
  { id: 'sakura-shrine', name: 'Đền hoa anh đào', image: '/themes/background6.webp', points: 100, locked: true },
  { id: 'bamboo-path', name: 'Lối đi rừng trúc', image: '/themes/background7.webp', points: 100, locked: true },
  { id: 'bonsai-tea', name: 'Vườn bonsai và trà', image: '/themes/background8.webp', points: 100, locked: true },
  { id: 'spring-koinobori', name: 'Cờ cá chép mùa xuân', image: '/themes/background9.webp', points: 100, locked: true },
  { id: 'sakura-picnic', name: 'Dã ngoại dưới hoa anh đào', image: '/themes/background10.webp', points: 100, locked: true },
  { id: 'cherry-torii', name: 'Cổng Torii mùa hoa', image: '/themes/background11.webp', points: 100, locked: true },
  { id: 'calligraphy-cat', name: 'Mèo luyện thư pháp', image: '/themes/background12.webp', points: 100, locked: true },
  { id: 'sakura-path', name: 'Đường hoa anh đào', image: '/themes/background13.webp', points: 100, locked: true },
]

const palette = (values: Omit<ThemePalette, 'bgImage' | 'bgOverlay' | 'primaryGradient'>, bgImage: string, bgOverlay: string, primaryGradient = values.primary): ThemePalette => ({
  ...values,
  primaryGradient,
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
  classic: {
    id: 'classic',
    name: 'Cổ điển',
    description: 'Phong cách SenpaiAI nguyên bản với sắc cam ấm.',
    points: 0,
    locked: false,
    mascot: null,
    background: { light: '', dark: '' },
    palettes: {
      light: palette({ ...shared, bg: '#fff7ed', bgElevated: '#ffffff', card: '#ffffff', cardGlass: 'rgb(255 255 255 / 85%)', text: '#111827', textMuted: '#4b5563', border: '#ffedd5', primary: '#ea580c', primaryContrast: '#ffffff', accent: '#ffedd5' }, 'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #ffedd5 100%)', 'transparent', 'linear-gradient(90deg, #f97316, #f59e0b, #ea580c)'),
      dark: palette({ ...shared, shadowCard: '0 12px 36px rgb(0 0 0 / 35%)', bg: '#1c1410', bgElevated: '#261b15', card: '#2f221a', cardGlass: 'rgb(38 27 21 / 88%)', text: '#fdf2e9', textMuted: '#d6bfae', border: '#4a3426', primary: '#fb923c', primaryContrast: '#1c1410', accent: '#3d2a1d' }, 'linear-gradient(135deg, #1c1410 0%, #261b15 55%, #2a1c14 100%)', 'transparent', 'linear-gradient(90deg, #ea580c, #f59e0b)'),
    },
  },
  'than-khe': {
    id: 'than-khe',
    name: 'Thần Khê',
    description: 'Sắc mint dịu nhẹ, lấy cảm hứng từ khu vườn Nhật Bản.',
    points: 300,
    locked: true,
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
    points: 300,
    locked: true,
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

export const defaultThemeId = 'classic'
