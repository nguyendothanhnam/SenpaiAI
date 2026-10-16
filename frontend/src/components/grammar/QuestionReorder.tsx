import { ArrowRight, RotateCcw } from 'lucide-react'
import type { GrammarPracticeQuestion } from '../../services/api'

interface Props {
  question: GrammarPracticeQuestion
  selectedIndexes: number[]
  disabled?: boolean
  onToggle: (index: number) => void
  onSubmit: () => void
}

export default function QuestionReorder({ question, selectedIndexes, disabled = false, onToggle, onSubmit }: Props) {
  const tokens = question.tokens || []
  return (
    <div className="space-y-5">
      <p className="text-xl font-semibold leading-relaxed text-[color:var(--text)]">{question.prompt}</p>
      <div className="min-h-24 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Câu của bạn</p>
        <div className="flex min-h-10 flex-wrap items-center gap-2">
          {selectedIndexes.length ? selectedIndexes.map((index) => (
            <button key={`${index}-selected`} type="button" disabled={disabled} onClick={() => onToggle(index)} className="rounded-xl border border-[color:var(--primary)] bg-[color:var(--accent)] px-3 py-2 font-semibold text-[color:var(--text)] disabled:cursor-not-allowed">
              {tokens[index]}
            </button>
          )) : <span className="text-sm text-[color:var(--text-muted)]">Chạm vào các thẻ bên dưới theo thứ tự đúng.</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((token, index) => {
          const selected = selectedIndexes.includes(index)
          return <button key={`${index}-${token}`} type="button" disabled={disabled || selected} onClick={() => onToggle(index)} className={`rounded-xl border px-3 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'border-[color:var(--border)] bg-[color:var(--accent)] text-[color:var(--text-muted)]' : 'border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]'}`}>{token}</button>
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={disabled || !selectedIndexes.length} onClick={onSubmit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">Kiểm tra câu <ArrowRight className="h-4 w-4" /></button>
        <button type="button" disabled={disabled || !selectedIndexes.length} onClick={() => selectedIndexes.forEach(onToggle)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] disabled:opacity-50"><RotateCcw className="h-4 w-4" />Xóa lựa chọn</button>
      </div>
    </div>
  )
}
