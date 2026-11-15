import assert from 'node:assert/strict'
import test from 'node:test'
import { themes } from '../../frontend/src/themes/themes'
import { gradientColors, nativeColor } from '../src/theme/nativeStyle'

test('native authentication styles read Classic light and dark colors from the web', () => {
  for (const mode of ['light', 'dark'] as const) {
    const palette = themes.classic.palettes[mode]
    const background = gradientColors(palette.bgImage, palette.bg)
    const primary = gradientColors(palette.primaryGradient, palette.primary)
    assert.equal(background[0], palette.bg)
    assert.ok(background.length >= 2)
    assert.ok(primary.length >= 2)
    assert.match(nativeColor(palette.cardGlass), /^rgba\(\d+, \d+, \d+, 0\.\d+\)$/)
  }
})
test('gradient fallback and RGB alpha conversion retain valid native colors', () => {
  assert.deepEqual(gradientColors('', '#123456'), ['#123456', '#123456'])
  assert.equal(nativeColor('rgb(255 255 255 / 85%)'), 'rgba(255, 255, 255, 0.85)')
  assert.equal(nativeColor('rgb(38 27 21 / 0.88)'), 'rgba(38, 27, 21, 0.88)')
  assert.equal(nativeColor('#ea580c'), '#ea580c')
})
