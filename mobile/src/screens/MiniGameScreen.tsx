import { Feather } from '@expo/vector-icons'
import { AppDialog } from '../components/AppDialog'
import { GameGuide } from '../components/minigames/GameGuide'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, Pressable, ScrollView, View } from 'react-native'
import { Stack, router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { availability } from '@games/availability'
import { createRound, type Action, type Round } from '@games/session'
import { EMPTY_STATS, statsKey } from '@games/stats'
import { LEVELS, GAMES, type Alphabet, type AnswerMode, type Difficulty, type Level } from '@games/types'
import { firstKana, lastKana } from '@games/shiritori'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { gamePools, gameStore, recipeStore } from '../features/minigames/native'
import { GameRuntime } from '../features/minigames/runtime'
import { compoundsFor } from '@games/phase2-data'
import { words } from '@games/data'
import { Wave2Board } from '../components/minigames/Wave2Board'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { GameBoard } from '../components/minigames/GameBoard'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title, styles } from '../components/ui'

export function MiniGameScreen() {
  const { game: param } = useLocalSearchParams<{ game: string }>()
  const { user } = useAuth()
  const game = GAMES.find(value => value === param)
  if (!game) return <InvalidGame />
  return <GameScreen key={`${game}:${user?.id}`} game={game} />
}
function InvalidGame() { const { t } = useTranslation('common'); return <Screen><ErrorNotice message={t('minigames.insufficientData')} /><Button title={t('minigames.back')} onPress={() => router.back()} /></Screen> }

function GameScreen({ game }: { game: typeof GAMES[number] }) {
  const { t } = useTranslation('common'), { t: m } = useTranslation('mobile'), { colors } = useTheme(), { user } = useAuth(), navigation = useNavigation()
  const account = String(user?.id || '')
  const [guide, setGuide] = useState(false)
  const [exitAction, setExitAction] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null)
  const [level, setLevel] = useState<Level>('N3'), [difficulty, setDifficulty] = useState<Difficulty>('normal'), [mode, setMode] = useState<AnswerMode>('reading'), [alphabet, setAlphabet] = useState<Alphabet>('hiragana')
  const [scrollLocked, setScrollLocked] = useState(false), [recipes, setRecipes] = useState<string[]>([]), [recipeError, setRecipeError] = useState(false), [picker, setPicker] = useState<'level' | 'difficulty' | 'mode' | 'alphabet'>(), [round, setRound] = useState<Round>(), [preparing, setPreparing] = useState(false), [error, setError] = useState(''), [saveError, setSaveError] = useState(false), [best, setBest] = useState(0), [reduced, setReduced] = useState(false), [reason, setReason] = useState<{ expected: string; actual: string; tail: string }>()
  const runtime = useRef<GameRuntime | null>(null), generation = useRef(0), alive = useRef(true)
  const focused = useRef(false)
  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => { focused.current = false; runtime.current?.appState('blur') }
  }, []))
  const active = round?.session.status === 'playing' || round?.session.status === 'paused'
  const variant = (game === 'falling' || game === 'ninja') ? mode : game === 'cipher' || game === 'memory' || game === 'wordsearch' ? alphabet : ''
  const key = statsKey(game, level, difficulty, variant)
  const saveRecipes = useCallback(async (value: Round) => {
    if (!value.workshop?.discovered.length) return true
    try {
      const ids = await recipeStore.add(account, value.workshop.discovered, compoundsFor(value.session.level, value.pool))
      if (alive.current) { setRecipes(ids); setRecipeError(false) }
      return true
    } catch { if (alive.current) setRecipeError(true); return false }
  }, [account])
  useEffect(() => {
    if (game !== 'workshop') return
    let valid = true
    void recipeStore.read(account).then(ids => { if (valid) setRecipes(ids) }).catch(() => { if (valid) setRecipeError(true) })
    return () => { valid = false }
  }, [account, game])
  const save = useCallback(async (value: Round) => {
    try {
      const result = await gameStore.record(account, key, value.session)
      if (!await saveRecipes(value)) return false
      if (alive.current) { setSaveError(false); setBest(result.entries[key]?.highScore || 0) }
      return true
    } catch { if (alive.current) setSaveError(true); return false }
  }, [account, key, saveRecipes])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; runtime.current = null }
  }, [])
  useEffect(() => {
    let valid = true
    setBest(0)
    void gameStore.read(account).then(store => { if (valid) { setBest((store.entries[key] || EMPTY_STATS).highScore); setSaveError(false) } }).catch(() => { if (valid) setSaveError(true) })
    return () => { valid = false }
  }, [account, key])
  useEffect(() => {
    let valid = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (valid) setReduced(value) })
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => { valid = false; listener.remove() }
  }, [])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => runtime.current?.appState(state))
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (round?.session.status !== 'playing') return
    let previous = Date.now()
    // Domain clock at 10 Hz. Falling positions run separately on the native driver.
    const interval = setInterval(() => { const now = Date.now(); runtime.current?.dispatch({ type: 'tick', ms: now - previous }); previous = now }, 100)
    return () => clearInterval(interval)
  }, [round?.session.status])
  useEffect(() => { if (round?.session.status === 'finished') void save(round) }, [round, save])
  useEffect(() => { if (round?.workshop?.discovered.length) void saveRecipes(round) }, [round?.workshop?.discovered, round, saveRecipes])
  const send = (action: Action) => {
    const before = runtime.current?.round
    runtime.current?.dispatch(action)
    const after = runtime.current?.round
    if (action.type !== 'answer' || !before || !after || before === after) return
    if (before.shiritori) {
      const chosen = before.shiritori.choices.find(word => word.id === action.value)
      setReason({ expected: lastKana(before.shiritori.current.reading), actual: chosen ? firstKana(chosen.reading) : '', tail: chosen ? lastKana(chosen.reading) : '' })
    }
    if (game === 'memory' || ((game === 'wordsearch' || game === 'battle') && after.session.correct > before.session.correct)) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }
  usePreventRemove(!!active, ({ data }) => {
    runtime.current?.dispatch({ type: 'pause' })
    setExitAction(data.action)
  })
  const pendingExit = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null)
  useEffect(() => {
    if (round?.session.status !== 'finished' || !pendingExit.current) return
    const action = pendingExit.current; pendingExit.current = null
    void save(round).then(saved => { if (saved && alive.current) navigation.dispatch(action) })
  }, [round, save, navigation])
  const start = async () => {
    const token = ++generation.current
    setPreparing(true); setError(''); setReason(undefined)
    try {
      const pool = await gamePools.prepare(level)
      if (!alive.current || generation.current !== token) return
      const available = availability(game, level, difficulty, mode, alphabet, pool)
      if (!available.enabled) {
        setError(`${t('minigames.insufficientData')} ${t('minigames.dataReport', available)} ${t('minigames.suggestLevels', { levels: LEVELS.filter(value => value !== level && availability(game, value, difficulty, mode, alphabet).enabled).join(', ') })}`)
        return
      }
      const seed = Date.now(), value = createRound(game, level, difficulty, seed, mode, alphabet, `${account}:${seed}:${Math.random()}`, pool)
      runtime.current = new GameRuntime(value, setRound)
      if (AppState.currentState !== 'active' || !focused.current) runtime.current.appState('inactive')
      setRound(runtime.current.round)
    } catch { if (alive.current && generation.current === token) setError(m('minigames.prepareError')) }
    finally { if (alive.current && generation.current === token) setPreparing(false) }
  }
  const check = availability(game, level, difficulty, mode, alphabet)
  const options = picker === 'level' ? LEVELS.map(value => {
    const data = availability(game, value, difficulty, mode, alphabet)
    return { value, label: t(data.enabled ? 'minigames.levelAvailable' : 'minigames.levelUnavailable', { level: value, count: data.count }), disabled: !data.enabled }
  }) : picker === 'difficulty' ? ['easy', 'normal', 'hard'].map(value => ({ value, label: t(`minigames.difficulties.${value}`) })) : picker === 'mode' ? ['reading', 'meaning'].map(value => ({ value, label: t(`minigames.modes.${value}`) })) : ['hiragana', 'katakana'].map(value => ({ value, label: t(`minigames.alphabets.${value}`) }))
  const score = <View style={styles.row}><AppText>{t('minigames.score')}: {round?.session.score || 0}</AppText><AppText>{t('minigames.lives')}: {round?.session.lives || 0}</AppText><AppText>{t('minigames.longestChain')}: {round?.session.longestChain || 0}</AppText></View>
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.screen }}>
    {guide && <GameGuide game={game} reduced={reduced} onClose={() => setGuide(false)} />}
    <AppDialog visible={!!exitAction} title={t('minigames.quit')} message={t('minigames.confirmExit')} primaryLabel={t('minigames.quit')} reduced={reduced} onClose={() => setExitAction(null)} onConfirm={() => { pendingExit.current = exitAction; setExitAction(null); runtime.current?.dispatch({ type: 'quit' }) }} />
    <Stack.Screen options={{ title: t(`minigames.games.${game}.name`), gestureEnabled: !active }} />
    {!round ? <Screen><Title>{t(`minigames.games.${game}.name`)}</Title><Muted>{t(`minigames.games.${game}.rules`)}</Muted><Button secondary title={t('gameHelp.title')} onPress={() => setGuide(true)} /><Muted>{t('minigames.localNotice')}</Muted>
      <Button secondary disabled={preparing} title={`${t('minigames.level')}: ${level}`} onPress={() => setPicker('level')} />
      <Button secondary disabled={preparing} title={`${t('minigames.difficulty')}: ${t(`minigames.difficulties.${difficulty}`)}`} onPress={() => setPicker('difficulty')} />
      {(game === 'falling' || game === 'ninja') && <Button secondary disabled={preparing} title={`${t('minigames.answerMode')}: ${t(`minigames.modes.${mode}`)}`} onPress={() => setPicker('mode')} />}
      {(game === 'cipher' || game === 'memory' || game === 'wordsearch') && <Button secondary disabled={preparing} title={`${t('minigames.alphabet')}: ${t(`minigames.alphabets.${alphabet}`)}`} onPress={() => setPicker('alphabet')} />}
      {mode === 'meaning' && (game === 'falling' || game === 'ninja') && <Muted>{t('minigames.meaningNotice')}</Muted>}
      <Muted>{t('minigames.dataReport', check)}</Muted><Muted>{m('minigames.unavailableLevels', { levels: LEVELS.filter(value => !availability(game, value, difficulty, mode, alphabet).enabled).join(', ') })}</Muted>
      {!check.enabled && <ErrorNotice message={`${t('minigames.insufficientData')} ${t('minigames.suggestLevels', { levels: LEVELS.filter(value => availability(game, value, difficulty, mode, alphabet).enabled).join(', ') })}`} />}
      <Muted>{t('minigames.highScore', { score: best })}</Muted>
      {error && <ErrorNotice message={error} retry={() => void start()} />}
      <Button disabled={preparing || !check.enabled} title={preparing ? m('minigames.preparing') : t('minigames.start')} onPress={() => void start()} />
      <Button secondary title={t('minigames.back')} onPress={() => router.back()} />
    </Screen> : round.session.status === 'finished' ? <Screen><Title>{t('minigames.finished')}</Title>{score}<Muted>{t(`minigames.endReasons.${round.session.reason}`)}</Muted><Muted>{t('minigames.highScore', { score: Math.max(best, round.session.score) })}</Muted>
      <Button title={preparing ? m('minigames.preparing') : t('minigames.replay')} disabled={preparing || saveError || recipeError} onPress={() => void start()} />{error && <ErrorNotice message={error} retry={() => void start()} />}
      <Button secondary title={t('minigames.changeLevel')} disabled={saveError || recipeError} onPress={() => { runtime.current = null; setRound(undefined) }} />
      <Button secondary title={t('minigames.back')} onPress={() => router.back()} />
    </Screen> : <View style={{ flex: 1, padding: 12, gap: 8 }}>
      {score}
      <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={t('gameHelp.open', { game: t(`minigames.games.${game}.name`) })} onPress={() => { runtime.current?.dispatch({ type: 'pause' }); setGuide(true) }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent }}><Feather name="help-circle" size={24} color={colors.text} /></Pressable><View style={{ flex: 1 }}><Button secondary title={t(round.session.status === 'paused' ? 'minigames.resume' : 'minigames.pause')} onPress={() => send({ type: round.session.status === 'paused' ? 'resume' : 'pause' })} /></View><Button secondary title={t('minigames.quit')} onPress={() => router.back()} /></View>
      {round.session.status === 'paused' && <Card><Title>{t('minigames.paused')}</Title><Muted>{t('minigames.pausedHelp')}</Muted></Card>}
      {round.feedback && <AppText accessibilityLiveRegion="polite">{t(`minigames.feedback.${round.feedback}`)}</AppText>}
      {!!reason && <Muted>{m('minigames.soundReason', reason)}</Muted>}
      <View style={{ flex: 1, display: round.session.status === 'paused' ? 'none' : 'flex' }}>{game === 'falling' ? <GameBoard round={round} send={send} reduced={reduced} /> : <ScrollView scrollEnabled={!scrollLocked} contentContainerStyle={{ gap: 12, paddingBottom: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}>{round.battle || round.workshop || round.wordsearch || round.ninja || round.missing ? <Wave2Board round={round} send={send} readRound={() => runtime.current!.round} reduced={reduced} lockScroll={setScrollLocked} /> : <GameBoard key={round.cipher?.word.id || game} round={round} send={send} reduced={reduced} />}</ScrollView>}</View>
    </View>}
    {game === 'workshop' && <View style={{ maxHeight: 140, padding: 10 }}><AppText>{m('minigames.wave2.recipes', { count: recipes.length })}</AppText><ScrollView>{recipes.map(id => <AppText key={id}>{words.find(item => item.id === id)?.word || id}</AppText>)}</ScrollView></View>}
    {game === 'workshop' && recipeError && <ErrorNotice message={m('minigames.storageError')} retry={round ? () => void saveRecipes(round) : undefined} />}
    {saveError && <ErrorNotice message={m('minigames.storageError')} retry={round?.session.status === 'finished' ? () => void save(round) : undefined} />}
    <ChoiceSheet title={t(`minigames.${picker === 'mode' ? 'answerMode' : picker || 'level'}`)} value={picker === 'level' ? level : picker === 'difficulty' ? difficulty : picker === 'mode' ? mode : alphabet} options={options} visible={!!picker} onClose={() => setPicker(undefined)} onSelect={value => { setError(''); if (picker === 'level') setLevel(value as Level); else if (picker === 'difficulty') setDifficulty(value as Difficulty); else if (picker === 'mode') setMode(value as AnswerMode); else setAlphabet(value as Alphabet) }} />
  </SafeAreaView>
}
