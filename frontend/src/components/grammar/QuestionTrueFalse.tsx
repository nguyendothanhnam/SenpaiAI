import { CheckCircle2, XCircle } from 'lucide-react'
import type { GrammarPracticeQuestion } from '../../services/api'

interface Props { question: GrammarPracticeQuestion; disabled?: boolean; onAnswer: (answer: boolean) => void }

export default function QuestionTrueFalse({ question, disabled = false, onAnswer }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold leading-relaxed text-[color:var(--text)]">{question.prompt}</p>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-5 sm:p-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Nhận định</p>
        <p className="text-lg leading-relaxed text-[color:var(--text)]">{question.statement || question.prompt}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={disabled} onClick={() => onAnswer(true)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-5 font-bold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)] disabled:opacity-50"><CheckCircle2 className="h-5 w-5 text-[color:var(--primary)]" />Đúng</button>
        <button type="button" disabled={disabled} onClick={() => onAnswer(false)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-5 font-bold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)] disabled:opacity-50"><XCircle className="h-5 w-5 text-[color:var(--text-muted)]" />Sai</button>
      </div>
    </div>
  )
}
