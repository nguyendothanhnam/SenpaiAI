import { useEffect, type RefObject } from 'react'
const stack: symbol[] = []
let originalOverflow = ''
export function useDialogFocus(ref: RefObject<HTMLElement>, open: boolean, dismiss: () => void) {
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!stack.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    const token = Symbol(); stack.push(token)
    const root = ref.current
    const focusable = () => [...(root?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || [])]
    ;(root?.querySelector<HTMLElement>('[data-autofocus]') || root)?.focus()
    const key = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss() }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); root?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement) || document.activeElement === root)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      const top = stack[stack.length - 1] === token
      const index = stack.indexOf(token); if (index >= 0) stack.splice(index, 1)
      if (!stack.length) document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', key)
      if (top && previous?.isConnected) previous.focus()
    }
  }, [ref, open, dismiss])
}
