import { useState } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { KeyboardInput } from '../KeyboardLayout'
import { AppText, Button, Card, Muted, Title, styles } from '../ui'
import { useTheme } from '../../theme/ThemeProvider'
import type { PlacementAnswer, PlacementQuestion as Question } from '../../features/placement/model'
import { PlacementAudio } from './PlacementAudio'

export function PlacementQuestion({ question, attemptId, busy, onAnswer }: { question: Question; attemptId: number; busy: boolean; onAnswer: (answer: PlacementAnswer) => void }) {
  const { t } = useTranslation('placement'), { colors } = useTheme()
  const [answer, setAnswer] = useState<PlacementAnswer | null>(null), [order, setOrder] = useState<number[]>([])
  const choices = question.choices ?? (question.question_type === 'true_false' ? [{ id: true, text: t('true') }, { id: false, text: t('false') }] : question.options?.map(option => ({ id: option, text: option })))
  const tokens = question.tokens || []
  return <Card>
    <Muted>{t(`skills.${question.skill}`)} · {question.level}</Muted>
    {question.passage && <Card><AppText>{t('passageTitle')}</AppText><AppText selectable>{question.passage}</AppText></Card>}
    {question.prompt_key && <AppText>{t(question.prompt_key)}</AppText>}
    <Title>{question.statement || question.prompt}</Title>
    {question.base_form && <AppText selectable>{question.base_form} · {question.target_form}</AppText>}
    {(question.audio_url || question.question_type === 'listening') && <PlacementAudio key={question.key} attemptId={attemptId} question={question} disabled={busy} />}
    {choices?.length ? <View style={{ gap: 10 }}>{choices.map((choice, index) => <Button key={index} title={choice.text} selected={answer === choice.id} secondary={answer !== choice.id} disabled={busy} onPress={() => setAnswer(choice.id)} />)}</View> : question.question_type === 'reorder' ? <>
      <Muted>{t('reorder')}</Muted><AppText>{order.map(index => tokens[index]).join('')}</AppText>
      <View style={styles.row}>{tokens.map((token, index) => <Button key={index} secondary title={token} disabled={busy || order.includes(index)} onPress={() => { const next = [...order, index]; setOrder(next); setAnswer(next.length === tokens.length ? next.map(i => tokens[i]) : null) }} />)}</View>
      <Button secondary title={t('reset')} disabled={busy} onPress={() => { setOrder([]); setAnswer(null) }} />
    </> : <KeyboardInput value={typeof answer === 'string' ? answer : ''} onChangeText={setAnswer} maxLength={1000} editable={!busy} autoCapitalize="none" autoCorrect={false} accessibilityLabel={t('answer')} style={[styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }]} />}
    <Button title={t('submit')} disabled={busy || answer === null || (typeof answer === 'string' && !answer.trim())} onPress={() => { if (answer !== null) onAnswer(answer) }} />
  </Card>
}
