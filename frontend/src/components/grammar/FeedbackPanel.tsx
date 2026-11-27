import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import type { GrammarAnswerResult } from '../../services/api'
import { AnswerExplanation } from '../questions/AnswerExplanation'
import { useTranslation } from 'react-i18next'

function answerLabel(value: unknown): string {
  if (typeof value === 'boolean') return value ? '✓' : '✕'
  if (Array.isArray(value)) return value.join('')
  if (value === null || value === undefined) return '—'
  return String(value)
}

export default function FeedbackPanel({ result }: { result: GrammarAnswerResult }) {
  const { t } = useTranslation('common')
  return (
    <section aria-live="polite" className={`mt-6 rounded-2xl border p-4 sm:p-5 ${result.is_correct ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)]'}`}>
      <div className="flex items-start gap-3">
        {result.is_correct ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--primary)]" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--text-muted)]" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-[color:var(--text)]">{t(result.is_correct ? 'shared.correct' : 'shared.incorrect')}</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('answerExplanation.correctAnswer')}: <strong className="text-[color:var(--text)]">{answerLabel(result.correct_answer)}</strong>{result.accepted_answers?.length ? <span> · {result.accepted_answers.map(answerLabel).join(' / ')}</span> : null}</p>
          {result.explanation_details ? <AnswerExplanation details={result.explanation_details} incorrect={!result.is_correct} /> : result.explanation_vi && <div className="mt-3 flex gap-2 text-sm leading-relaxed text-[color:var(--text)]"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]" /><p>{result.explanation_vi}</p></div>}
          {!result.explanation_details && !!result.examples?.length && <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">{t('answerExplanation.examples')}</p>
            {result.examples.map((example, index) => <div key={`${example.ja}-${index}`} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-3">
              <p lang="ja" className="text-base font-semibold text-[color:var(--text)]">{example.ja}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{example.vi}</p>
            </div>)}
          </div>}
        </div>
      </div>
    </section>
  )
}
