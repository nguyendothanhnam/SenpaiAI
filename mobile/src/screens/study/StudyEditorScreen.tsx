import { useRef, useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, Card, Loading, Muted, Screen, Title, styles } from '../../components/ui'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { getOptionKey, isCorrectQuizAnswer } from '../../features/study/quizAnswers'
import { newSet, type QuizQuestion, type StudySet } from '../../features/study/types'
import { MAX_ITEMS, validateManual } from '../../features/study/validation'
import { studyStore, useStudy } from '../../features/study/useStudy'
import { Field, Issues, StorageNotice, StudyList, useLeaveGuard, useWork } from './shared'

const blankQuestion = (): QuizQuestion => ({ question: '', options: ['', '', '', ''], answer: '' })
export function StudyEditorScreen() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>(), library = useStudy(), { t } = useTranslation('mobile')
  if (library.query.isLoading) return <Loading />
  const existing = id ? library.sets.find(set => set.id === id) : undefined
  if (!library.writable || (id && !existing) || (!id && kind !== 'quiz' && kind !== 'flashcard')) return <Screen><StorageNotice library={library} /><Muted>{t('phase4.missingSet')}</Muted></Screen>
  return <EditorForm key={`${library.account}:${id || kind}`} initial={existing || newSet(kind === 'quiz' ? 'quiz' : 'flashcard')} library={library} />
}
function EditorForm({ initial, library }: { initial: StudySet; library: ReturnType<typeof useStudy> }) {
  const { t } = useTranslation('mobile'), work = useWork()
  const [form, setForm] = useState<StudySet>(() => initial.questions.length || initial.cards.length ? { ...initial, questions: initial.questions.map(q => { const key = getOptionKey(q.options.findIndex((_, i) => isCorrectQuizAnswer(q, getOptionKey(i)))); return { ...q, answer: key, correct_answer: key } }) } : { ...initial, questions: initial.kind === 'quiz' ? [blankQuestion()] : [], cards: initial.kind === 'flashcard' ? [{ front: '', back: '' }] : [] })
  const [levelPicker, setLevelPicker] = useState(false)
  const [baseline] = useState(() => JSON.stringify(form)), [saved, setSaved] = useState(false)
  const keys = useRef(Array.from({ length: Math.max(form.questions.length, form.cards.length) }, (_, i) => `initial-${i}`)), serial = useRef(0)
  const dirty = JSON.stringify(form) !== baseline
  const disableGuard = useLeaveGuard(dirty && !saved, work.busy && !saved)
  const quiz = form.kind === 'quiz', count = quiz ? form.questions.length : form.cards.length
  function question(index: number, update: Partial<QuizQuestion>) { setForm(current => ({ ...current, questions: current.questions.map((item, i) => i === index ? { ...item, ...update } : item) })) }
  function remove(index: number) { keys.current.splice(index, 1); setForm(current => ({ ...current, questions: quiz ? current.questions.filter((_, i) => i !== index) : [], cards: quiz ? [] : current.cards.filter((_, i) => i !== index) })) }
  function add() { if (count >= MAX_ITEMS) return; keys.current.push(`added-${serial.current++}`); setForm(current => quiz ? { ...current, questions: [...current.questions, blankQuestion()] } : { ...current, cards: [...current.cards, { front: '', back: '' }] }) }
  return <StudyList data={Array.from({ length: count }, (_, index) => ({ index, key: keys.current[index] }))} keyExtractor={item => item.key} header={<View style={{ gap: 14 }}><Title>{t(`phase4.${quiz ? 'quiz' : 'flashcard'}`)}</Title><Muted>{t('phase4.localNotice')}</Muted><Field label={t('phase4.name')} value={form.name} limit={120} disabled={work.busy} onChange={name => setForm(current => ({ ...current, name }))} /><Button secondary title={`${t('phase4.level')}: ${form.jlpt_level || t('phase4.mixed')}`} disabled={work.busy} onPress={() => setLevelPicker(true)} /><Field label={t('phase4.category')} value={form.category} disabled={work.busy} onChange={category => setForm(current => ({ ...current, category }))} /><Issues error={work.error} /><ChoiceSheet visible={levelPicker} title={t('phase4.level')} value={form.jlpt_level} options={['', 'N5', 'N4', 'N3', 'N2', 'N1'].map(value => ({ value, label: value || t('phase4.mixed') }))} onClose={() => setLevelPicker(false)} onSelect={jlpt_level => setForm(current => ({ ...current, jlpt_level }))} /></View>}
    renderItem={({ item: { index } }) => <Card style={{ marginTop: 14 }}><Title>{t('phase4.rowNumber', { count: index + 1 })}</Title>{quiz ? <>
      <Field label={t('phase4.question')} value={form.questions[index].question} multiline disabled={work.busy} onChange={value => question(index, { question: value })} />
      {form.questions[index].options.map((option, optionIndex) => <Field key={optionIndex} label={t('phase4.option', { key: getOptionKey(optionIndex) })} value={option} multiline disabled={work.busy} onChange={value => question(index, { options: form.questions[index].options.map((old, i) => i === optionIndex ? value : old) })} />)}
      <Muted>{t('phase4.chooseAnswer')}</Muted><View style={styles.row}>{form.questions[index].options.map((_, i) => <Button key={i} title={getOptionKey(i)} secondary={form.questions[index].answer !== getOptionKey(i)} selected={form.questions[index].answer === getOptionKey(i)} disabled={work.busy} onPress={() => question(index, { answer: getOptionKey(i), correct_answer: getOptionKey(i) })} />)}</View>
      <Field label={t('phase4.explanation')} value={form.questions[index].explanation || ''} multiline disabled={work.busy} onChange={explanation => question(index, { explanation })} />
    </> : <>{(['front', 'back'] as const).map(side => <Field key={side} label={t(`phase4.${side}`)} value={form.cards[index][side]} multiline disabled={work.busy} onChange={value => setForm(current => ({ ...current, cards: current.cards.map((card, i) => i === index ? { ...card, [side]: value } : card) }))} />)}</>}
      <Button secondary title={t('phase4.removeRow')} disabled={work.busy || count <= 1} onPress={() => remove(index)} />
    </Card>}
    footer={<View style={{ gap: 12, marginTop: 18 }}><Button secondary title={t('phase4.addRow')} disabled={work.busy || count >= MAX_ITEMS} onPress={add} /><Button title={t(work.busy ? 'phase4.working' : 'phase4.save')} disabled={work.busy} onPress={() => void work.run(async () => { const valid = validateManual(form); await studyStore.save(library.account!, valid); setSaved(true); disableGuard(); await library.refresh(); router.replace(form.kind === 'quiz' ? '/study/quiz' : '/study/flashcard') })} /><Issues error={work.error} /></View>} />
}
