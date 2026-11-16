import assert from 'node:assert/strict'
import test from 'node:test'
import { composerHeight, focusedScrollDelta, keyboardOverlap, remainingBottomInset, remainingSideInsets } from '../src/features/keyboard/geometry'

test('keyboard avoidance uses measured header position on Android and iPhone', () => {
  assert.equal(keyboardOverlap({ x: 0, y: 80, width: 393, height: 720 }, { screenX: 0, screenY: 500, width: 393, height: 300 }), 300)
  assert.equal(keyboardOverlap({ x: 0, y: 97, width: 393, height: 747 }, { screenX: 0, screenY: 510, width: 393, height: 334 }), 334)
  assert.equal(keyboardOverlap({ x: 0, y: 0, width: 393, height: 0 }, { screenX: 0, screenY: 510, width: 393, height: 334 }), 0)
})
test('Android OS resize and a tab bar already outside the viewport are not counted twice', () => {
  const keyboard = { screenX: 0, screenY: 500, width: 393, height: 300 }
  assert.equal(keyboardOverlap({ x: 0, y: 80, width: 393, height: 420 }, keyboard), 0)
  assert.equal(keyboardOverlap({ x: 0, y: 80, width: 393, height: 360 }, keyboard), 0)
  assert.equal(keyboardOverlap({ x: 0, y: 80, width: 393, height: 640 }, keyboard), 220)
})
test('safe-area bottom is applied once and removed above an open keyboard', () => {
  const fullscreen = { x: 0, y: 97, width: 393, height: 747 }
  assert.equal(remainingBottomInset(fullscreen, 844, 34, false), 34)
  assert.equal(remainingBottomInset(fullscreen, 844, 34, true), 0)
  assert.equal(remainingBottomInset({ ...fullscreen, height: 713 }, 844, 34, false), 0)
  assert.equal(remainingBottomInset({ ...fullscreen, height: 665 }, 844, 34, false), 0)
  assert.equal(remainingBottomInset({ ...fullscreen, height: 727 }, 844, 34, false), 14)
})
test('keyboard size changes and rotation recompute overlap without leaving a closed-keyboard gap', () => {
  for (const [width, height, header] of [[393, 844, 97], [844, 393, 53], [320, 568, 64]]) {
    const view = { x: 0, y: header, width, height: height - header }
    for (const kbHeight of [150, 240, 300]) {
      const keyboard = { screenX: 0, screenY: height - kbHeight, width, height: kbHeight }
      assert.equal(keyboardOverlap(view, keyboard), Math.min(view.height, kbHeight))
      assert.equal(keyboardOverlap(view), 0)
    }
  }
  assert.equal(keyboardOverlap({ x: 0, y: 0, width: 390, height: 800 }, { screenX: 500, screenY: 400, width: 200, height: 300 }), 0)
})
test('growing composer stays bounded on small and landscape screens, then shrinks on clearing', () => {
  assert.deepEqual(composerHeight(500, 600), { height: 150, maximum: 150, scroll: true })
  assert.deepEqual(composerHeight(500, 150), { height: 48, maximum: 48, scroll: true })
  assert.equal(composerHeight(76, 600).height, 76)
  assert.equal(composerHeight(0, 600).height, 48)
})
test('landscape notch insets are not doubled inside a parent SafeAreaView', () => {
  assert.deepEqual(remainingSideInsets({ x: 0, y: 0, width: 844, height: 393 }, 844, 44, 44), { left: 44, right: 44 })
  assert.deepEqual(remainingSideInsets({ x: 44, y: 0, width: 756, height: 393 }, 844, 44, 44), { left: 0, right: 0 })
})
test('focused input scrolling uses its actual viewport and does not move already visible fields', () => {
  const viewport = { y: 85, height: 300 }
  assert.equal(focusedScrollDelta({ y: 360, height: 48 }, viewport), 35)
  assert.equal(focusedScrollDelta({ y: 120, height: 48 }, viewport), 0)
  assert.equal(focusedScrollDelta({ y: 70, height: 48 }, viewport), -27)
  assert.equal(focusedScrollDelta({ y: 300, height: 48 }, { y: 85, height: 200 }), 75)
})
