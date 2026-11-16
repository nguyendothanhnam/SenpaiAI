// Translate native color syntax for the shared web palettes. The source
// remains frontend/src/themes/themes.ts; do not duplicate its color constants.
export function nativeColor(value: string): string {
  const match = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)(%)?\s*\)$/)
  if (!match) return value
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${Number(match[4]) / (match[5] ? 100 : 1)})`
}

export function gradientColors(value: string, fallback: string): [string, string, ...string[]] {
  const colors = value.match(/#[\da-f]{3,8}\b|rgba?\([^)]+\)/gi)?.map(nativeColor) || []
  return colors.length >= 2 ? colors as [string, string, ...string[]] : [fallback, fallback]
}
export function colorAlpha(value: string, opacity: number): string {
  const normalized = nativeColor(value)
  const hex = normalized.match(/^#([a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map(char => char + char).join('') : hex[1]
    return `rgba(${parseInt(digits.slice(0, 2), 16)}, ${parseInt(digits.slice(2, 4), 16)}, ${parseInt(digits.slice(4, 6), 16)}, ${opacity})`
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${opacity})` : normalized
}
function rgbChannels(value: string): number[] | null {
  const hex = value.match(/^#([a-f\d]{6})$/i)
  if (hex) return [0, 2, 4].map(index => parseInt(hex[1].slice(index, index + 2), 16))
  const rgb = nativeColor(value).match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return rgb ? rgb.slice(1, 4).map(Number) : null
}
function luminance(channels: number[]) {
  return channels.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}
export function contrastRatio(first: string, second: string) {
  const a = rgbChannels(first), b = rgbChannels(second)
  if (!a || !b) return 1
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function readableText(background: string, preferred: string, alternatives: string[]) {
  if (contrastRatio(background, preferred) >= 4.5) return preferred
  return [preferred, ...alternatives].reduce((best, color) => contrastRatio(background, color) > contrastRatio(background, best) ? color : best, preferred)
}
export function backdropPalette<T extends { text: string; textMuted: string }>(palette: T): T {
  // Stronger secondary text lets the image remain visible without sacrificing contrast.
  return { ...palette, textMuted: palette.text }
}
export function imageOverlay(palette: { bg: string; text: string; textMuted: string }, mode: 'light' | 'dark') {
  const bg = rgbChannels(palette.bg), texts = [rgbChannels(palette.text), rgbChannels(palette.textMuted)]
  if (!bg || texts.some(text => !text)) return colorAlpha(palette.bg, 0.98)
  // Choose the least tint that keeps both text tokens readable, even if the
  // image beneath is entirely black/white. A fixed tint was too weak for mint.
  for (let percent = mode === 'dark' ? 45 : 35; percent <= 98; percent++) {
    const opacity = percent / 100
    const lower = luminance(bg.map(channel => channel * opacity))
    const upper = luminance(bg.map(channel => channel * opacity + 255 * (1 - opacity)))
    if (texts.every(text => {
      const value = luminance(text!)
      if (value >= lower && value <= upper) return false
      return Math.min((Math.max(value, lower) + 0.05) / (Math.min(value, lower) + 0.05), (Math.max(value, upper) + 0.05) / (Math.min(value, upper) + 0.05)) >= 4.5
    })) return colorAlpha(palette.bg, opacity)
  }
  return palette.bg
}
