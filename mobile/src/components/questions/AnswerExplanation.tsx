import { useTranslation } from 'react-i18next'
import { AppText, Muted } from '../ui'
import type { ExplanationDetails } from '../../api/types'
import { KanjiText } from '../KanjiLookup'

export function AnswerExplanation({ details, incorrect }: { details: ExplanationDetails; incorrect: boolean }) {
  const { t } = useTranslation('common')
  const kanji = details.kanji, word = details.vocabulary, rule = details.grammar_rule
  return <>
    <AppText selectable>{t('answerExplanation.reason')}: <KanjiText text={details.reason || t('answerExplanation.missing')} /></AppText>
    {rule && <AppText selectable><KanjiText text={[rule.name, rule.pattern, rule.usage].filter(Boolean).join(' · ')} /></AppText>}
    {kanji && <AppText selectable>{kanji.character} · {kanji.meaning} · {t('answerExplanation.on')}: {kanji.onyomi?.join('、') || '—'} · {t('answerExplanation.kun')}: {kanji.kunyomi?.join('、') || '—'}</AppText>}
    {word && <AppText selectable>{word.word} {word.reading && `（${word.reading}）`} · {word.meaning}</AppText>}
    {incorrect && <><Muted>{t('answerExplanation.yourChoice')}</Muted>{details.wrong_choice?.length ? details.wrong_choice.map((choice, index) => <AppText key={index} selectable>{[choice.character || choice.word, choice.reading, choice.meaning, choice.onyomi?.join('、'), choice.kunyomi?.join('、')].filter(Boolean).join(' · ')}</AppText>) : <Muted>{t('answerExplanation.wrongUnavailable')}</Muted>}</>}
    {!!details.examples?.length && <Muted>{t('answerExplanation.examples')}</Muted>}
    {details.examples?.slice(0, 3).map((example, index) => <AppText key={index} selectable><KanjiText text={[example.ja || example.word, example.reading, example.vi || example.meaning].filter(Boolean).join(' · ')} /></AppText>)}
  </>
}
