import { useRef, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { AppText, Button, Card, Loading, Muted, Progress, Screen, Title, styles } from '../../components/ui'
import { QuestionCard } from '../../components/questions/QuestionCard'
import { correctAnswerText, getOptionKey, isQuizChoiceCorrect, shuffled, shuffleQuestion } from '../../features/study/quizAnswers'
import type { QuizQuestion, StudySet } from '../../features/study/types'
import { useStudy } from '../../features/study/useStudy'
import { StorageNotice, StudyList, useLeaveGuard } from './shared'

interface Attempt { question: QuizQuestion; selected: string; correct: boolean }
export function QuizPlayScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(), library = useStudy(), { t } = useTranslation('mobile')
  if (library.query.isLoading) return <Loading />
  const set = library.sets.find(set => set.id === id && set.kind === 'quiz')
  if (!set || !set.questions.length) return <Screen solid><StorageNotice library={library} /><Muted>{t('phase4.missingSet')}</Muted></Screen>
  return <QuizSession key={`${library.account}:${set.id}`} set={set} />
}
function QuizSession({ set }: { set: StudySet }) {
  const { t } = useTranslation('mobile')
  const [shuffleQuestions, setShuffleQuestions] = useState(true), [shuffleOptions, setShuffleOptions] = useState(true)
  const [questions, setQuestions] = useState<QuizQuestion[]>([]), [attempts, setAttempts] = useState<Attempt[]>([]), [index, setIndex] = useState(0), [done, setDone] = useState(false), [elapsed, setElapsed] = useState(0), [round, setRound] = useState(0)
  const started = useRef(0), answered = useRef(-1), advanced = useRef(-1)
  const disableGuard = useLeaveGuard(questions.length > 0 && !done)
  function start(input: QuizQuestion[]) {
    const next = shuffleQuestions ? shuffled(input) : [...input]
    setQuestions(shuffleOptions ? next.map(q => shuffleQuestion(q)) : next)
    setAttempts([]); setIndex(0); setDone(false); setElapsed(0); setRound(value => value + 1)
    started.current = performance.now(); answered.current = -1; advanced.current = -1
  }
  const question = questions[index], feedback = attempts[index], wrong = attempts.filter(attempt => !attempt.correct), score = attempts.filter(attempt => attempt.correct).length
  if (!questions.length) return <Screen solid><Title>{set.name}</Title><Muted>{t('phase4.localGrading')}</Muted><Button secondary selected={shuffleQuestions} title={t('phase4.shuffleQuestions', { state: t(shuffleQuestions ? 'phase4.on' : 'phase4.off') })} onPress={() => setShuffleQuestions(value => !value)} /><Button secondary selected={shuffleOptions} title={t('phase4.shuffleOptions', { state: t(shuffleOptions ? 'phase4.on' : 'phase4.off') })} onPress={() => setShuffleOptions(value => !value)} /><Button title={t('phase4.start')} onPress={() => start(set.questions)} /></Screen>
  if (done) return <StudyList solid data={wrong} header={<View style={{ gap: 14 }}><Title>{t('phase4.results')}</Title><Title>{set.name}</Title><Card><Title>{t('phase4.score', { correct: score, total: questions.length })}</Title><AppText>{t('phase4.duration', { seconds: elapsed })}</AppText><Muted>{t('phase4.localGrading')}</Muted></Card><View style={styles.row}><Button title={t('phase4.retryAll')} onPress={() => start(set.questions)} /><Button secondary title={t('phase4.retryWrong')} disabled={!wrong.length} onPress={() => start(wrong.map(attempt => attempt.question))} /><Button secondary title={t('phase4.backToSets')} onPress={() => { disableGuard(); router.back() }} /></View><Title>{t(wrong.length ? 'phase4.wrongQuestions' : 'phase4.allCorrect')}</Title></View>} renderItem={({ item }) => <Card style={{ marginTop: 12 }}><AppText selectable>{item.question.question}</AppText><Muted>{t('phase4.yourAnswer', { answer: item.question.options[['A', 'B', 'C', 'D'].indexOf(item.selected)] || item.selected })}</Muted><AppText selectable>{t('phase4.correctAnswer', { answer: correctAnswerText(item.question) })}</AppText>{!!item.question.explanation && <AppText selectable>{item.question.explanation}</AppText>}</Card>} />
  return <Screen solid><Title>{set.name}</Title><Progress current={attempts.length} total={questions.length} /><Muted>{t('phase4.score', { correct: score, total: questions.length })}</Muted><QuestionCard lockOnAnswer key={`${round}:${index}`} typeLabel={t('phase4.quiz')} item={{ id: index, position: index, item_type: 'vocab', question_type: 'choice', answered: !!feedback, payload: { prompt: question.question, options: question.options.map((option, i) => `${getOptionKey(i)}. ${option}`) } }} index={index} total={questions.length} busy={false} choiceValues={question.options.map((_, i) => getOptionKey(i))} choiceCorrect={question.options.map((_, i) => isQuizChoiceCorrect(question, getOptionKey(i)))} result={feedback ? { is_correct: feedback.correct, correct_answer: correctAnswerText(question), explanation: question.explanation || '', all_answered: index === questions.length - 1 } : undefined} onAnswer={selected => {
    if (answered.current === index) return
    answered.current = index
    setAttempts(current => [...current, { question, selected: String(selected), correct: isQuizChoiceCorrect(question, String(selected)) }])
    void Haptics.selectionAsync().catch(() => undefined)
  }} onNext={() => {
    if (answered.current !== index || advanced.current === index) return
    advanced.current = index
    if (index === questions.length - 1) { setElapsed(Math.max(0, Math.round((performance.now() - started.current) / 1000))); setDone(true) }
    else setIndex(index + 1)
  }} /></Screen>
}
