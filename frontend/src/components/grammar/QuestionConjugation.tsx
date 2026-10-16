import { ArrowRight, Languages } from 'lucide-react'
import type { FormEvent } from 'react'
import type { GrammarPracticeQuestion } from '../../services/api'

interface Props { question: GrammarPracticeQuestion; value: string; disabled?: boolean; onChange: (value: string) => void; onSubmit: () => void }

export default function QuestionConjugation({ question, value, disabled = false, onChange, onSubmit }: Props) {
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit() }
  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-xl font-semibold leading-relaxed text-[color:var(--text)]">{question.prompt}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 sm:p-5">
        <div className="min-w-28">
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">Dạng gốc</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--text)]">{question.base_form}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-[color:var(--primary)]" />
        <div className="min-w-28">
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">Cần chuyển sang</p>
          <p className="mt-1 font-bold text-[color:var(--primary)]">{question.target_form}</p>
        </div>
        <Languages className="ml-auto hidden h-6 w-6 text-[color:var(--text-muted)] sm:block" />
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[color:var(--text-muted)]">Nhập đáp án tiếng Nhật</span>
        <input autoComplete="off" lang="ja" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-14 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 text-xl text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 disabled:opacity-60" placeholder="Nhập cách chia..." />
      </label>
      <button type="submit" disabled={disabled || !value.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">Kiểm tra đáp án <ArrowRight className="h-4 w-4" /></button>
    </form>
  )
}
