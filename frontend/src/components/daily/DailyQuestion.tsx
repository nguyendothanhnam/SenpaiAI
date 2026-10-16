import { useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import type { DailyAnswerResult, DailyTaskItem, GrammarPracticeQuestion } from '../../services/api'
import QuestionFillBlank from '../grammar/QuestionFillBlank'
import QuestionTrueFalse from '../grammar/QuestionTrueFalse'
import QuestionReorder from '../grammar/QuestionReorder'
import QuestionConjugation from '../grammar/QuestionConjugation'
import FeedbackPanel from '../grammar/FeedbackPanel'

interface Props {
  item: DailyTaskItem
  index: number
  total: number
  busy: boolean
  result?: DailyAnswerResult
  onAnswer: (answer: unknown, timeSpentMs: number) => void
  onNext: () => void
}

const labels = { grammar: 'Ngữ pháp', kanji: 'Kanji', vocab: 'Từ vựng', flashcard: 'Thẻ ghi nhớ' }
const buttonClass = 'flex min-h-14 items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 py-3 text-left font-semibold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)] disabled:opacity-50'

export default function DailyQuestion({ item, index, total, busy, result, onAnswer, onNext }: Props) {
  const payload = item.payload || {}
  const [text, setText] = useState('')
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const question = { ...payload, id: item.id, question_type: item.question_type } as GrammarPracticeQuestion
  const submit = (answer: unknown) => onAnswer(answer, Math.max(0, Date.now() - startedAt))
  const toggleIndex = (indexToToggle: number) => setSelectedIndexes((current) =>
    current.includes(indexToToggle) ? current.filter((value) => value !== indexToToggle) : [...current, indexToToggle])
  const feedback = result ? {
    is_correct: result.is_correct,
    correct_answer: result.correct_answer,
    accepted_answers: [],
    explanation_vi: result.explanation,
    examples: result.examples || [],
  } : null
  const answerText = (answer: unknown) => Array.isArray(answer) ? answer.join('') : typeof answer === 'boolean' ? (answer ? 'Đúng' : 'Sai') : String(answer ?? '—')

  return <article className="theme-card mx-auto w-full max-w-3xl rounded-3xl p-5 shadow-[var(--shadow-card)] sm:p-8">
    <div className="mb-6 flex items-center justify-between gap-3">
      <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-sm font-bold text-[color:var(--primary)]">{labels[item.item_type]}</span>
      <span className="text-sm font-semibold text-[color:var(--text-muted)]">Câu {index + 1} / {total}</span>
    </div>

    {item.item_type === 'grammar' && <div className="space-y-5">
      {item.question_type === 'fill_blank' && <QuestionFillBlank question={question} disabled={busy || Boolean(result)} onAnswer={submit} />}
      {item.question_type === 'true_false' && <QuestionTrueFalse question={question} disabled={busy || Boolean(result)} onAnswer={submit} />}
      {item.question_type === 'reorder' && <QuestionReorder question={question} selectedIndexes={selectedIndexes} disabled={busy || Boolean(result)} onToggle={toggleIndex} onSubmit={() => submit(selectedIndexes.map((tokenIndex) => (payload.tokens || [])[tokenIndex]))} />}
      {item.question_type === 'conjugation' && <QuestionConjugation question={question} value={text} disabled={busy || Boolean(result)} onChange={setText} onSubmit={() => submit(text)} />}
    </div>}

    {(item.item_type === 'kanji' || item.item_type === 'vocab') && <div className="space-y-5">
      {payload.kanji && <p lang="ja" className="text-center text-6xl font-bold text-[color:var(--primary)]">{payload.kanji}</p>}
      {payload.word && <p lang="ja" className="text-center text-4xl font-bold text-[color:var(--primary)]">{payload.word}<span className="mt-2 block text-lg font-medium text-[color:var(--text-muted)]">{payload.reading}</span></p>}
      <p className="text-center text-xl font-semibold leading-relaxed text-[color:var(--text)]">{payload.prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">{(payload.options || []).map((option: string, optionIndex: number) => <button key={`${option}-${optionIndex}`} type="button" className={buttonClass} disabled={busy || Boolean(result)} onClick={() => submit(option)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--accent)] text-[color:var(--primary)]">{optionIndex + 1}</span>{option}</button>)}</div>
    </div>}

    {item.item_type === 'flashcard' && <div className="space-y-5 text-center">
      <p lang="ja" className="text-5xl font-bold text-[color:var(--primary)]">{payload.word}</p>
      <p lang="ja" className="text-xl text-[color:var(--text-muted)]">{payload.reading}</p>
      <p className="text-[color:var(--text-muted)]">{payload.prompt}</p>
      {revealed && <p className="rounded-2xl bg-[color:var(--accent)] p-4 text-lg font-semibold text-[color:var(--text)]">{result?.explanation || 'Hãy tự đánh giá khả năng ghi nhớ của bạn.'}</p>}
      {!result && <div className="flex flex-wrap justify-center gap-3">
        {!revealed ? <button type="button" disabled={busy} onClick={() => setRevealed(true)} className="min-h-12 rounded-xl border border-[color:var(--border)] px-5 font-semibold text-[color:var(--text)] hover:bg-[color:var(--accent)]">Xem nghĩa</button> : <>
          <button type="button" disabled={busy} onClick={() => submit(false)} className={buttonClass}><RotateCcw className="h-4 w-4" />Chưa nhớ</button>
          <button type="button" disabled={busy} onClick={() => submit(true)} className={buttonClass}>Đã nhớ</button>
        </>}
      </div>}
    </div>}

    {feedback && item.item_type === 'flashcard' ? <section aria-live="polite" className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 sm:p-5">
      <h3 className="font-bold text-[color:var(--text)]">{feedback.is_correct ? 'Đã ghi nhận: bạn nhớ từ này!' : 'Đã ghi nhận, hãy ôn lại từ này nhé.'}</h3>
      {feedback.explanation_vi && <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{feedback.explanation_vi}</p>}
    </section> : feedback && <>
      <FeedbackPanel result={feedback} />
      <p className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm text-[color:var(--text-muted)]">Đáp án: <strong className="text-[color:var(--text)]">{answerText(result?.correct_answer)}</strong></p>
    </>}
    {result && <div className="mt-6 flex justify-end"><button type="button" onClick={onNext} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)]">{result.all_answered ? 'Xem tổng kết' : 'Câu tiếp theo'}<ArrowRight className="h-4 w-4" /></button></div>}
    {busy && <p className="mt-4 text-sm text-[color:var(--text-muted)]" role="status">Đang gửi câu trả lời…</p>}
  </article>
}
