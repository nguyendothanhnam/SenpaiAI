import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, View, type GestureResponderEvent } from 'react-native'
import Svg, { G, Line, Path, Rect } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { Button, Muted, styles } from './ui'
import { smoothPath, type InkStroke } from '../features/kanji/handwriting'
import type { StrokeData } from '../api/phase3Types'

export function KanjiDrawingCanvas({ strokes, onChange, onDrawing, reference }: { strokes: InkStroke[]; onChange: (s: InkStroke[]) => void; onDrawing: (drawing: boolean) => void; reference?: StrokeData }) {
  const { t } = useTranslation('mobile'), { colors } = useTheme()
  const size = useRef(1), active = useRef<InkStroke | null>(null), pointer = useRef<number | null>(null)
  const committed = useRef(strokes), callbacks = useRef({ onChange, onDrawing })
  committed.current = strokes; callbacks.current = { onChange, onDrawing }
  const [preview, setPreview] = useState<InkStroke>([])
  const paths = useMemo(() => strokes.map(smoothPath), [strokes])
  const frame = useRef<number | null>(null)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])
  const responder = useMemo(() => {
  const finish = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (active.current?.length) callbacks.current.onChange([...committed.current, active.current])
    active.current = null; pointer.current = null; setPreview([]); callbacks.current.onDrawing(false)
  }
    const point = (e: GestureResponderEvent, id: string) => ({ x: Math.max(0, Math.min(720, e.nativeEvent.locationX / size.current * 720)), y: Math.max(0, Math.min(720, e.nativeEvent.locationY / size.current * 720)), timestamp: Date.now(), pressure: .5, strokeId: id })
    return PanResponder.create({
      onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 1,
      onStartShouldSetPanResponderCapture: e => e.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponder: () => !!active.current,
      onPanResponderGrant: e => { pointer.current = e.nativeEvent.identifier; active.current = [point(e, `${Date.now()}-${committed.current.length + 1}`)]; setPreview(active.current); callbacks.current.onDrawing(true) },
      onPanResponderMove: e => {
        if (!active.current || e.nativeEvent.touches.length !== 1 || e.nativeEvent.identifier !== pointer.current) return
        const p = point(e, active.current[0].strokeId), last = active.current[active.current.length - 1]
        if (Math.hypot(last.x - p.x, last.y - p.y) < 1 || active.current.length >= 4096) return
        active.current.push(p)
        if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; setPreview([...(active.current || [])]) })
      },
      onPanResponderRelease: finish, onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false, onShouldBlockNativeResponder: () => true,
    })
  }, [])
  return <View style={{ gap: 12 }}>
    <View accessible accessibilityLabel={t('writing.canvas')} onLayout={e => { size.current = e.nativeEvent.layout.width }} {...responder.panHandlers} style={{ width: '100%', maxWidth: 440, aspectRatio: 1, alignSelf: 'center', borderWidth: 1, borderColor: colors.border, overflow: 'hidden', borderRadius: 12 }}>
      <Svg width="100%" height="100%" viewBox="0 0 720 720" pointerEvents="none">
        <Rect width={720} height={720} fill={colors.card} />
        {[90, 180, 270, 360, 450, 540, 630].map(n => <G key={n}><Line x1={n} y1={0} x2={n} y2={720} stroke={colors.border} /><Line x1={0} y1={n} x2={720} y2={n} stroke={colors.border} /></G>)}
        <Rect x={93.6} y={93.6} width={532.8} height={532.8} stroke={colors.primary} fill="none" strokeDasharray="10 10" opacity={.3} />
        {reference?.strokes?.length ? <Svg width={720} height={720} viewBox={reference.viewBox || '0 0 109 109'}>{reference.strokes.map(s => <Path key={s.index} d={s.path} stroke={colors.text} strokeWidth={4.2} opacity={.16} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</Svg> : null}
        {paths.map((path, i) => <Path key={i} d={path} stroke={colors.text} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        <Path d={smoothPath(preview)} stroke={colors.text} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
    <Muted>{t('writing.count', { count: strokes.length })}</Muted>
    <View style={styles.row}><Button secondary title={t('writing.undo')} disabled={!strokes.length} onPress={() => onChange(strokes.slice(0, -1))} /><Button secondary title={t('writing.clear')} disabled={!strokes.length} onPress={() => onChange([])} /></View>
  </View>
}
