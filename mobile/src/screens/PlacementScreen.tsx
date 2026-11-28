import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Alert, AppState, BackHandler, View } from 'react-native'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import { KeyboardFlatList, KeyboardLayout } from '../components/KeyboardLayout'
import { AppText, Button, Card, ErrorNotice, Muted, Progress, Title, styles } from '../components/ui'
import { PlacementQuestion } from '../components/placement/PlacementQuestion'
import { createPlacementAPI, type PlacementLevels, type PlacementStatus } from '../api/placement'
import { api, authAPI, queryClient, session } from '../api/services'
import { publishProfile } from '../auth/profile'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { PlacementController } from '../features/placement/controller'
import { currentQuestion, estimatedLevel, remainingSeconds, type PlacementAttempt, type PlacementMode, type PlacementSummary } from '../features/placement/model'
import { getErrorMessage } from '../utils/getErrorMessage'
import { createPlacementResume } from '../features/placement/resume'

const placement = createPlacementAPI(api)
const resumeStore = createPlacementResume(AsyncStorage)
interface Overview { status: PlacementStatus; levels: PlacementLevels; summary: PlacementSummary; history: PlacementAttempt[] }

export function PlacementScreen() {
  const { user, status } = useAuth(), { t, i18n } = useTranslation('placement'), { t: mobile } = useTranslation('mobile'), { colors } = useTheme()
  const params = useLocalSearchParams<{ resume?: string }>()
  // Account changes must discard every pending exam response from the previous account.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controller = useMemo(() => new PlacementController(placement), [user?.id])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [overview, setOverview] = useState<Overview>(), [mode, setMode] = useState<PlacementMode>('adaptive'), [level, setLevel] = useState('N5')
  const [now, setNow] = useState(() => performance.now()), [consent, setConsent] = useState(false)
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const attempt = state.attempt, question = attempt ? currentQuestion(attempt) : null
  const seconds = remainingSeconds(state.clock, now), activeExam = attempt?.status === 'in_progress'
  const busy = state.busy, locked = busy || state.needsSync || seconds === 0 || (activeExam && attempt.assessment_mode !== 'legacy' && seconds === null)

  async function load(resumeActive = false) {
    return controller.run(async () => {
      const [status, levels, summary, history] = await Promise.all([placement.status(), placement.levels(language), placement.summary(), placement.history()])
      if (session.getSnapshot().user?.id !== user?.id) return
      setOverview({ status, levels, summary, history })
      const current = controller.getSnapshot().attempt
      if (current) controller.accept(await placement.get(current.id))
      else if (resumeActive) {
        const saved = status.active_attempt_id ?? (Number.isSafeInteger(Number(params.resume)) && Number(params.resume) > 0 ? Number(params.resume) : null)
        if (saved) {
          try { controller.accept(await placement.get(saved)) }
          catch (error) {
            if ((error as { response?: { status: number } }).response?.status !== 404) throw error
            if (user) await resumeStore.forget(user.id)
          }
        }
      }
    })
  }
  useEffect(() => {
    void load(true)
    // Session state is rehydrated from the server on every screen mount/language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, language])
  useEffect(() => () => controller.dispose(), [controller])
  useEffect(() => {
    if (!user || !attempt) return
    const write = activeExam ? resumeStore.remember(user.id, attempt.id) : resumeStore.forget(user.id)
    void write.catch(() => undefined) // Server status remains a recovery path if local storage fails.
  }, [user, attempt, activeExam])
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 500)
    const sync = setInterval(() => {
      if (AppState.currentState === 'active' && controller.getSnapshot().attempt?.status === 'in_progress') void controller.reconcile()
    }, 30000)
    const listener = AppState.addEventListener('change', next => {
      controller.suspend()
      if (next === 'active') void controller.reconcile()
    })
    return () => { clearInterval(timer); clearInterval(sync); listener.remove() }
  }, [controller])
  useEffect(() => {
    if (activeExam && attempt.assessment_mode !== 'legacy' && seconds === 0 && !busy && !state.error && !state.needsSync) void controller.submit()
  }, [activeExam, attempt?.assessment_mode, seconds, busy, state.error, state.needsSync, controller])
  useEffect(() => { setConsent(false) }, [attempt?.id])
  usePreventRemove(status === 'authenticated' && (activeExam || busy), ({ repeat }) => {
    if (busy) { Alert.alert(mobile('placement.working')); return }
    Alert.alert(mobile('placement.leaveTitle'), mobile('placement.leaveMessage'), [{ text: mobile('phase1.daily.stay'), style: 'cancel' }, { text: t('pause'), onPress: repeat }])
  })
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false
      router.replace('/(tabs)/personal')
      return true
    })
    return () => back.remove()
  }, [])
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/personal') }
  const skills = (list: string[]) => list.length ? list.map(skill => t(`skills.${skill}`)).join(', ') : t('noPattern')
  const date = (value: string) => new Date(value).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')
  const selected = overview?.levels.levels.find(row => row.level === (mode === 'adaptive' ? 'N5' : level))
  const active = overview?.history.find(row => row.status === 'in_progress')
  const estimate = attempt ? estimatedLevel(attempt) : null, result = attempt?.result
  const latestCompleted = overview?.history.find(row => row.status === 'completed')
  const canConfirm = attempt?.status === 'completed' && !attempt.confirmed_at && (!latestCompleted || attempt.id >= latestCompleted.id)

  function start() {
    const work = (replace = false) => void controller.run(async () => {
      // Status/get decide expiry; stale history never silently abandons a live session.
      const status = await placement.status()
      if (status.active_attempt_id && !replace) { controller.accept(await placement.get(status.active_attempt_id)); return }
      if (status.active_attempt_id) await placement.abandon(status.active_attempt_id)
      controller.accept(await placement.start(language, mode, mode === 'confirmation' ? level : undefined))
    })
    if (active || overview?.status.active_attempt_id) Alert.alert(t('startNew'), t('replaceAttempt'), [{ text: mobile('phase2.cancel'), style: 'cancel' }, { text: t('startNew'), onPress: () => work(true) }])
    else work()
  }
  function confirm() {
    if (!consent || !attempt || !canConfirm) return
    void controller.run(async () => {
      controller.accept(await placement.confirm(attempt.id))
      // A successful confirm is retained even if profile refresh fails; retry only reads.
      const updated = await authAPI.me()
      await publishProfile(queryClient, session, updated)
      await queryClient.invalidateQueries()
    })
  }
  async function retry() {
    const succeeded = await load(!attempt)
    if (succeeded && controller.getSnapshot().attempt?.confirmed_at) {
      await controller.run(async () => { await publishProfile(queryClient, session, await authAPI.me()); await queryClient.invalidateQueries() })
    }
  }
  const header = <View style={{ gap: 18 }}>
    <Title>{t(!attempt ? 'setupTitle' : attempt.status === 'completed' ? 'resultTitle' : 'examTitle')}</Title><Muted>{t('disclaimer')}</Muted>
    {state.error ? <ErrorNotice message={getErrorMessage(state.error, i18n)} retry={() => void retry()} /> : null}
    {busy && <AppText accessibilityLiveRegion="polite">{t('loading')}</AppText>}
    {!attempt && <>
      <Card><AppText>{mobile('placement.purpose')}</AppText><Muted>{mobile('placement.rules')}</Muted><Muted>{mobile('placement.retakePolicy')}</Muted>
        {overview && <AppText>{mobile('placement.duration', { minutes: overview.levels.time_limit_seconds / 60, questions: mode === 'confirmation' ? 30 : '20–30' })}</AppText>}
      </Card>
      {overview?.summary && <Card><Title>{t('profileTitle')}</Title><AppText>{overview.summary.manual_level || overview.summary.current_estimated_level || t('unassessed')}</AppText><Muted>{t('profileSource', { source: t(`sources.${overview.summary.source}`) })}</Muted>{overview.summary.last_assessed_at && <Muted>{t('lastAssessment', { date: date(overview.summary.last_assessed_at) })}</Muted>}</Card>}
      {active && <Card><Title>{t('activeAttempt')}</Title><AppText>{t('savedProgress', { count: active.answered_count })}</AppText><Button title={t('resume')} disabled={busy} onPress={() => void controller.resume(active.id)} /></Card>}
      <Card><Title>{t('chooseMode')}</Title>{(['adaptive', 'confirmation'] as const).map(value => <View key={value} style={{ gap: 8 }}><Button secondary={mode !== value} selected={mode === value} title={t(value === 'adaptive' ? 'modeAdaptiveTitle' : 'modeConfirmationTitle')} disabled={busy} onPress={() => setMode(value)} /><Muted>{t(value === 'adaptive' ? 'modeAdaptiveDescription' : 'modeConfirmationDescription')}</Muted></View>)}
        <AppText>{t('chooseExpectedLevel')}</AppText>
        {(overview?.levels.levels || []).map(row => <View key={row.level} style={{ gap: 6 }}>
          <Button title={`${row.level} · ${t(row.available ? 'availableLevel' : 'unavailableLevel')}`} selected={mode === 'confirmation' && row.level === level} secondary={mode !== 'confirmation' || row.level !== level} disabled={busy || !row.available || mode !== 'confirmation'} onPress={() => setLevel(row.level)} />
          <Muted>{mobile('placement.bankSkills', { skills: row.missing_skills.length ? skills(row.missing_skills) : mobile('placement.noMissingSkills') })}</Muted>{row.is_demo && <Muted>{t('demoNotice')}</Muted>}
        </View>)}
        <Muted>{t('selectionDoesNotSetLevel')}</Muted>{selected?.is_demo && <AppText>{t('demoNotice')}</AppText>}
        {!selected?.available && <Muted>{t('bankUnavailable')}</Muted>}
        <Button title={t('start')} disabled={busy || !overview || !selected?.available} onPress={start} />
      </Card><Title>{t('history')}</Title>{overview?.history.length === 0 && <Muted>{t('noAssessments')}</Muted>}
    </>}
    {activeExam && <>
      <Card><AppText>{t(attempt.assessment_mode === 'legacy' ? 'legacySession' : attempt.assessment_mode === 'adaptive' ? 'modeAdaptiveShort' : 'modeConfirmationShort')}</AppText>
        <AppText accessibilityLiveRegion="none">{t('timeRemaining')}: {seconds === null ? mobile('placement.serverTimerUnavailable') : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}</AppText>
        <AppText>{t('progress', { count: attempt.answered_count, max: attempt.max_questions })}</AppText><Progress current={attempt.answered_count} total={attempt.max_questions} />
        <Muted>{mobile('placement.answerRule')}</Muted>{attempt.is_demo && <Muted>{t('demoNotice')}</Muted>}
      </Card>
      {state.needsSync && <ErrorNotice message={mobile('placement.syncRequired')} retry={() => void retry()} />}
      {seconds === 0 && <ErrorNotice message={t('timeExpired')} retry={() => void controller.submit()} />}
      {question && <PlacementQuestion key={`${attempt.id}:${question.key}:${question.revision}`} question={question} attemptId={attempt.id} busy={locked} onAnswer={answer => void controller.answer(answer)} />}
      {attempt.ready_to_submit && <AppText>{t('readyToSubmit')}</AppText>}
      {attempt.assessment_mode !== 'legacy' && <Button title={t('submitAssessment')} disabled={busy} onPress={() => Alert.alert(t('submitAssessment'), mobile('placement.submitWarning', { count: attempt.items.filter(item => item.user_answer == null).length }), [{ text: mobile('phase2.cancel'), style: 'cancel' }, { text: t('submitAssessment'), onPress: () => void controller.submit() }])} />}
      <Button secondary title={t('pause')} disabled={busy} onPress={leave} />
    </>}
    {attempt?.status === 'abandoned' && <Card><AppText>{mobile('placement.abandoned')}</AppText><Button secondary title={t('backToSetup')} onPress={() => { controller.clear(); void load() }} /></Card>}
    {attempt?.status === 'completed' && result && <>
      <Card><Title>{attempt.is_demo || result.is_demo ? t('insufficientEvidence') : estimate ? t('result', { level: estimate }) : t('insufficientEvidence')}</Title>
        {(attempt.is_demo || result.is_demo) && <AppText>{t('demoNotice')}</AppText>}
        <Muted>{t(attempt.assessment_mode === 'legacy' ? 'legacyResult' : estimate ? 'evidenceSufficient' : 'evidenceInsufficient')}</Muted><Muted>{mobile('placement.confidence')}</Muted>
        {attempt.selected_level && <AppText>{t('selectedLevelResult', { level: attempt.selected_level })}</AppText>}
        {result.total_score != null && <AppText>{t('internalScore')}: {result.total_score}/100</AppText>}
        {result.stop_reason === 'expired' && <AppText>{t('timeExpired')}</AppText>}
        <Muted>{t('ceiling', { level: result.estimated_up_to, ceiling: result.data_ceiling })}</Muted>
        {(['vocab', 'kanji', 'grammar', 'reading', 'listening'] as const).map(skill => { const value = result.skill_scores[skill]; return <View key={skill} style={{ gap: 5 }}><AppText>{t(`skills.${skill}`)}: {value?.score == null ? t('notTested') : t('score', { ...value })}</AppText><Progress current={value?.score || 0} total={100} /></View> })}
        <AppText>{t('strengths')}: {skills(result.strengths)}</AppText><AppText>{t('weaknesses')}: {skills(result.weaknesses)}</AppText>
        {result.outcome && !result.is_demo && <AppText>{t(`outcomes.${result.outcome}`)}</AppText>}
        <Title>{t('roadmapTitle')}</Title><AppText>{t('roadmap', { level: estimate || 'N5', skills: skills(result.focus_skills) })}</AppText>
        <Muted>{t(estimate ? 'confirmationNote' : 'saveReferenceNote')}</Muted>
        <Button secondary selected={consent} title={mobile(consent ? 'placement.consentGiven' : 'placement.consent')} disabled={busy || !canConfirm} onPress={() => setConsent(value => !value)} />
        <Button title={t(attempt.confirmed_at ? 'confirmed' : estimate ? 'confirm' : 'saveReference')} disabled={busy || !consent || !canConfirm} onPress={confirm} />
        {!canConfirm && !attempt.confirmed_at && <Muted>{mobile('placement.latestOnly')}</Muted>}
        <Button secondary title={t('retakeShort')} disabled={busy} onPress={() => { controller.clear(); void load() }} />
      </Card>
      <Button secondary title={t('practiceGrammar')} disabled={busy} onPress={() => router.push('/(tabs)/practice')} />
      <Button secondary title={t('practiceKanji')} disabled={busy} onPress={() => router.push('/kanji')} />
      <Button title={t('continue')} disabled={busy} onPress={leave} />
    </>}
  </View>
  return <KeyboardLayout style={{ flex: 1, backgroundColor: colors.screen }}><KeyboardFlatList data={!attempt ? overview?.history || [] : []} keyExtractor={row => String(row.id)} contentContainerStyle={styles.screen} ListHeaderComponent={header} refreshing={busy} onRefresh={() => void retry()} renderItem={({ item }) => <Card style={{ marginTop: 12 }}><AppText>{date(item.completed_at || item.created_at)}</AppText><Muted>{mobile(`placement.status.${item.status}`)}</Muted><AppText>{item.is_demo || item.result?.is_demo ? t('demoNotice') : estimatedLevel(item) || t('insufficientEvidence')}</AppText><Button secondary title={t(item.status === 'in_progress' ? 'resume' : 'resultTitle')} disabled={busy || item.status === 'abandoned'} onPress={() => void controller.resume(item.id)} /></Card>} /></KeyboardLayout>
}
