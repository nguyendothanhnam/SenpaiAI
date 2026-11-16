import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { AppText, Button, Card, Loading, Muted, Progress, Screen, Title, styles } from '../../components/ui'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { shuffled } from '../../features/study/quizAnswers'
import type { StudySet } from '../../features/study/types'
import { studyStore, useStudy } from '../../features/study/useStudy'
import { Issues, StorageNotice, useLeaveGuard, useWork } from './shared'
import type { TFunction } from 'i18next'

export function FlashcardPlayScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(), library = useStudy(), { t } = useTranslation('mobile')
  const [selectedId, setSelectedId] = useState(id), [picker, setPicker] = useState(false)
  if (library.query.isLoading) return <Loading />
  const sets = library.sets.filter(set => set.kind === 'flashcard'), set = sets.find(set => set.id === selectedId)
  if (!set || !set.cards.length) return <Screen solid><StorageNotice library={library} /><Muted>{t('phase4.missingSet')}</Muted></Screen>
  return <><FlashSession key={`${library.account}:${set.id}`} set={set} library={library} changeSet={() => setPicker(true)} /><ChoiceSheet title={t('phase4.changeSet')} visible={picker} value={set.id} options={sets.map(set => ({ value: set.id, label: set.name }))} onClose={() => setPicker(false)} onSelect={setSelectedId} /></>
}
function FlashSession({ set, library, changeSet }: { set: StudySet; library: ReturnType<typeof useStudy>; changeSet: () => void }) {
  const { t } = useTranslation('mobile'), work = useWork()
  const [cards, setCards] = useState(set.cards), [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false), [marks, setMarks] = useState<Record<number, boolean>>({}), [done, setDone] = useState(false), [active, setActive] = useState(false)
  const [heights, setHeights] = useState({ front: 260, back: 260 })
  const rotation = useRef(new Animated.Value(0)).current
  const disableGuard = useLeaveGuard(active && !done, work.busy)
  useEffect(() => { const animation = Animated.timing(rotation, { toValue: flipped ? 1 : 0, duration: 260, useNativeDriver: true }); animation.start(); return () => animation.stop() }, [flipped, rotation])
  const total = Object.keys(marks).length, correct = Object.values(marks).filter(Boolean).length, wrong = total - correct, accuracy = total ? Math.round(correct / total * 100) : 0
  function move(next: number) { rotation.setValue(0); setFlipped(false); setIndex(next) }
  function restart(shuffle = false) { setCards(shuffle ? shuffled(set.cards) : [...set.cards]); setMarks({}); setDone(false); setActive(false); move(0) }
  async function mark(remembered: boolean) {
    if (marks[index] !== undefined) return
    await studyStore.record(library.account!, set.id, remembered)
    const updated = { ...marks, [index]: remembered }
    setMarks(updated); setActive(true)
    void Haptics.selectionAsync().catch(() => undefined)
    // Refresh stats without replacing this session's shuffled card order.
    await library.refresh()
    if (Object.keys(updated).length === cards.length) {
      // Marking is already committed. A failed summary write must not re-mark it.
      await studyStore.finish(library.account!, set.id, Math.round(Object.values(updated).filter(Boolean).length / cards.length * 100))
      setDone(true); await library.refresh()
    } else {
      const next = cards.findIndex((_, i) => i > index && updated[i] === undefined)
      move(next >= 0 ? next : cards.findIndex((_, i) => updated[i] === undefined))
    }
  }
  if (done) return <Screen solid><Title>{t('phase4.results')}</Title><Title>{set.name}</Title><Card><AppText>{t('phase4.flashResults', { correct, wrong, accuracy })}</AppText><Muted>{t('phase4.statsSaved')}</Muted></Card><Button title={t('phase4.restart')} onPress={() => restart()} /><Button secondary title={t('phase4.shuffle')} onPress={() => restart(true)} /><Button secondary title={t('phase4.changeSet')} onPress={changeSet} /><Button secondary title={t('phase4.backToSets')} onPress={() => { disableGuard(); router.back() }} /></Screen>
  return <Screen solid><Title>{set.name}</Title><Muted>{t('phase4.cardProgress', { current: index + 1, total: cards.length })}</Muted><Progress current={total} total={cards.length} /><Muted>{t('phase4.flashResults', { correct, wrong, accuracy })}</Muted><Issues error={work.error} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('phase4.flip')} style={{ minHeight: Math.max(heights.front, heights.back) }} disabled={work.busy} onPress={() => { setActive(true); setFlipped(value => !value) }}>
      <Animated.View accessibilityElementsHidden={flipped} importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'} onLayout={event => { const height = event.nativeEvent.layout.height; setHeights(current => current.front === height ? current : { ...current, front: height }) }} style={{ backfaceVisibility: 'hidden', transform: [{ perspective: 1000 }, { rotateY: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><Card style={{ minHeight: 260, justifyContent: 'center' }}><Muted>{t('phase4.front')}</Muted><AppText style={{ fontSize: 28, lineHeight: 38 }}>{cards[index].front}</AppText></Card></Animated.View>
      <Animated.View accessibilityElementsHidden={!flipped} importantForAccessibility={!flipped ? 'no-hide-descendants' : 'auto'} onLayout={event => { const height = event.nativeEvent.layout.height; setHeights(current => current.back === height ? current : { ...current, back: height }) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, backfaceVisibility: 'hidden', transform: [{ perspective: 1000 }, { rotateY: rotation.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }] }}><Card style={{ minHeight: 260, justifyContent: 'center' }}><Muted>{t('phase4.back')}</Muted><AppText style={{ fontSize: 28, lineHeight: 38 }}>{cards[index].back}</AppText></Card></Animated.View>
    </Pressable><Muted>{t('phase4.tapFlip')}</Muted>
    <View style={styles.row}><Button title={t('phase4.remembered')} disabled={work.busy || marks[index] !== undefined} onPress={() => void work.run(() => mark(true))} /><Button secondary title={t('phase4.notRemembered')} disabled={work.busy || marks[index] !== undefined} onPress={() => void work.run(() => mark(false))} /></View>
    <View style={styles.row}><Button secondary title={t('phase4.previous')} disabled={work.busy || index === 0} onPress={() => move(index - 1)} /><Button secondary title={t('phase4.next')} disabled={work.busy || index === cards.length - 1} onPress={() => move(index + 1)} /></View>
    {total === cards.length && <Button title={t('phase4.finish')} disabled={work.busy} onPress={() => void work.run(async () => { await studyStore.finish(library.account!, set.id, accuracy); setDone(true); await library.refresh() })} />}
    <Button secondary title={t('phase4.restart')} disabled={work.busy} onPress={() => confirmRestart(() => restart(), t)} /><Button secondary title={t('phase4.shuffle')} disabled={work.busy} onPress={() => confirmRestart(() => restart(true), t)} /><Button secondary title={t('phase4.changeSet')} disabled={work.busy} onPress={() => confirmRestart(changeSet, t)} />
  </Screen>
}
function confirmRestart(action: () => void, t: TFunction<'mobile'>) { Alert.alert(t('phase4.leaveTitle'), t('phase4.restartConfirm'), [{ text: t('phase4.cancel'), style: 'cancel' }, { text: t('phase4.continue'), onPress: action }]) }
