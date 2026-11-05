import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { DailyAnswerResult, DailyItem } from '../../api/types'
import { elapsedAnswerTime, toggleToken } from '../../features/daily/logic'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Badge, Button, Card, Muted, Title, styles } from '../ui'

export function DailyQuestion({ item, index, total, busy, result, onAnswer, onNext }: {
  item: DailyItem; index: number; total: number; busy: boolean; result?: DailyAnswerResult
  onAnswer: (answer: unknown, time: number) => void; onNext: () => void
}) {
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const { colors } = useTheme()
  const [startedAt] = useState(() => performance.now())
  const [text, setText] = useState('')
  const [indexes, setIndexes] = useState<number[]>([])
  const [selected, setSelected] = useState<unknown>()
  const payload = item.payload
  const disabled = busy || !!result
  const submit = (answer: unknown) => { setSelected(answer); onAnswer(answer, elapsedAnswerTime(startedAt, performance.now())) }
  const answerLabel = (answer: unknown): string => typeof answer === 'boolean' ? mobile(answer ? 'phase1.daily.true' : 'phase1.daily.false') : Array.isArray(answer) ? answer.join('') : answer === null || answer === undefined ? mobile('phase1.daily.noAnswer') : String(answer)
  const choices = item.item_type === 'vocab' || item.item_type === 'kanji' || (item.item_type === 'grammar' && item.question_type === 'fill_blank')
  const known = choices || item.item_type === 'flashcard' || (item.item_type === 'grammar' && ['reorder', 'true_false', 'conjugation'].includes(item.question_type))
  return <Card>
    <View style={[styles.row, { justifyContent: 'space-between' }]}><Badge>{t(`daily.types.${item.item_type}`)}</Badge><AppText>{t('daily.questionProgress', { current: index + 1, total })}</AppText></View>
    {(payload.level || payload.jlpt_level) && <Muted>{mobile('phase1.daily.actualLevel', { level: payload.level || payload.jlpt_level })}</Muted>}
    {(payload.kanji || payload.word) && <AppText selectable style={{ fontSize: item.item_type === 'kanji' ? 62 : 34, lineHeight: 76, textAlign: 'center', color: colors.primary, fontWeight: '700' }}>{payload.kanji || payload.word}</AppText>}
    {payload.reading && <AppText selectable style={{ textAlign: 'center', color: colors.textMuted }}>{payload.reading}</AppText>}
    {item.item_type !== 'flashcard' && payload.prompt && <Title>{payload.prompt}</Title>}
    {choices && <View style={{ gap: 10 }}>{(payload.options ?? []).map((option, n) => <Button key={`${n}:${option}`} title={option} disabled={disabled} selected={selected === option} secondary={selected !== option} onPress={() => submit(option)} />)}</View>}
    {item.item_type === 'grammar' && item.question_type === 'true_false' && <>
      <Muted>{mobile('phase1.daily.statement')}</Muted><AppText selectable style={{ fontSize: 19, lineHeight: 30 }}>{payload.statement || payload.prompt}</AppText>
      <Button title={mobile('phase1.daily.true')} secondary={selected !== true} disabled={disabled} onPress={() => submit(true)} />
      <Button title={mobile('phase1.daily.false')} secondary={selected !== false} disabled={disabled} onPress={() => submit(false)} />
    </>}
    {item.item_type === 'grammar' && item.question_type === 'reorder' && <>
      <Muted>{mobile('phase1.daily.reorderHint')}</Muted>
      <View style={[styles.row, { minHeight: 58, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }]}>{indexes.map((n, position) => <Button key={n} title={`${position + 1}. ${payload.tokens?.[n] ?? ''}`} disabled={disabled} onPress={() => setIndexes((current) => toggleToken(current, n))} />)}</View>
      <View style={styles.row}>{(payload.tokens ?? []).map((token, n) => <Button key={n} title={token} secondary disabled={disabled || indexes.includes(n)} onPress={() => setIndexes((current) => toggleToken(current, n))} />)}</View>
      <Button secondary title={mobile('phase1.daily.resetOrder')} disabled={disabled || !indexes.length} onPress={() => setIndexes([])} />
      <Button title={mobile('phase1.daily.submit')} disabled={disabled || !payload.tokens?.length || indexes.length !== payload.tokens.length} onPress={() => submit(indexes.map((n) => payload.tokens?.[n] ?? ''))} />
    </>}
    {item.item_type === 'grammar' && item.question_type === 'conjugation' && <>
      <Muted>{mobile('phase1.daily.baseForm')}</Muted><AppText selectable style={{ fontSize: 24 }}>{payload.base_form}</AppText>
      <Muted>{mobile('phase1.daily.targetForm')}</Muted><AppText>{payload.target_form}</AppText>
      <TextInput accessibilityLabel={mobile('phase1.daily.inputHint')} placeholder={mobile('phase1.daily.inputHint')} placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} editable={!disabled} autoCapitalize="none" autoCorrect={false} keyboardType="default" returnKeyType="done" onSubmitEditing={() => { if (!disabled && text.trim()) submit(text.trim()) }} style={[styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }]} />
      <Button title={mobile('phase1.daily.submit')} disabled={disabled || !text.trim()} onPress={() => submit(text.trim())} />
    </>}
    {item.item_type === 'flashcard' && <><Muted>{mobile('phase1.daily.recallHint')}</Muted>{payload.meaning && <AppText selectable>{payload.meaning}</AppText>}<Button secondary title={t('daily.notRemembered')} disabled={disabled} onPress={() => submit(false)} /><Button title={t('daily.remembered')} disabled={disabled} onPress={() => submit(true)} /></>}
    {!known && <Muted>{mobile('phase1.daily.unsupported')}</Muted>}
    {busy && <AppText accessibilityLiveRegion="polite">{t('daily.sendingAnswer')}</AppText>}
    {result && <Card accessibilityLiveRegion="polite" style={{ backgroundColor: result.is_correct ? colors.accent : colors.bgElevated }}>
      <Title>{item.item_type === 'flashcard' ? t(result.is_correct ? 'daily.rememberedFeedback' : 'daily.reviewFeedback') : t(result.is_correct ? 'shared.correct' : 'shared.incorrect')}</Title>
      {item.item_type !== 'flashcard' && <AppText selectable>{t('daily.answer')}: {answerLabel(result.correct_answer)}</AppText>}
      {!!result.explanation && <AppText selectable>{result.explanation}</AppText>}
      {!!result.examples?.length && <Muted>{t('library.documentTypes.example')}</Muted>}
      {(result.examples ?? []).map((example, n) => <View key={`${n}:${example.ja}`} style={{ gap: 5 }}><AppText selectable style={{ fontWeight: '600' }}>{example.ja}</AppText><AppText selectable>{i18n.language === 'en' ? example.en || example.vi : example.vi || example.en}</AppText></View>)}
      <Button title={t(result.all_answered ? 'daily.viewSummary' : 'daily.nextQuestion')} onPress={onNext} />
    </Card>}
  </Card>
}
