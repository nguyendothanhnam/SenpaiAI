export interface Frame { x: number; y: number; width: number; height: number }
export interface KeyboardFrame { screenX: number; screenY: number; width: number; height: number }
export function keyboardOverlap(view: Frame, keyboard?: KeyboardFrame): number {
  if (!keyboard || keyboard.height <= 0 || view.width <= 0 || view.height <= 0) return 0
  if (keyboard.screenX >= view.x + view.width || keyboard.screenX + keyboard.width <= view.x) return 0
  return Math.max(0, Math.min(view.height, view.y + view.height - keyboard.screenY))
}
// Parent navigators/safe-area views may already consume the system bottom inset.
// Only add the part still covered by this viewport, never the tab bar's height.
export function remainingBottomInset(view: Frame, windowHeight: number, inset: number, keyboardVisible: boolean) {
  if (keyboardVisible || !view.height) return 0
  return Math.max(0, inset - Math.max(0, windowHeight - (view.y + view.height)))
}
export function remainingSideInsets(view: Frame, windowWidth: number, left: number, right: number) {
  return { left: Math.max(0, left - Math.max(0, view.x)), right: Math.max(0, right - Math.max(0, windowWidth - (view.x + view.width))) }
}
export function composerHeight(contentHeight: number, availableHeight: number) {
  const maximum = Math.max(48, Math.min(150, Math.floor(availableHeight * 0.32)))
  return { height: Math.max(48, Math.min(contentHeight, maximum)), maximum, scroll: contentHeight > maximum }
}
export function focusedScrollDelta(input: Pick<Frame, 'y' | 'height'>, viewport: Pick<Frame, 'y' | 'height'>, gap = 12) {
  const top = viewport.y + gap, bottom = viewport.y + viewport.height - gap
  if (input.y < top) return input.y - top
  return Math.max(0, input.y + input.height - bottom)
}
