import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { StrokeData } from '../api/phase3Types'
import { vectorSegments } from '../features/kanji/vector'
import { useTheme } from '../theme/ThemeProvider'
import { AppText, Button, Muted, styles } from './ui'
export function StrokeAnimation({ data }: { data: StrokeData }) {
  const { t } = useTranslation('mobile'); const { colors } = useTheme()
  const [speed, setSpeed] = useState(1); const [replay, setReplay] = useState(0)
  const progress = useRef(new Animated.Value(0)).current
  const strokes = useMemo(() => { try { return (data.strokes || []).map(s => vectorSegments(s.path, data.viewBox)) } catch { return [] } }, [data])
  useEffect(() => {
    progress.setValue(0)
    const animation = Animated.timing(progress, { toValue: strokes.length, duration: Math.max(1, strokes.length) * 700 / speed, useNativeDriver: true })
    animation.start(); return () => animation.stop()
  }, [progress, strokes, speed, replay])
  if (!data.available || !strokes.length) return <Muted>{t('phase3.strokesUnsupported')}</Muted>
  return <View style={{ gap: 12 }}>
    <View accessibilityLabel={t('phase3.strokeDiagram', { kanji: data.kanji })} style={{ width: 260, height: 260, alignSelf: 'center', backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {strokes.flatMap((segments, index) => segments.map((s, part) => <Animated.View key={`${index}:${part}`} style={{ position: 'absolute', left: s.x, top: s.y, width: s.length + 0.5, height: 3, borderRadius: 2, backgroundColor: colors.primary, transform: [{ rotate: s.angle }], opacity: progress.interpolate({ inputRange: [index + part / segments.length, index + (part + 1) / segments.length], outputRange: [0, 1], extrapolate: 'clamp' }) }} />))}
    </View>
    <Button secondary title={t('phase3.replay')} onPress={() => setReplay(v => v + 1)} />
    <AppText>{t('phase3.speed')}</AppText><View style={styles.row}>{[0.5, 1, 2].map(value => <Button key={value} title={`${value}×`} secondary={speed !== value} onPress={() => setSpeed(value)} />)}</View>
    <Muted>KanjiVG · CC BY-SA 3.0</Muted>
  </View>
}
