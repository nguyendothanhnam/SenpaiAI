import { useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import type { Round, Action } from '@games/session'
import { assembledWord } from '@games/workshop'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, Muted, Progress, styles } from '../ui'
import { WordSearchBoard } from './WordSearchBoard'
import { NinjaBoard } from './NinjaBoard'

export function Wave2Board({ round, send, reduced, lockScroll, readRound }: { round: Round; send: (action: Action) => void; reduced: boolean; lockScroll: (locked: boolean) => void; readRound: () => Round }) {
  const { t } = useTranslation('common'), { t: m } = useTranslation('mobile'), { colors } = useTheme()
  const [word, setWord] = useState<string>(), damage = useRef(new Animated.Value(1)).current
  const lastCorrect = useRef(0)
  useEffect(() => {
    if (round.session.correct === lastCorrect.current) return
    lastCorrect.current = round.session.correct
    if (reduced || round.session.status !== 'playing') return
    damage.setValue(1)
    const animation = Animated.timing(damage, { toValue: 0, duration: 700, useNativeDriver: true })
    animation.start(); return () => animation.stop()
  }, [round.session.correct, round.session.status, reduced, damage])
  const disabled = round.session.status !== 'playing'
  if (round.battle) {
    const board = round.battle
    return <Card><AppText>{m(board.boss ? 'minigames.wave2.boss' : 'minigames.wave2.monster', { stage: board.stage })}</AppText><Progress current={board.hp} total={board.maxHp} /><AppText>{m('minigames.wave2.health', { hp: board.hp, max: board.maxHp })}</AppText><AppText>{m('minigames.wave2.combo', { combo: board.combo })}</AppText>
      <Animated.View style={{ opacity: reduced ? 1 : damage }}><AppText>{m('minigames.wave2.damage', { damage: board.lastDamage })}</AppText></Animated.View>
      <Muted>{m('minigames.wave2.matchTouch')}</Muted><View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>{board.pairs.map(pair => <Button key={pair.id} secondary={word !== pair.id} selected={word === pair.id} disabled={disabled || board.matched.includes(pair.id)} title={pair.word} onPress={() => setWord(pair.id)} />)}</View>
        <View style={{ flex: 1, gap: 8 }}>{board.rightOrder.map(id => <Button key={id} secondary title={board.pairs.find(pair => pair.id === id)!.meaning} disabled={disabled || !word || board.matched.includes(id)} onPress={() => { send({ type: 'match', wordId: word!, meaningId: id, boardId: board.boardId }); setWord(undefined) }} />)}</View>
      </View>
    </Card>
  }
  if (round.workshop) {
    const board = round.workshop
    return <Card><AppText>{board.target.meaning}</AppText><AppText>{board.target.reading}</AppText><AppText style={{ fontSize: 32, lineHeight: 42 }}>{assembledWord(board) || '＿'.repeat(board.target.word.length)}</AppText>
      <View style={styles.row}>{board.cards.map(card => <View key={card.id} style={{ minWidth: 54 }}><Button title={card.kanji} secondary disabled={disabled || board.selected.includes(card.id)} onPress={() => send({ type: 'tile', id: card.id })} /></View>)}</View>
      <View style={styles.row}><Button secondary title={t('minigames.erase')} disabled={disabled || !board.selected.length} onPress={() => send({ type: 'undo' })} /><Button secondary title={m('minigames.wave2.clear')} disabled={disabled || !board.selected.length} onPress={() => send({ type: 'clear' })} /><Button title={t('minigames.check')} disabled={disabled || board.selected.length !== board.target.word.length} onPress={() => send({ type: 'answer', value: '', questionId: String(board.questionId) })} /></View>
    </Card>
  }
  if (round.wordsearch) return <WordSearchBoard round={round} send={send} lockScroll={lockScroll} />
  if (round.ninja) return <NinjaBoard round={round} send={send} readRound={readRound} reduced={reduced} lockScroll={lockScroll} />
  if (round.missing) {
    const board = round.missing
    return <Card><Muted>{m('minigames.wave2.missingTouch')}</Muted><View style={{ alignItems: 'center' }}><Svg width={190} height={190} viewBox={board.glyph.viewBox} accessibilityLabel={board.glyph.id}>{board.glyph.paths.map((path, index) => <Path key={index} d={path} fill="none" stroke={colors.text} strokeWidth={index === board.hidden ? 1.8 : 3} strokeDasharray={index === board.hidden ? '3 5' : undefined} opacity={index === board.hidden ? .35 : 1} strokeLinecap="round" />)}</Svg></View>
      <View style={styles.row}>{board.choices.map((choice, index) => <View key={choice.id} style={{ width: '47%', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 6 }}><Svg width={88} height={88} viewBox={choice.viewBox}><Path d={choice.path} fill="none" stroke={colors.text} strokeWidth={3} strokeLinecap="round" /></Svg><Button title={m('minigames.wave2.strokeOption', { index: index + 1 })} disabled={disabled} onPress={() => send({ type: 'answer', value: choice.id, questionId: String(board.questionId) })} /></View>)}</View>
      <Muted>{m('minigames.wave2.license')}</Muted>
    </Card>
  }
  return null
}
