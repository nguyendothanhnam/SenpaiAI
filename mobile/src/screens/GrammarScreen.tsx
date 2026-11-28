import { KeyboardInput as TextInput, KeyboardFlatList as FlatList, KeyboardLayout } from '../components/KeyboardLayout'
import { useEffect, useRef, useState } from 'react'
import { ExerciseSelectionNotice } from '../components/ExerciseSelectionNotice'
import { View } from 'react-native'
import { router, usePreventRemove } from 'expo-router'
import { Alert } from 'react-native'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { grammarAPI, levels, questionTypes, type Analysis, type GrammarAnswer, type GrammarResult, type GrammarSession, type Level, type Pattern, type SessionOptions } from '../api/phase2'
import { useAuth } from '../auth/AuthProvider'
import { queryClient } from '../api/services'
import { nearestLevel } from '../features/phase2/logic'
import { GrammarSubmission, uncertainAnswerError } from '../features/phase2/grammarSubmission'
import { mixedNeedsBank, shouldUseBank } from '../features/phase2/grammarFallback'
import { QuestionCard } from '../components/questions/QuestionCard'
import { KanjiText } from '../components/KanjiLookup'
import { AppText, Button, Card, ErrorNotice, Muted, Progress, Screen, Title, styles } from '../components/ui'
import { SkeletonList } from '../components/SkeletonList'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'

export function GrammarScreen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('mobile')
  const { colors } = useTheme()

  const [tab, setTab] = useState('analysis')
  const [text, setText] = useState('')
  const [analysis, setAnalysis] = useState<Analysis>()
  const [analysisLanguage, setAnalysisLanguage] = useState('')
  const patterns = useQuery(['grammar-patterns', user?.id], async () => Object.fromEntries(await Promise.all(levels.map(async level => [level, await grammarAPI.patterns(level)]))) as Record<Level, Pattern[]>)
  const [level, setLevel] = useState<Level>((user?.current_jlpt_level as Level) || 'N5')
  const [rule, setRule] = useState<number>()
  useEffect(() => { setLevel((user?.current_jlpt_level as Level) || 'N5'); setRule(undefined) }, [user?.id, user?.current_jlpt_level])
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState([...questionTypes])
  const [count, setCount] = useState(5)
  const [mode, setMode] = useState<SessionOptions['mode']>('bank')
  const [generationNotice, setGenerationNotice] = useState(false)
  const [partialGenerationNotice, setPartialGenerationNotice] = useState(false)
  const [session, setSession] = useState<GrammarSession>()
  const [config, setConfig] = useState<SessionOptions>()
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<GrammarAnswer>()
  const [result, setResult] = useState<GrammarResult>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>()
  const [uncertain, setUncertain] = useState(false)
  const [allowLeave, setAllowLeave] = useState(false)
  const lock = useRef(false)
  const submission = useRef<GrammarSubmission | null>(null)
  const abort = useRef<AbortController | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort() } }, [])
  const effective = patterns.data ? nearestLevel(level, patterns.data) : undefined
  const field = [styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }]
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  usePreventRemove(!!session && !result && !allowLeave, ({ repeat }) => Alert.alert(t('phase1.daily.exitTitle'), t('phase2.exitGrammar'), [{ text: t('phase1.daily.stay'), style: 'cancel' }, { text: t('phase1.daily.leave'), onPress: () => { setAllowLeave(true); repeat() } }]))
  async function run(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(undefined)
    try { await work() } catch (e) { if (alive.current && (e as { code?: string }).code !== 'ERR_CANCELED') setError(e) } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  async function start(options?: SessionOptions) {
    const selected = options || { jlpt_level: effective!, grammar_rule_id: rule, question_types: types, count, mode }
    await run(async () => {
      const controller = new AbortController(); abort.current = controller
      setGenerationNotice(false)
      setPartialGenerationNotice(false)
      let created: GrammarSession
      try {
        created = await grammarAPI.start(selected, controller.signal)
        if (!created.questions.length) throw { response: { status: 404 } }
      } catch (failure) {
        if (shouldUseBank(failure, selected.mode) && alive.current) {
          setMode('bank'); setGenerationNotice(true)
          return // Preserve any previous session/result. Never retry a mutation blindly.
        }
        throw failure
      }
      if (!alive.current || controller.signal.aborted) return
      if (mixedNeedsBank(created, selected)) { setMode('bank'); setPartialGenerationNotice(true) }
      submission.current = new GrammarSubmission((id, answer, time) => grammarAPI.answer(created.session_id, id, answer, time))
      setSession(created); setConfig(selected); setIndex(0); setFeedback(undefined); setResult(undefined); setUncertain(false); setAllowLeave(false)
    })
  }
  async function finish() { if (session) await run(async () => { setResult(await grammarAPI.finish(session.session_id)); void queryClient.invalidateQueries(['grammar-stats', user?.id]) }) }
  const q = session?.questions[index]
  if (session && !result) return <Screen>
    <Title>{t('phase2.grammar')}</Title><Progress current={index} total={session.questions.length} />
    <ExerciseSelectionNotice selections={session.questions.map(question => question.selection)} />
    {q && <Muted>{q.jlpt_level}</Muted>}
    {session.message && <Muted>{t('phase2.partialSession', { count: session.questions.length })}</Muted>}
    {partialGenerationNotice && <Card accessibilityLiveRegion="polite"><AppText>{t('phase3.mixedPartialNotice')}</AppText></Card>}
    {q && <QuestionCard key={`${session.session_id}:${q.id}`} item={{ id: q.id, position: index, item_type: 'grammar', question_type: q.question_type, payload: q, answered: !!feedback }} index={index} total={session.questions.length} busy={busy || uncertain} result={feedback ? { ...feedback, explanation: feedback.explanation_vi, all_answered: index === session.questions.length - 1 } : undefined} onAnswer={(answer, time) => void run(async () => {
      try { const value = await submission.current!.submit(q.id, answer, time); if (alive.current) setFeedback(value) }
      catch (e) { if (uncertainAnswerError(e)) setUncertain(true); throw e }
    })} onNext={() => { if (index + 1 < session.questions.length) { setIndex(index + 1); setFeedback(undefined) } else void finish() }} />}
    {!!error && <ErrorNotice message={getErrorMessage(error, i18n)} />}
    {generationNotice && <Card accessibilityLiveRegion="polite"><AppText>{t('phase3.aiFallback')}</AppText></Card>}
    {uncertain && <Card><AppText>{t('phase2.uncertainAnswer')}</AppText><Button title={t('phase2.finishPartial')} disabled={busy} onPress={() => void finish()} /></Card>}
    {index === session.questions.length - 1 && feedback && !!error && <Button title={t('retry')} disabled={busy} onPress={() => void finish()} />}
  </Screen>
  if (result) return <Screen><Title>{t('phase2.results')}</Title>{uncertain && <Muted>{t('phase2.partialResults')}</Muted>}<Card><Title>{result.score}/{result.total}</Title><AppText>{t('phase2.duration', { seconds: result.duration_seconds })}</AppText>{result.by_rule.map((r, n) => <AppText selectable key={n}>{r.rule_name || t('phase2.allPatterns')}: {r.correct}/{r.questions}</AppText>)}</Card>
    <Button secondary title={t('refresh')} disabled={busy} onPress={() => void finish()} />
    {!!error && <ErrorNotice message={getErrorMessage(error, i18n)} />}
    {!!result.wrong_question_ids.length && <Button title={t('phase2.retryWrong')} disabled={busy} onPress={() => void start({ ...config!, mode: 'bank', grammar_rule_id: undefined, question_ids: result.wrong_question_ids })} />}
    <Button title={t('phase2.continuePractice')} disabled={busy} onPress={() => { setSession(undefined); setResult(undefined); setError(undefined) }} /><Button secondary title={t('phase2.progress')} onPress={() => router.push('/grammar-progress')} /></Screen>
  const rows = (patterns.data?.[effective!] || []).filter(p => `${p.rule_name} ${p.japanese_pattern} ${p.meaning}`.toLowerCase().includes(search.toLowerCase()))
  return <KeyboardLayout style={{ flex: 1 }}><FlatList data={tab === 'practice' ? rows : []} keyExtractor={p => String(p.id)} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ backgroundColor: colors.screen }} contentContainerStyle={[styles.screen, { paddingBottom: 40 }]} ListHeaderComponent={<View style={{ gap: 16 }}>
    <View style={styles.row}>{['analysis', 'practice'].map(value => <Button key={value} title={t(`phase2.${value}`)} secondary={tab !== value} disabled={busy} onPress={() => setTab(value)} />)}</View>
    <Button secondary title={t('phase2.progress')} onPress={() => router.push('/grammar-progress')} />
    {generationNotice && <Card accessibilityLiveRegion="polite"><AppText>{t('phase3.aiFallback')}</AppText></Card>}
    {!!error && <ErrorNotice message={getErrorMessage(error, i18n)} />}
    {tab === 'analysis' ? <><Title>{i18n.t('analysis.title', { ns: 'grammar' })}</Title><TextInput multiline maxLength={6000} textAlignVertical="top" value={text} onChangeText={setText} editable={!busy} placeholder={i18n.t('analysis.inputPlaceholder', { ns: 'grammar' })} accessibilityLabel={i18n.t('analysis.japaneseText', { ns: 'grammar' })} placeholderTextColor={colors.textMuted} style={[field, { minHeight: 140 }]} />
      <Button title={i18n.t(busy ? 'analysis.analyzing' : 'analysis.analyze', { ns: 'grammar' })} disabled={busy || !text.trim()} onPress={() => void run(async () => { setAnalysis(undefined); const data = await grammarAPI.analyze(text.trim(), language); if (alive.current) { setAnalysis(data); setAnalysisLanguage(language) } })} />
      {analysis && analysisLanguage === language && <><Card><Title>{analysis.jlpt_level}</Title><AppText>{i18n.t('analysis.difficulty', { ns: 'grammar' })} {analysis.difficulty_score}/10</AppText>{analysis.analysis_note && <AppText selectable>{analysis.analysis_note}</AppText>}<AppText selectable>{analysis.sentence_meaning || analysis.translation}</AppText></Card>
      {analysis.vocabulary?.map((v, n) => <Card key={`v${n}`}><AppText selectable>{v.term} {v.jlpt_level}</AppText><AppText selectable>{v.meaning}</AppText></Card>)}
      {(analysis.grammar_patterns?.length ? analysis.grammar_patterns : analysis.grammar_points || []).map((p, n) => <Card key={`g${n}`}><AppText selectable style={{ fontWeight: '700' }}><KanjiText text={p.pattern} /></AppText><AppText selectable><KanjiText text={p.explanation} /></AppText><AppText selectable><KanjiText text={p.example || ''} /></AppText></Card>)}
      {analysis.suggestions?.map((s, n) => <AppText selectable key={`s${n}`}>{s}</AppText>)}</>}
    </> : <><Title>{t('phase2.setup')}</Title>{patterns.isLoading && <SkeletonList />}{patterns.isError && <ErrorNotice message={getErrorMessage(patterns.error, i18n)} retry={() => void patterns.refetch()} />}
      {effective && effective !== level && <Muted>{i18n.t('fallbackNotice', { ns: 'grammarStatus', requested: level, selected: effective })}</Muted>}
      <View style={styles.row}>{levels.map(l => <Button key={l} title={l} disabled={busy || !nearestLevel(l, { [l]: patterns.data?.[l] || [] })} secondary={l !== effective} onPress={() => { setLevel(l); setRule(undefined) }} />)}</View>
      <AppText>{t('phase2.questionTypes')}</AppText><View style={styles.row}>{questionTypes.map(kind => <Button key={kind} title={t(`phase2.${kind}`)} disabled={busy} secondary={!types.includes(kind)} onPress={() => setTypes(types.includes(kind) ? types.filter(k => k !== kind) : [...types, kind])} />)}</View>
      <AppText>{t('phase2.count')}</AppText><View style={styles.row}>{[5, 10, 20].map(n => <Button key={n} title={String(n)} disabled={busy} secondary={count !== n} onPress={() => setCount(n)} />)}</View>
      <AppText>{t('phase2.source')}</AppText><View style={styles.row}>{(['bank', 'ai', 'mixed'] as const).map(m => <Button key={m} title={t(`phase2.${m}`)} disabled={busy} secondary={mode !== m} onPress={() => setMode(m)} />)}</View>
      <Button title={t(busy ? 'phase2.generating' : 'phase2.start')} disabled={busy || !effective || !types.length} onPress={() => void start()} />
      {busy && <Button secondary title={t('phase2.cancel')} onPress={() => abort.current?.abort()} />}
      <TextInput value={search} onChangeText={setSearch} style={field} placeholder={t('phase2.searchPatterns')} accessibilityLabel={t('phase2.searchPatterns')} placeholderTextColor={colors.textMuted} />
      <Button title={t('phase2.allPatterns')} disabled={busy} secondary={rule !== undefined} onPress={() => setRule(undefined)} />
    </>}
  </View>} renderItem={({ item }) => <View style={{ marginTop: 10 }}><Button title={`${item.rule_name} · ${item.japanese_pattern}`} disabled={busy} secondary={rule !== item.id} onPress={() => setRule(item.id)} /></View>} /></KeyboardLayout>
}
