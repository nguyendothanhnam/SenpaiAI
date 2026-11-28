import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import KanjiLookupDialog from './KanjiLookupDialog'

function kanjiCharacters(text: string) { return [...new Set(Array.from(text).filter(c => /\p{Script=Han}/u.test(c)))].slice(0, 40) }
const LookupContext = createContext<((value: string) => void) | null>(null)
export const useKanjiLookup = () => useContext(LookupContext)
export default function KanjiLookupScope({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const enabled = /^\/(?:chat|library|placement|daily|grammar|games|quiz|flashcard|listening|kanji)(?:\/|$)/.test(pathname)
  return enabled ? <Lookup key={pathname}>{children}</Lookup> : <>{children}</>
}
function Lookup({ children }: { children: ReactNode }) {
  const [kanji, setKanji] = useState('')
  const close = useCallback(() => setKanji(''), [])
  const pause = () => window.dispatchEvent(new Event('kanji-lookup-open'))
  const open = (value: string) => { pause(); setKanji(value) }
  const click = (event: MouseEvent<HTMLDivElement>) => {
    if (window.getSelection()?.toString()) return
    const element = event.target instanceof Element ? event.target : null
    if (!element || element.closest('[data-kanji-lookup-blocked="true"],[data-kanji-tools],input,textarea,select,[contenteditable=true],button,a,[role=button],svg')) return
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
    const caret = doc.caretPositionFromPoint?.(event.clientX, event.clientY)
    const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY)
    const node = caret?.offsetNode || range?.startContainer, offset = caret?.offset ?? range?.startOffset ?? 0
    let hit = ''
    if (node?.nodeType === Node.TEXT_NODE && event.currentTarget.contains(node)) {
      for (const index of [offset, offset - 1]) {
        const text = node.textContent || '', char = String.fromCodePoint(text.codePointAt(index) || 0)
        if (index < 0 || !kanjiCharacters(char).length) continue
        const cell = document.createRange(); cell.setStart(node, index); cell.setEnd(node, Math.min(text.length, index + char.length))
        const box = cell.getBoundingClientRect()
        if (event.clientX >= box.left - 2 && event.clientX <= box.right + 2 && event.clientY >= box.top - 2 && event.clientY <= box.bottom + 2) { hit = char; break }
      }
    }
    if (hit) { event.preventDefault(); event.stopPropagation(); open(hit) }
  }
  return <LookupContext.Provider value={open}><div onClickCapture={click}>
    {children}{kanji && <KanjiLookupDialog key={kanji} kanji={kanji} onClose={close} />}
  </div></LookupContext.Provider>
}
