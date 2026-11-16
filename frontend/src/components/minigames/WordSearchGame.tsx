import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { lineCells, type Action, type Cell, type Round } from '../../../../shared-games'
export default function WordSearchGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), board = round.wordsearch
  const root = useRef<HTMLDivElement>(null), drag = useRef<{ start: Cell; end: Cell; pointer: number } | null>(null)
  const [preview, setPreview] = useState<Cell[]>([]), [anchor, setAnchor] = useState<Cell | null>(null)
  useEffect(() => { if (round.session.status !== 'playing') { drag.current = null; setPreview([]); setAnchor(null) } }, [round.session.status])
  if (!board) return null
  const cellAt = (event: PointerEvent): Cell | null => {
    const bounds = root.current?.getBoundingClientRect()
    if (!bounds?.width || !bounds.height) return null
    const col = Math.floor((event.clientX - bounds.left) * board.size / bounds.width), row = Math.floor((event.clientY - bounds.top) * board.size / bounds.height)
    return row >= 0 && col >= 0 && row < board.size && col < board.size ? { row, col } : null
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: Cell) => {
    if (round.session.status !== 'playing') return
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (delta[event.key]) {
      event.preventDefault(); const [dr, dc] = delta[event.key], row = cell.row + dr, col = cell.col + dc
      root.current?.querySelector<HTMLButtonElement>(`[data-cell="${row}:${col}"]`)?.focus()
    }
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault()
      if (!anchor) { setAnchor(cell); setPreview([cell]) }
      else { onAction({ type: 'selectPath', cells: lineCells(anchor, cell) }); setAnchor(null); setPreview([]) }
    }
  }
  const traces = board.words.filter(word => board.found.includes(word.item.id)).map(word => word.cells)
  return <div>
    <p className="mg-muted">{t('minigames2.searchControls')}</p><p className="mg-muted">{t(board.reverse ? 'minigames2.reverseOn' : 'minigames2.reverseOff')}</p>
    <div ref={root} className="mg-word-grid" style={{ gridTemplateColumns: `repeat(${board.size},minmax(0,1fr))` }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0 || round.session.status !== 'playing') return; const cell = cellAt(event); if (!cell) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { start: cell, end: cell, pointer: event.pointerId }; setAnchor(null); setPreview([cell]) }}
      onPointerMove={event => { const active = drag.current; if (!active || active.pointer !== event.pointerId) return; const cell = cellAt(event); if (cell) { active.end = cell; setPreview(lineCells(active.start, cell)) } }}
      onPointerUp={event => { const active = drag.current; if (!active || active.pointer !== event.pointerId) return; const cell = cellAt(event) || active.end; drag.current = null; setPreview([]); onAction({ type: 'selectPath', cells: lineCells(active.start, cell) }); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { drag.current = null; setPreview([]) }}>
      {board.grid.flatMap((row, r) => row.map((char, c) => <button type="button" className={`mg-word-cell ${preview.some(cell => cell.row === r && cell.col === c) ? 'mg-selected' : ''}`} data-cell={`${r}:${c}`} key={`${r}:${c}`} onKeyDown={event => keyDown(event, { row: r, col: c })} aria-label={t('minigames2.gridCell', { row: r + 1, col: c + 1, kana: char })}>{char}</button>))}
      <svg className="mg-grid-lines" viewBox={`0 0 ${board.size} ${board.size}`} aria-hidden="true">{[...traces, preview].filter(cells => cells.length > 1).map((cells, index) => <line key={index} x1={cells[0].col + .5} y1={cells[0].row + .5} x2={cells[cells.length - 1].col + .5} y2={cells[cells.length - 1].row + .5} stroke="var(--primary)" strokeWidth=".65" strokeOpacity=".25" strokeLinecap="round" />)}</svg>
    </div>
    <ul className="mg-search-targets">{board.words.map(word => <li key={word.item.id} className={board.found.includes(word.item.id) ? 'mg-found' : ''}>{word.text}<small>{word.item.word}</small>{board.found.includes(word.item.id) && <span aria-label={t('minigames2.wordFound')}>✓</span>}</li>)}</ul>
    <p className="mg-muted">{t('minigames2.searchProgress', { count: board.found.length, total: board.words.length })}</p>
  </div>
}
