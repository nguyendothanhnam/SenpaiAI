import { useMemo } from 'react'
import { BookOpenCheck, Brain, Check, HelpCircle, Layers3, Loader2, Sparkles } from 'lucide-react'
import type { GrammarPattern, GrammarPracticeMode, GrammarQuestionType, JlptLevel } from '../../services/api'

interface Props {
  level: JlptLevel
  onLevelChange: (level: JlptLevel) => void
  patterns: GrammarPattern[]
  jlptLevels: JlptLevel[]
  patternsLoading: boolean
  patternsError: boolean
  ruleId: number | null
  onRuleChange: (id: number | null) => void
  questionTypes: GrammarQuestionType[]
  onQuestionTypesChange: (types: GrammarQuestionType[]) => void
  count: 5 | 10 | 20
  onCountChange: (count: 5 | 10 | 20) => void
  mode: GrammarPracticeMode
  onModeChange: (mode: GrammarPracticeMode) => void
  loading: boolean
  onStart: () => void
}

const typeOptions: Array<{ id: GrammarQuestionType; label: string; description: string }> = [
  { id: 'fill_blank', label: 'Điền vào chỗ trống', description: 'Chọn từ hoặc trợ từ phù hợp' },
  { id: 'reorder', label: 'Sắp xếp câu', description: 'Xếp các thẻ từ thành câu đúng' },
  { id: 'true_false', label: 'Đúng hay sai', description: 'Đánh giá một nhận định' },
  { id: 'conjugation', label: 'Chia động từ', description: 'Tự nhập dạng chia chính xác' },
]

const modeOptions: Array<{ id: GrammarPracticeMode; label: string; description: string; icon: typeof BookOpenCheck }> = [
  { id: 'bank', label: 'Ngân hàng', description: 'Luyện câu hỏi đã được chuẩn bị', icon: BookOpenCheck },
  { id: 'mixed', label: 'Kết hợp', description: 'Ưu tiên ngân hàng, AI bù câu còn thiếu', icon: Layers3 },
  { id: 'ai', label: 'AI', description: 'Tạo câu hỏi mới theo mẫu đã chọn', icon: Sparkles },
]

export default function SessionSetup(props: Props) {
  const selectedPattern = props.patterns.find((pattern) => pattern.id === props.ruleId)
  const availableCount = useMemo(() => {
    if (!props.patterns.length) return 0
    const patterns = props.ruleId ? props.patterns.filter((item) => item.id === props.ruleId) : props.patterns
    return patterns.reduce((sum, pattern) => sum + props.questionTypes.reduce((n, type) => n + (pattern.question_counts?.[type] || 0), 0), 0)
  }, [props.patterns, props.ruleId, props.questionTypes])
  const toggleType = (id: GrammarQuestionType) => {
    props.onQuestionTypesChange(props.questionTypes.includes(id) ? props.questionTypes.filter((type) => type !== id) : [...props.questionTypes, id])
  }

  return (
    <section className="theme-card rounded-3xl p-5 shadow-[var(--shadow-card)] sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Brain className="h-5 w-5" /></div>
        <div><h2 className="text-xl font-bold text-[color:var(--text)]">Thiết lập buổi luyện</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">Chọn cấp độ, mẫu và dạng bài phù hợp.</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[color:var(--text)]">Cấp độ JLPT</span>
          <select value={props.level} onChange={(event) => props.onLevelChange(event.target.value as JlptLevel)} className="h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]">
            {(props.jlptLevels.length ? props.jlptLevels : [props.level]).map((level) => <option key={level}>{level}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[color:var(--text)]">Mẫu ngữ pháp</span>
          <select value={props.ruleId ?? ''} onChange={(event) => props.onRuleChange(event.target.value ? Number(event.target.value) : null)} disabled={props.patternsLoading || !props.patterns.length} className="h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 text-[color:var(--text)] outline-none focus:border-[color:var(--primary)] disabled:opacity-60">
            <option value="">Tất cả mẫu ngữ pháp</option>
            {props.patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.rule_name} · {pattern.japanese_pattern}</option>)}
          </select>
          {props.patternsLoading && <span className="mt-2 inline-flex items-center gap-2 text-xs text-[color:var(--text-muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải mẫu...</span>}
          {props.patternsError && <span className="mt-2 block text-xs text-red-500">Không tải được danh sách mẫu. Hãy thử tải lại trang.</span>}
        </label>
      </div>

      {selectedPattern && <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><p className="font-bold text-[color:var(--text)]">{selectedPattern.japanese_pattern} · {selectedPattern.meaning}</p>{selectedPattern.usage_notes && <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-muted)]">{selectedPattern.usage_notes}</p>}</div>}

      <fieldset className="mt-6">
        <legend className="mb-3 text-sm font-bold text-[color:var(--text)]">Dạng bài <span className="font-normal text-[color:var(--text-muted)]">(chọn một hoặc nhiều)</span></legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {typeOptions.map((item) => {
            const active = props.questionTypes.includes(item.id)
            return <button key={item.id} type="button" onClick={() => toggleType(item.id)} aria-pressed={active} className={`flex min-h-16 items-start gap-3 rounded-2xl border p-3 text-left transition ${active ? 'border-[color:var(--primary)] bg-[color:var(--accent)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] hover:border-[color:var(--primary)]'}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${active ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-contrast)]' : 'border-[color:var(--border)] text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>
              <span><span className="block text-sm font-bold text-[color:var(--text)]">{item.label}</span><span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{item.description}</span></span>
            </button>
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-[color:var(--text)]">Số câu</legend>
          <div className="grid grid-cols-3 gap-2">{([5, 10, 20] as const).map((count) => <button key={count} type="button" onClick={() => props.onCountChange(count)} className={`h-11 rounded-xl border font-bold transition ${props.count === count ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]'}`}>{count} câu</button>)}</div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-[color:var(--text)]">Nguồn câu hỏi</legend>
          <div className="grid grid-cols-3 gap-2">{modeOptions.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => props.onModeChange(id)} className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-bold transition ${props.mode === id ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
        </fieldset>
      </div>

      {props.mode === 'bank' && availableCount < props.count && <p className="mt-4 flex gap-2 rounded-xl bg-[color:var(--accent)] p-3 text-sm text-[color:var(--text-muted)]"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]" />Ngân hàng có {availableCount} câu phù hợp. Buổi luyện sẽ bắt đầu với số câu hiện có.</p>}
      {props.mode !== 'bank' && !props.ruleId && <p className="mt-4 text-xs text-[color:var(--text-muted)]">AI cần có mẫu ngữ pháp ở cấp độ này để tạo câu hỏi. Nếu ngân hàng trống, hãy chọn một mẫu cụ thể.</p>}
      <button type="button" disabled={props.loading || props.patternsLoading || !props.questionTypes.length} onClick={props.onStart} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
        {props.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}{props.loading ? 'Đang chuẩn bị câu hỏi...' : 'Bắt đầu luyện'}
      </button>
    </section>
  )
}
