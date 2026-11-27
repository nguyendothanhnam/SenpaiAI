import { useTranslation } from 'react-i18next'
import { KanjiText } from '../kanji/KanjiText'

export interface ExplanationDetails {
  reason?: string | null
  wrong_choice?: Array<{ character?: string; word?: string; reading?: string; meaning?: string; onyomi?: string[]; kunyomi?: string[] }> | null
  kanji?: { character?: string; meaning?: string; onyomi?: string[]; kunyomi?: string[] } | null
  vocabulary?: { word?: string; reading?: string; meaning?: string } | null
  grammar_rule?: { name?: string; pattern?: string; usage?: string } | null
  examples?: Array<{ ja?: string; vi?: string; word?: string; reading?: string; meaning?: string }>
  link?: string | null
}
export function AnswerExplanation({ details, incorrect }: { details: ExplanationDetails; incorrect: boolean }) {
  const { t } = useTranslation('common')
  const kanji = details.kanji, word = details.vocabulary, rule = details.grammar_rule
  return <section className="mt-3 space-y-2 break-words text-sm" aria-live="polite">
    <p><strong>{t('answerExplanation.reason')}:</strong> <KanjiText text={details.reason || t('answerExplanation.missing')} /></p>
    {rule && <p><KanjiText text={[rule.name, rule.pattern, rule.usage].filter(Boolean).join(' · ')} /></p>}
    {kanji && <p>{kanji.character} · {kanji.meaning} · {t('answerExplanation.on')}: {kanji.onyomi?.join('、') || '—'} · {t('answerExplanation.kun')}: {kanji.kunyomi?.join('、') || '—'}</p>}
    {word && <p>{word.word} {word.reading && `（${word.reading}）`} · {word.meaning}</p>}
    {incorrect && <div><strong>{t('answerExplanation.yourChoice')}:</strong> {details.wrong_choice?.length ? details.wrong_choice.map((choice, index) => <p key={index}>{[choice.character || choice.word, choice.reading, choice.meaning, choice.onyomi?.join('、'), choice.kunyomi?.join('、')].filter(Boolean).join(' · ')}</p>) : t('answerExplanation.wrongUnavailable')}</div>}
    {!!details.examples?.length && <div><strong>{t('answerExplanation.examples')}:</strong>{details.examples.slice(0, 3).map((example, index) => <p key={index}><KanjiText text={[example.ja || example.word, example.reading, example.vi || example.meaning].filter(Boolean).join(' · ')} /></p>)}</div>}
    {details.link && <a className="underline text-[color:var(--primary)]" href={details.link}>{t('answerExplanation.lesson')}</a>}
  </section>
}
