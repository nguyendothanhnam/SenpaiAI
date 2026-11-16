import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Action, Round } from '@games/session'
import type { WordItem } from '@games/types'
import type { FallingQuestion } from '@games/falling'
import { lastKana } from '@games/shiritori'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Button, Card, Muted, styles } from '../ui'

function FallingGlyph({ question, playing, selected, height, index, reduced, select }: { question: FallingQuestion; playing: boolean; selected: boolean; height: number; index: number; reduced: boolean; select: () => void }) {
  const progress = useRef(new Animated.Value(0)).current
  const latest = useRef(question); latest.current = question
  const { colors } = useTheme(), { t } = useTranslation('common')
  useEffect(() => {
    const q = latest.current
    progress.setValue(q.ageMs / q.durationMs)
    if (!playing || reduced) return
    const animation = Animated.timing(progress, { toValue: 1, duration: Math.max(0, q.durationMs - q.ageMs), useNativeDriver: true, easing: x => x })
    animation.start()
    return () => animation.stop()
  }, [playing, progress, question.id, reduced])
  return <Animated.View style={{ position: 'absolute', left: `${index * 32}%`, width: '32%', transform: reduced ? [] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, height - 90)] }) }] }}>
    <Pressable disabled={!playing} accessibilityRole="button" accessibilityLabel={t('minigames.selectKanji', { kanji: question.item.id })} accessibilityState={{ selected }} onPress={select} style={{ minHeight: 64, borderWidth: 2, borderRadius: 12, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.card, justifyContent: 'center' }}>
      <AppText style={{ fontSize: 34, lineHeight: 44, textAlign: 'center' }}>{question.item.id}</AppText><AppText style={{ textAlign: 'center', fontSize: 12 }}>{Math.max(0, Math.ceil((question.durationMs - question.ageMs) / 1000))}</AppText>
    </Pressable>
  </Animated.View>
}

export function GameBoard({ round, send, reduced }: { round: Round; send: (action: Action) => void; reduced: boolean }) {
  const { t } = useTranslation('common'), { t: m } = useTranslation('mobile'), { colors } = useTheme()
  const [selected, setSelected] = useState<number>(), [height, setHeight] = useState(180)
  const [typed, setTyped] = useState<string[]>([]), [history, setHistory] = useState<string[][]>([])
  const previousChoices = useRef<{ id: string; choices: WordItem[] }>({ id: '', choices: [] })
  if (round.shiritori && previousChoices.current.id !== round.shiritori.current.id) previousChoices.current = { id: round.shiritori.current.id, choices: round.shiritori.choices }
  const cipherId = round.cipher?.word.id
  // A keyed board is mounted for each cipher, so undo never crosses questions.
  const playing = round.session.status === 'playing'
  const input = (next: string[]) => { setHistory(previous => [...previous.slice(-30), typed]); setTyped(next) }
  if (round.session.game === 'falling') {
    const active = round.falling.questions.find(q => q.id === selected) || round.falling.questions[0]
    return <View style={{ flex: 1, gap: 10 }}>
      <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ flex: 1, minHeight: 90, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 12 }} accessibilityLabel={t('minigames.fallingArena')}>
        {round.falling.questions.map((q, index) => <FallingGlyph key={q.id} question={q} selected={q.id === active?.id} playing={playing} height={height} index={index} reduced={reduced} select={() => setSelected(q.id)} />)}
      </View>
      <Muted>{m(reduced ? 'minigames.reduced' : 'minigames.fallingTouch')}</Muted>
      <View style={styles.row}>{active?.options.map(value => <View key={`${active.id}:${value}`} style={{ width: '48%' }}><Button key={`${active.id}:${value}`} title={value} disabled={!playing} onPress={() => send({ type: 'answer', id: active.id, value })} /></View>)}</View>
    </View>
  }
  if (round.shiritori) return <Card>
    <AppText style={{ fontSize: 30, lineHeight: 40 }}>{round.shiritori.current.word}</AppText><AppText>{round.shiritori.current.reading}</AppText>
    <Muted>{t('minigames.nextKana', { kana: lastKana(round.shiritori.current.reading) })}</Muted>
    <Muted>{t('minigames.chain', { count: round.session.chain })}</Muted>
    {previousChoices.current.choices.map(word => <View key={word.id} style={{ opacity: round.shiritori?.choices.some(item => item.id === word.id) ? 1 : .4 }}><Button secondary title={`${word.word} · ${word.reading}`} disabled={!playing || !round.shiritori?.choices.some(item => item.id === word.id)} onPress={() => send({ type: 'answer', value: word.id })} /></View>)}
  </Card>
  if (round.cipher) {
    const cipher = round.cipher
    const values = cipher.plain.map((char, index) => cipher.revealed.includes(index) ? char : typed[index] || '＿')
    return <View style={{ gap: 12 }}>
      <Card><Muted>{t('minigames.encryptedWord')}</Muted><AppText style={{ fontSize: 26, lineHeight: 36 }}>{cipher.encoded.join(' ')}</AppText><Muted>{t('minigames.decodedWord')}</Muted><AppText style={{ fontSize: 26, lineHeight: 36 }}>{values.join(' ')}</AppText></Card>
      <Button title={t('minigames.check')} disabled={!playing || values.includes('＿')} onPress={() => send({ type: 'answer', value: values.join(''), questionId: cipherId })} />
      <View style={styles.row}><Button secondary title={t('minigames.hint')} disabled={!playing || cipher.revealed.length >= cipher.plain.length} onPress={() => send({ type: 'hint' })} /><Button secondary title={t('minigames.erase')} disabled={!playing || !typed.length} onPress={() => input(typed.slice(0, -1))} /><Button secondary title={m('minigames.undo')} disabled={!playing || !history.length} onPress={() => { setTyped(history[history.length - 1]); setHistory(history.slice(0, -1)) }} /></View>
      <Muted>{m('minigames.cipherTouch')}</Muted>
      <View style={styles.row}>{cipher.table.map(pair => <View key={pair.plain} style={{ width: '17%', minWidth: 44 }}><Button secondary title={pair.plain} disabled={!playing} onPress={() => { let index = 0; while (index < cipher.plain.length && (cipher.revealed.includes(index) || typed[index])) index++; if (index < cipher.plain.length) { const next = [...typed]; next[index] = pair.plain; input(next) } }} /></View>)}</View>
      <Muted>{t('minigames.cipherTable')}</Muted><View style={styles.row}>{cipher.table.map(pair => <AppText key={pair.code}>{t('minigames.codePair', pair)}</AppText>)}</View>
    </View>
  }
  if (round.memory) {
    const memory = round.memory, index = Math.floor(memory.showingMs / memory.durationMs) - 1
    const active = memory.phase === 'showing' && memory.showingMs % memory.durationMs < memory.durationMs * .72 ? memory.sequence[index] : undefined
    return <Card><AppText accessibilityLiveRegion="polite">{t(memory.phase === 'showing' ? 'minigames.watch' : 'minigames.repeat')}</AppText><Muted>{t('minigames.memoryProgress', { length: memory.sequence.length, entered: memory.entered })}</Muted>
      <View style={styles.row}>{memory.grid.map(kana => <View key={kana} style={{ width: '30%', borderWidth: 3, borderRadius: 14, borderColor: active === kana ? colors.text : colors.border, opacity: memory.phase === 'showing' && active !== kana ? .4 : 1 }}><Button title={kana} secondary={active !== kana} disabled={!playing || memory.phase !== 'input'} onPress={() => send({ type: 'answer', value: kana })} /></View>)}</View>
    </Card>
  }
  return null
}
