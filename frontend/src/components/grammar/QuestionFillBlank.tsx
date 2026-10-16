import { CheckCircle2, HelpCircle } from 'lucide-react'
import type { GrammarPracticeQuestion } from '../../services/api'

interface Props {
  question: GrammarPracticeQuestion
  disabled?: boolean
  onAnswer: (value: string) => void
}

export default function QuestionFillBlank({ question, disabled = false, onAnswer }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-xl font-semibold leading-relaxed text-[color:var(--text)]">{question.prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(question.options || []).map((option, index) => (
          <button key={`${option}-${index}`} type="button" disabled={disabled} onClick={() => onAnswer(option)} className="group flex min-h-14 items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 py-3 text-left font-semibold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--accent)] text-sm font-bold text-[color:var(--primary)]">{index + 1}</span>
            <span className="flex-1">{option}</span>
            <CheckCircle2 className="h-4 w-4 opacity-0 transition group-hover:opacity-100 text-[color:var(--primary)]" />
          </button>
        ))}
      </div>
      <p className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]"><HelpCircle className="h-4 w-4" />Chọn đáp án phù hợp nhất.</p>
    </div>
  )
}
