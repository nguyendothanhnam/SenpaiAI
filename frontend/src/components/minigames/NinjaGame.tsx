import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { distance, flyingPosition, ninjaValue, slashNinja, type Action, type Round, type SwipePoint } from '../../../../shared-games'

export default function NinjaGame({ round, onAction }: { round: Round; onAction: (action: Action) => void }) {
  const { t } = useTranslation('common'), board = round.ninja
  const root = useRef<HTMLDivElement>(null), pointer = useRef<number | null>(null), pending = useRef<SwipePoint[]>([]), current = useRef(board)
  const gestureHit = useRef(false)
  const previous = useRef({ score: round.session.score, lives: round.session.lives })
  const [trail, setTrail] = useState<SwipePoint[]>([])
  const [feedback, setFeedback] = useState<{ gain: number; lost: number; empty?: boolean } | null>(null)
  current.current = board
  useEffect(() => {
    const gain = round.session.score - previous.current.score, lost = previous.current.lives - round.session.lives
    previous.current = { score: round.session.score, lives: round.session.lives }
    if (gain || lost) setFeedback({ gain, lost })
  }, [round.session.score, round.session.lives])
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 1500); return () => window.clearTimeout(timer) }, [feedback])
  useEffect(() => { if (round.session.status !== 'playing') { pointer.current = null; pending.current = []; setTrail([]) } }, [round.session.status])
  if (!board) return null
  const pointAt = (event: PointerEvent): SwipePoint | null => {
    const rect = root.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    return { x: (event.clientX - rect.left) * 100 / rect.width, y: (event.clientY - rect.top) * 100 / rect.height, atMs: current.current?.timeMs || 0 }
  }
  const slash = (points: SwipePoint[]) => {
    if (current.current) {
      const result = slashNinja(current.current, points, round.mode)
      if (result.correct || result.wrong) gestureHit.current = true
    }
    onAction({ type: 'slash', points })
  }
  const addPoint = (event: PointerEvent) => {
    if (event.pointerId !== pointer.current || round.session.status !== 'playing') return
    const point = pointAt(event)
    if (!point) return
    const last = pending.current[pending.current.length - 1]
    if (last && distance(last, point) < .3) return
    pending.current = [...pending.current, point].slice(-64)
    setTrail(previous => [...previous, point].slice(-32))
    const traveled = pending.current.slice(1).reduce((sum, value, i) => sum + distance(pending.current[i], value), 0)
    if (traveled >= 3) { slash(pending.current); pending.current = [point] }
  }
  return <div>
    <div className="mg-ninja-mission"><span className="mg-pill">{t('minigames2.ninjaMission')}</span><p className="mg-ninja-request">{t(round.mode === 'reading' ? 'minigames2.ninjaReading' : 'minigames2.ninjaMeaning', { value: ninjaValue(board.request, round.mode) })}</p><p className="mg-muted">{t('minigames2.ninjaControls')}</p><p className="mg-ninja-scoring">{t('minigames2.ninjaScoring')}</p></div>
    <div ref={root} className="mg-ninja-arena" role="group" aria-label={t('minigames2.ninjaArena')}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0 || round.session.status !== 'playing') return; const point = pointAt(event); if (!point) return; event.preventDefault(); pointer.current = event.pointerId; gestureHit.current = false; pending.current = [point]; setTrail([point]); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={addPoint}
      onPointerUp={event => { if (pointer.current !== event.pointerId) return; addPoint(event); if (pending.current.length > 1) slash(pending.current); if (!gestureHit.current) setFeedback({ gain: 0, lost: 0, empty: true }); pointer.current = null; pending.current = []; setTrail([]); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { pointer.current = null; pending.current = []; setTrail([]) }}>
      {board.entities.map(entity => {
        const position = flyingPosition(entity, board.timeMs)
        return <div key={entity.id} className="mg-flying-word" style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${entity.width}%`, height: `${entity.height}%`, fontSize: `clamp(12px, ${Math.min(5, entity.width / (Array.from(entity.item.word).length + 1))}cqw, 26px)` }} role="img" aria-label={entity.item.word}>{entity.item.word}</div>
      })}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mg-slash-trail" aria-hidden="true">{trail.length > 1 && <polyline points={trail.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}</svg>
      <div className={`mg-ninja-feedback${feedback?.lost ? ' mg-ninja-penalty' : ''}`} role="status" aria-live="polite" aria-atomic="true">{feedback && <>{feedback.empty ? t('minigames2.ninjaNoHit') : <>{feedback.gain > 0 && <span>{t('minigames2.ninjaPoints', { count: feedback.gain })}</span>}{feedback.lost > 0 && <span>{t('minigames2.ninjaLostLife', { count: feedback.lost })}</span>}</>}</>}</div>
    </div>
    <p className="mg-muted">{t('minigames2.ninjaProgress', { count: board.hits, total: board.goal, wave: board.wave })}</p>
    <div className="mg-progress" role="progressbar" aria-label={t('minigames2.ninjaMission')} aria-valuemin={0} aria-valuemax={board.goal} aria-valuenow={board.hits}><div style={{ width: `${Math.min(100, board.hits / board.goal * 100)}%` }} /></div>
    <p className="mg-muted">{t('minigames.localNotice')}</p>
  </div>
}
