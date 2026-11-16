import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Round, Action } from '@games/session'
import type { Cell } from '@games/wordsearch'
import { cellAt, snappedPath } from '../../features/minigames/gestures'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Muted } from '../ui'

export function WordSearchBoard({ round, send, lockScroll }: { round: Round; send: (action: Action) => void; lockScroll: (locked: boolean) => void }) {
  const { t } = useTranslation('mobile'), { colors } = useTheme(), [width, setWidth] = useState(280), [path, setPath] = useState<Cell[]>([])
  const view = useRef<ComponentRef<typeof View>>(null), origin = useRef({ x: 0, y: 0 }), start = useRef<Cell | null>(null), selected = useRef<Cell[]>([])
  const gesture = useRef(0)
  const board = round.wordsearch!, playing = round.session.status === 'playing'
  const current = useRef({ board, send, lockScroll, playing, width }); current.current = { board, send, lockScroll, playing, width }
  const finish = (submit: boolean) => {
    gesture.current++
    current.current.lockScroll(false)
    if (submit && current.current.playing) current.current.send({ type: 'selectPath', cells: selected.current })
    start.current = null; selected.current = []; setPath([])
  }
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => current.current.playing,
    onMoveShouldSetPanResponder: () => current.current.playing,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => {
      const token = ++gesture.current
      const { pageX, pageY } = event.nativeEvent
      current.current.lockScroll(true)
      view.current?.measureInWindow((x, y) => {
        if (gesture.current !== token || !current.current.playing) return
        origin.current = { x, y }
        start.current = cellAt({ x: pageX - x, y: pageY - y }, current.current.width, current.current.board.size)
        selected.current = start.current ? [start.current] : []; setPath(selected.current)
      })
    },
    onPanResponderMove: event => {
      if (!start.current || !current.current.playing) return
      const end = cellAt({ x: event.nativeEvent.pageX - origin.current.x, y: event.nativeEvent.pageY - origin.current.y }, current.current.width, current.current.board.size)
      if (end) { selected.current = snappedPath(start.current, end, current.current.board.size); setPath(selected.current) }
    },
    onPanResponderRelease: () => finish(true), onPanResponderTerminate: () => finish(false),
  })).current
  useEffect(() => {
    if (!playing) { gesture.current++; start.current = null; selected.current = []; setPath([]); lockScroll(false) }
  }, [playing, lockScroll])
  const found = board.words.filter(word => board.found.includes(word.item.id)).flatMap(word => word.cells)
  const marked = (cells: Cell[], row: number, col: number) => cells.some(cell => cell.row === row && cell.col === col)
  return <View style={{ gap: 12 }}><Muted>{t('minigames.wave2.searchTouch')}</Muted>
    <View ref={view} collapsable={false} onLayout={event => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers} style={{ width: '100%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card }}>
      {board.grid.flatMap((row, r) => row.map((kana, c) => <View key={`${r}:${c}`} style={{ width: `${100 / board.size}%`, height: `${100 / board.size}%`, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: marked(path, r, c) ? colors.primary : marked(found, r, c) ? colors.accent : colors.card }}><AppText style={{ color: marked(path, r, c) ? colors.primaryContrast : colors.text, fontSize: Math.max(14, Math.min(24, width / board.size * .58)) }}>{kana}</AppText></View>))}
    </View>
    {board.words.map(word => <AppText key={word.item.id} style={{ textDecorationLine: board.found.includes(word.item.id) ? 'line-through' : 'none' }}>{word.item.meaning || word.item.word} · {word.text}</AppText>)}
  </View>
}
