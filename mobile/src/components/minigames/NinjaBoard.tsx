import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { ninjaValue } from '@games/ninja'
import type { SwipePoint } from '@games/geometry'
import type { Action, Round } from '@games/session'
import { useTheme } from '../../theme/ThemeProvider'
import { FlyingWord } from './FlyingWord'
import { AppText, Muted } from '../ui'

export function NinjaBoard({ round, send, readRound, reduced, lockScroll }: { round: Round; send: (action: Action) => void; readRound: () => Round; reduced: boolean; lockScroll: (locked: boolean) => void }) {
  const { t } = useTranslation('mobile'), { colors } = useTheme(), [width, setWidth] = useState(280), [trail, setTrail] = useState<SwipePoint[]>([])
  const view = useRef<ComponentRef<typeof View>>(null), origin = useRef({ x: 0, y: 0 }), points = useRef<SwipePoint[]>([]), active = useRef(false), fade = useRef(new Animated.Value(0)).current
  const board = round.ninja!
  const current = useRef({ send, readRound, lockScroll, width, reduced }); current.current = { send, readRound, lockScroll, width, reduced }
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => current.current.readRound().session.status === 'playing',
    onMoveShouldSetPanResponder: () => current.current.readRound().session.status === 'playing',
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => {
      active.current = true; points.current = []; current.current.lockScroll(true)
      const { pageX, pageY } = event.nativeEvent
      view.current?.measureInWindow((x, y) => {
        if (!active.current) return
        origin.current = { x, y }
        points.current = [{ x: (pageX - x) * 100 / current.current.width, y: (pageY - y) * 100 / current.current.width, atMs: current.current.readRound().ninja!.timeMs }]
      })
    },
    onPanResponderMove: event => {
      const value = current.current.readRound()
      if (!active.current || value.session.status !== 'playing') return
      const point = { x: (event.nativeEvent.pageX - origin.current.x) * 100 / current.current.width, y: (event.nativeEvent.pageY - origin.current.y) * 100 / current.current.width, atMs: value.ninja!.timeMs }
      const previous = points.current[points.current.length - 1]
      points.current = [...points.current.slice(-18), point]
      if (previous) current.current.send({ type: 'slash', points: points.current })
      if (!current.current.reduced) { fade.setValue(1); setTrail(points.current) }
    },
    onPanResponderRelease: () => {
      active.current = false; current.current.lockScroll(false)
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start()
    },
    onPanResponderTerminate: () => { active.current = false; current.current.lockScroll(false); fade.setValue(0) },
  })).current
  useEffect(() => {
    if (round.session.status !== 'playing') { active.current = false; points.current = []; fade.stopAnimation(); fade.setValue(0); lockScroll(false) }
    return () => { active.current = false; fade.stopAnimation() }
  }, [round.session.status, fade, lockScroll])

  return <View style={{ gap: 10 }}><AppText>{t('minigames.wave2.ninjaPrompt', { value: ninjaValue(board.request, round.mode) })}</AppText><Muted>{t(reduced ? 'minigames.wave2.reducedNinja' : 'minigames.wave2.ninjaTouch')}</Muted>
    <View ref={view} collapsable={false} onLayout={event => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers} style={{ width: '100%', aspectRatio: 1, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated, borderRadius: 12 }}>
      {board.entities.map(entity => <FlyingWord key={entity.id} entity={entity} time={board.timeMs} playing={round.session.status === 'playing'} width={width} />)}
      {!reduced && <Animated.View pointerEvents="none" style={{ position: 'absolute', width: '100%', height: '100%', opacity: fade }}><Svg width="100%" height="100%" viewBox="0 0 100 100"><Path d={trail.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={1} strokeLinecap="round" /></Svg></Animated.View>}
    </View><Muted>{t('minigames.wave2.ninjaProgress', { hits: board.hits, goal: board.goal })}</Muted>
  </View>
}
