import { AlertCircle, ArrowRight, CheckCircle2, Clock3, RotateCcw, Trophy } from 'lucide-react'
import type { GrammarSessionResult } from '../../services/api'

interface Props { result: GrammarSessionResult; onRedoWrong: () => void; onContinue: () => void; loading?: boolean }

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return minutes ? `${minutes} phút ${remain} giây` : `${remain} giây`
}

export default function SessionResult({ result, onRedoWrong, onContinue, loading = false }: Props) {
  const percent = result.total ? Math.round(result.score / result.total * 100) : 0
  return (
    <section className="theme-card mx-auto max-w-3xl rounded-3xl p-5 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Trophy className="h-8 w-8" /></div>
      <div className="mt-4 text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Hoàn thành buổi luyện</p><h2 className="mt-2 text-3xl font-black text-[color:var(--text)]">{result.score} <span className="text-xl font-semibold text-[color:var(--text-muted)]">/ {result.total} câu đúng</span></h2><p className="mt-2 text-[color:var(--text-muted)]">Độ chính xác {percent}%</p></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><CheckCircle2 className="h-5 w-5 text-[color:var(--primary)]" /><div><p className="text-xs text-[color:var(--text-muted)]">Đã trả lời</p><p className="font-bold text-[color:var(--text)]">{result.total} câu</p></div></div>
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><Clock3 className="h-5 w-5 text-[color:var(--primary)]" /><div><p className="text-xs text-[color:var(--text-muted)]">Thời gian</p><p className="font-bold text-[color:var(--text)]">{durationLabel(result.duration_seconds)}</p></div></div>
      </div>

      <div className="mt-7">
        <h3 className="mb-3 text-lg font-bold text-[color:var(--text)]">Kết quả theo mẫu ngữ pháp</h3>
        {result.by_rule.length ? <div className="space-y-2">{result.by_rule.map((rule, index) => <div key={`${rule.grammar_rule_id ?? 'unknown'}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3"><div className="min-w-0"><p className="truncate font-semibold text-[color:var(--text)]">{rule.rule_name || (rule.grammar_rule_id ? `Mẫu #${rule.grammar_rule_id}` : 'Không gắn mẫu')}</p><p className="text-xs text-[color:var(--text-muted)]">{rule.questions} câu</p></div><p className="shrink-0 font-bold text-[color:var(--primary)]">{rule.correct}/{rule.questions}</p></div>)}</div> : <p className="text-sm text-[color:var(--text-muted)]">Chưa có dữ liệu theo mẫu.</p>}
      </div>

      {result.wrong_question_ids.length > 0 && <p className="mt-5 flex items-center gap-2 rounded-xl bg-[color:var(--accent)] p-3 text-sm text-[color:var(--text-muted)]"><AlertCircle className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />Bạn có {result.wrong_question_ids.length} câu cần ôn lại.</p>}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onRedoWrong} disabled={!result.wrong_question_ids.length || loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-4 font-bold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4" />Làm lại các câu sai</button>
        <button type="button" onClick={onContinue} disabled={loading} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:opacity-50">Luyện tiếp <ArrowRight className="h-4 w-4" /></button>
      </div>
    </section>
  )
}
