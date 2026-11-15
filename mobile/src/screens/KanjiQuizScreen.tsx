import { useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { useLocalSearchParams, usePreventRemove } from 'expo-router'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { kanjiAPI } from '../api/phase3'
import type { KanjiQuestion } from '../api/phase3Types'
import { quizScore } from '../features/kanji/logic'
import { AppText, Button, Card, ErrorNotice, Muted, Progress, Screen, Title, styles } from '../components/ui'
import { getErrorMessage } from '../utils/getErrorMessage'
export function KanjiQuizScreen() {
  const params = useLocalSearchParams<{ level?: string }>(); const { t, i18n } = useTranslation('mobile')
  const levels = useQuery('kanji-levels', kanjiAPI.levels)
  const [level, setLevel] = useState(params.level || 'N5'); const [count, setCount] = useState(10); const [mode, setMode] = useState('meaning_match')
  const [questions, setQuestions] = useState<KanjiQuestion[]>([]); const [index, setIndex] = useState(0); const [answers, setAnswers] = useState<string[]>([]); const [finished, setFinished] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(); const [allowLeave, setAllowLeave] = useState(false); const lock = useRef(false)
  const actual = levels.data?.find(l => l.level === level)?.level || levels.data?.[0]?.level
  usePreventRemove(questions.length > 0 && !finished && !allowLeave, ({ repeat }) => Alert.alert(t('phase1.daily.exitTitle'), t('phase3.exitQuiz'), [{ text: t('phase1.daily.stay'), style: 'cancel' }, { text: t('phase1.daily.leave'), onPress: () => { setAllowLeave(true); repeat() } }]))
  async function start() {
    if (lock.current || !actual) return
    lock.current = true; setBusy(true); setError(undefined)
    try { const items = await kanjiAPI.quiz(actual, count, mode); if (!items.length) throw { response: { status: 404, data: { detail: 'mobile_no_quiz_questions' } } }; setQuestions(items); setIndex(0); setAnswers([]); setFinished(false); setAllowLeave(false) } catch (e) { setError(e) } finally { lock.current = false; setBusy(false) }
  }
  const q = questions[index], answer = answers[index]
  return <Screen solid><Title>{t('phase3.kanjiQuiz')}</Title><Muted>{t('phase3.localQuiz')}</Muted>{!!error && <ErrorNotice message={getErrorMessage(error, i18n)} />}
    {finished ? <><Title>{t('phase2.results')}: {quizScore(questions, answers)}/{questions.length}</Title><Button title={t('phase2.continuePractice')} onPress={() => { setQuestions([]); setFinished(false); setAnswers([]) }} /></> : q ? <>
      <Progress current={index} total={questions.length} /><Card><Title>{q.question}</Title>{q.options.map((option, n) => <Button key={`${n}:${option}`} title={option} secondary={answer !== option} disabled={answer !== undefined} onPress={() => setAnswers(old => old[index] === undefined ? [...old.slice(0, index), option] : old)} />)}
      {answer !== undefined && <><Title>{i18n.t(answer === q.correct_answer ? 'shared.correct' : 'shared.incorrect', { ns: 'common' })}</Title><AppText selectable>{t('phase3.correctAnswer')}: {q.correct_answer}</AppText><AppText selectable>{q.kanji.meaning_vi}</AppText><Button title={t(index === questions.length - 1 ? 'phase2.results' : 'phase3.next')} onPress={() => { if (index === questions.length - 1) setFinished(true); else setIndex(index + 1) }} /></>}</Card>
    </> : <><View style={styles.row}>{levels.data?.map(l => <Button key={l.level} title={l.level} secondary={actual !== l.level} disabled={busy} onPress={() => setLevel(l.level)} />)}</View>{levels.isError && <ErrorNotice message={getErrorMessage(levels.error, i18n)} retry={() => void levels.refetch()} />}<View style={styles.row}>{[5, 10, 20].map(n => <Button key={n} title={String(n)} secondary={count !== n} disabled={busy} onPress={() => setCount(n)} />)}</View><View style={styles.row}>{['meaning_match', 'reading_match', 'kanji_match'].map(m => <Button key={m} title={t(`phase3.${m}`)} secondary={mode !== m} disabled={busy} onPress={() => setMode(m)} />)}</View><Button title={t(busy ? 'loading' : 'phase2.start')} disabled={busy || !actual} onPress={() => void start()} />{!busy && !questions.length && <Muted>{t('phase3.quizSetupHint')}</Muted>}</>}
  </Screen>
}
