import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { flyingPosition, type FlyingWord as Entity } from '@games/ninja'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText } from '../ui'

export const FlyingWord = memo(function FlyingWord({ entity, time, playing, width }: { entity: Entity; time: number; playing: boolean; width: number }) {
  const { colors } = useTheme(), progress = useRef(new Animated.Value(0)).current, latestTime = useRef(time)
  latestTime.current = time
  const trajectory = useMemo(() => {
    const inputRange = Array.from({ length: 49 }, (_, index) => index / 48)
    const positions = inputRange.map(fraction => flyingPosition(entity, entity.bornAt + fraction * entity.lifetimeMs))
    return { inputRange, x: positions.map(point => point.x * width / 100), y: positions.map(point => point.y * width / 100) }
  }, [entity, width])
  useEffect(() => {
    const elapsed = Math.max(0, latestTime.current - entity.bornAt)
    progress.setValue(Math.min(1, elapsed / entity.lifetimeMs))
    if (!playing) return
    const animation = Animated.timing(progress, { toValue: 1, duration: Math.max(0, entity.lifetimeMs - elapsed), easing: Easing.linear, useNativeDriver: true })
    animation.start(); return () => animation.stop()
  }, [entity, playing, progress])
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -entity.width * width / 200, top: -entity.height * width / 200, width: entity.width * width / 100, height: entity.height * width / 100, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: progress.interpolate({ inputRange: trajectory.inputRange, outputRange: trajectory.x }) }, { translateY: progress.interpolate({ inputRange: trajectory.inputRange, outputRange: trajectory.y }) }] }}>
    <AppText numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20, textAlign: 'center' }}>{entity.item.word}</AppText>
  </Animated.View>
} , (previous, next) => previous.entity === next.entity && previous.playing === next.playing && previous.width === next.width)
