import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenCheck, Brain, Check, ChevronRight, HelpCircle, Clock3, Loader2, Sparkles } from 'lucide-react'
import { useMutation, useQuery } from 'react-query'
import toast from 'react-hot-toast'
import SessionSetup from '../components/grammar/SessionSetup'
import QuestionFillBlank from '../components/grammar/QuestionFillBlank'
import QuestionReorder from '../components/grammar/QuestionReorder'
import QuestionTrueFalse from '../components/grammar/QuestionTrueFalse'
import QuestionConjugation from '../components/grammar/QuestionConjugation'
import FeedbackPanel from '../components/grammar/FeedbackPanel'
import SessionResult from '../components/grammar/SessionResult'
import GrammarTabs from '../components/layout/GrammarTabs'
import { useAuth } from '../services/auth'
import { useTranslation } from 'react-i18next'
import { grammarPracticeAPI } from '../services/api'
import type {
  GrammarAnswerResult, GrammarPattern, GrammarPracticeMode,
  GrammarPracticeQuestion, GrammarQuestionType, GrammarSessionResult, JlptLevel,
} from '../services/api'

type Screen = 'setup' | 'session' | 'result'
type Count = 5 | 10 | 20

interface SessionConfig {
  jlpt_level: JlptLevel
  grammar_rule_id?: number
  question_types: GrammarQuestionType[]
  count: Count
  mode: GrammarPracticeMode
}

function errorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function GrammarPractice() {
  const [screen, setScreen] = useState<Screen>('setup')
  const { user } = useAuth()
  const { t: tGrammar } = useTranslation('grammarStatus')
  const [level, setLevel] = useState<JlptLevel>((user?.current_jlpt_level as JlptLevel) || 'N5')
  const [isAutomaticFallback, setIsAutomaticFallback] = useState(false)
  const [ruleId, setRuleId] = useState<number | null>(null)
  const [questionTypes, setQuestionTypes] = useState<GrammarQuestionType[]>(['fill_blank', 'reorder', 'true_false', 'conjugation'])
  const [count, setCount] = useState<Count>(5)
  const [mode, setMode] = useState<GrammarPracticeMode>('bank')
  const [config, setConfig] = useState<SessionConfig | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<GrammarPracticeQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState<GrammarAnswerResult | null>(null)
  const [result, setResult] = useState<GrammarSessionResult | null>(null)
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [typedAnswer, setTypedAnswer] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const [answerConflict, setAnswerConflict] = useState(false)
  const [retryAnswer, setRetryAnswer] = useState<{ question_id: number; answer: string | string[] | boolean; time_spent_ms: number } | null>(null)
  const questionStartedAt = useRef(Date.now())
  const activeSession = screen === 'session' && Boolean(sessionId)
  const activeSessionRef = useRef(activeSession)
  activeSessionRef.current = activeSession

  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as JlptLevel[]
  const patternsQuery = useQuery(['grammarPracticePatterns', 'all-levels'], async () => Object.fromEntries(await Promise.all(
    levels.map(async (itemLevel) => [itemLevel, (await grammarPracticeAPI.getPatterns(itemLevel)).data.patterns as GrammarPattern[]]),
  )) as Record<JlptLevel, GrammarPattern[]>)
  const patternsByLevel = patternsQuery.data || {} as Record<JlptLevel, GrammarPattern[]>
  const availableLevels = levels.filter((itemLevel) => (patternsByLevel[itemLevel] || []).length > 0)
  const fallbackLevel = [level, ...levels.filter((itemLevel) => levels.indexOf(itemLevel) < levels.indexOf(level)).reverse(), ...levels.filter((itemLevel) => levels.indexOf(itemLevel) > levels.indexOf(level))]
    .find((itemLevel) => availableLevels.includes(itemLevel))
  const effectiveLevel = fallbackLevel || level
  const patterns = patternsByLevel[effectiveLevel] || []

  useEffect(() => {
    if (ruleId !== null && !patterns.some((pattern) => pattern.id === ruleId)) setRuleId(null)
  }, [patterns, ruleId])

  useEffect(() => {
    if (patternsQuery.isError) toast.error('Không tải được mẫu ngữ pháp. Kiểm tra kết nối rồi thử tải lại trang.')
  }, [patternsQuery.isError])

  useEffect(() => {
    if (!patternsQuery.isLoading && fallbackLevel && fallbackLevel !== level) {
      setIsAutomaticFallback(level === user?.current_jlpt_level)
      setLevel(fallbackLevel)
    }
  }, [patternsQuery.isLoading, fallbackLevel, level, user?.current_jlpt_level])

  useEffect(() => {
    if (user?.current_jlpt_level) {
      setLevel(user.current_jlpt_level as JlptLevel)
      setIsAutomaticFallback(false)
    }
  }, [user?.current_jlpt_level])

  const startMutation = useMutation(
    (payload: SessionConfig & { question_ids?: number[] }) => grammarPracticeAPI.createSession(payload).then((response) => response.data),
    {
      onSuccess: (data, variables) => {
        setSessionId(data.session_id)
        setQuestions(data.questions)
        setQuestionIndex(0)
        setFeedback(null)
        setResult(null)
        setSelectedIndexes([])
        setTypedAnswer('')
        setRetryAnswer(null)
        setAnswerConflict(false)
        setConfig(variables)
        setScreen('session')
        questionStartedAt.current = Date.now()
        if (data.message) toast(data.message, { icon: 'ℹ️', duration: 6000 })
      },
      onError: (error: any) => { toast.error(errorMessage(error, 'Không thể tạo buổi luyện. Hãy kiểm tra kết nối rồi thử lại.')) },
    },
  )

  const answerMutation = useMutation(
    (payload: { question_id: number; answer: string | string[] | boolean; time_spent_ms: number }) => {
      if (!sessionId) throw new Error('Không tìm thấy phiên luyện')
      return grammarPracticeAPI.answer(sessionId, payload).then((response) => response.data)
    },
    {
      onSuccess: (data) => { setFeedback(data); setAnswerError(false); setAnswerConflict(false); setRetryAnswer(null) },
      onError: (error: any) => {
        setAnswerError(true)
        const duplicate = error?.response?.status === 409
        setAnswerConflict(duplicate)
        toast.error(duplicate ? 'Yêu cầu trước có thể đã được ghi nhận. Bạn có thể bỏ qua câu này và tiếp tục.' : errorMessage(error, 'Mạng đang gặp sự cố. Câu trả lời của bạn vẫn được giữ để thử gửi lại.'))
      },
    },
  )

  const finishMutation = useMutation(
    () => {
      if (!sessionId) throw new Error('Không tìm thấy phiên luyện')
      return grammarPracticeAPI.finish(sessionId).then((response) => response.data)
    },
    {
      onSuccess: (data) => { setResult(data); setScreen('result') },
      onError: (error: any) => { toast.error(errorMessage(error, 'Không thể lưu kết quả. Hãy thử kết thúc phiên lần nữa.')) },
    },
  )

  const currentQuestion = questions[questionIndex]
  const progress = questions.length ? Math.round(((feedback ? questionIndex + 1 : questionIndex) / questions.length) * 100) : 0

  const submitAnswer = useCallback((answer: string | string[] | boolean) => {
    if (!currentQuestion || feedback || answerMutation.isLoading || !sessionId) return
    const payload = {
      question_id: currentQuestion.id,
      answer,
      time_spent_ms: Math.max(0, Date.now() - questionStartedAt.current),
    }
    setRetryAnswer(payload)
    answerMutation.mutate(payload)
  }, [answerMutation, currentQuestion, feedback, sessionId])

  const goNext = useCallback(() => {
    if (!feedback || finishMutation.isLoading) return
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1)
      setFeedback(null)
      setSelectedIndexes([])
      setTypedAnswer('')
      setAnswerError(false)
      setAnswerConflict(false)
      setRetryAnswer(null)
    } else {
      finishMutation.mutate()
    }
  }, [feedback, finishMutation, questionIndex, questions.length])

  const skipUnconfirmed = useCallback(() => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1)
      setFeedback(null)
      setSelectedIndexes([])
      setTypedAnswer('')
      setAnswerError(false)
      setAnswerConflict(false)
      setRetryAnswer(null)
    } else {
      finishMutation.mutate()
    }
  }, [finishMutation, questionIndex, questions.length])

  useEffect(() => {
    if (screen === 'session' && !feedback) questionStartedAt.current = Date.now()
  }, [questionIndex, screen, feedback])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeSessionRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (!activeSessionRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') as HTMLAnchorElement | null : null
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return
      const destination = new URL(target.href, window.location.href)
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname) return
      if (!window.confirm('Bạn đang ở giữa buổi luyện. Rời trang sẽ kết thúc phần làm bài hiện tại. Bạn có muốn rời đi không?')) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', confirmInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', confirmInternalNavigation, true)
    }
  }, [])

  useEffect(() => {
    if (!currentQuestion || screen !== 'session') return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === 'Enter' && feedback) {
        event.preventDefault()
        goNext()
        return
      }
      if (typing || feedback || answerMutation.isLoading || currentQuestion.question_type !== 'fill_blank') return
      const index = Number(event.key) - 1
      const option = currentQuestion.options?.[index]
      if (Number.isInteger(index) && option !== undefined) submitAnswer(option)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [answerMutation.isLoading, currentQuestion, feedback, goNext, screen, submitAnswer])

  const handleStart = () => {
    if (!questionTypes.length) { toast.error('Hãy chọn ít nhất một dạng bài.'); return }
    const nextConfig: SessionConfig = { jlpt_level: level, ...(ruleId ? { grammar_rule_id: ruleId } : {}), question_types: questionTypes, count, mode }
    setConfig(nextConfig)
    startMutation.mutate(nextConfig)
  }

  const handleRedoWrong = () => {
    if (!result || !config || !result.wrong_question_ids.length) return
    const redoConfig = { ...config, count: Math.max(5, Math.min(20, result.wrong_question_ids.length)) as Count, question_ids: result.wrong_question_ids, mode: 'bank' as const }
    startMutation.mutate(redoConfig)
  }

  const toggleReorderToken = (index: number) => setSelectedIndexes((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])

  const title = useMemo(() => screen === 'session' ? 'Đang luyện tập' : screen === 'result' ? 'Kết quả buổi luyện' : 'Luyện ngữ pháp', [screen])

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <GrammarTabs />
      <header className="theme-card flex flex-col gap-4 rounded-3xl p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Brain className="h-6 w-6" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--primary)]">SenpaiAI · học tiếng Nhật</p><h1 className="mt-1 text-2xl font-black text-[color:var(--text)] sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-[color:var(--text-muted)]">Luyện từng mẫu câu, củng cố ngữ pháp theo cấp độ JLPT.</p></div>
        </div>
        {screen === 'session' && currentQuestion && <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-[color:var(--accent)] px-3 py-2 text-sm font-bold text-[color:var(--primary)]"><Clock3 className="h-4 w-4" />Câu {questionIndex + 1}/{questions.length}</div>}
      </header>

      {screen === 'setup' && <>
        {!patternsQuery.isLoading && availableLevels.length > 0 && isAutomaticFallback && <p className="theme-card rounded-xl px-4 py-3 text-sm text-[color:var(--text-muted)]">{tGrammar('fallbackNotice', { requested: user?.current_jlpt_level, selected: level })}</p>}
        {!patternsQuery.isLoading && !patternsQuery.isError && patterns.length === 0 && <div className="theme-card flex gap-3 rounded-2xl p-4 text-sm text-[color:var(--text-muted)]"><HelpCircle className="h-5 w-5 shrink-0 text-[color:var(--primary)]" /><p>{tGrammar('emptyLevel', { level })}</p></div>}
        <SessionSetup
          level={level} onLevelChange={(nextLevel) => { setLevel(nextLevel); setIsAutomaticFallback(false) }} patterns={patterns} jlptLevels={availableLevels} patternsLoading={patternsQuery.isLoading} patternsError={patternsQuery.isError}
          ruleId={ruleId} onRuleChange={setRuleId} questionTypes={questionTypes} onQuestionTypesChange={setQuestionTypes}
          count={count} onCountChange={setCount} mode={mode} onModeChange={setMode} loading={startMutation.isLoading} onStart={handleStart}
        />
      </>}

      {screen === 'session' && currentQuestion && <>
        <section className="theme-card rounded-3xl p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{currentQuestion.jlpt_level}</span><span className="text-sm font-semibold text-[color:var(--text-muted)]">{currentQuestion.grammar_rule?.rule_name || 'Luyện tổng hợp'}</span></div><p className="mt-2 text-xs text-[color:var(--text-muted)]">{currentQuestion.question_type === 'fill_blank' ? 'Điền vào chỗ trống' : currentQuestion.question_type === 'reorder' ? 'Sắp xếp câu' : currentQuestion.question_type === 'true_false' ? 'Đúng hay sai' : 'Chia động từ'}</p></div>
            <span className="shrink-0 text-sm font-bold text-[color:var(--text-muted)]">{questionIndex + 1} / {questions.length}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--accent)]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ buổi luyện"><div className="h-full rounded-full bg-[color:var(--primary)] transition-all duration-300" style={{ width: `${progress}%` }} /></div>

          <div className="mt-6">
            {currentQuestion.question_type === 'fill_blank' && <QuestionFillBlank question={currentQuestion} disabled={answerMutation.isLoading || Boolean(feedback)} onAnswer={submitAnswer} />}
            {currentQuestion.question_type === 'reorder' && <QuestionReorder question={currentQuestion} selectedIndexes={selectedIndexes} disabled={answerMutation.isLoading || Boolean(feedback)} onToggle={toggleReorderToken} onSubmit={() => submitAnswer(selectedIndexes.map((index) => currentQuestion.tokens?.[index] || ''))} />}
            {currentQuestion.question_type === 'true_false' && <QuestionTrueFalse question={currentQuestion} disabled={answerMutation.isLoading || Boolean(feedback)} onAnswer={submitAnswer} />}
            {currentQuestion.question_type === 'conjugation' && <QuestionConjugation question={currentQuestion} value={typedAnswer} disabled={answerMutation.isLoading || Boolean(feedback)} onChange={setTypedAnswer} onSubmit={() => submitAnswer(typedAnswer.trim())} />}
          </div>

          {answerMutation.isLoading && <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Đang chấm câu trả lời...</p>}
          {answerError && !feedback && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between"><span>{answerConflict ? 'Câu trả lời có thể đã được ghi nhận nhưng phản hồi bị gián đoạn.' : 'Chưa nhận được kết quả. Câu trả lời vẫn được giữ để gửi lại.'}</span><div className="flex gap-3">{!answerConflict && retryAnswer && <button type="button" disabled={answerMutation.isLoading} onClick={() => answerMutation.mutate(retryAnswer)} className="font-bold text-[color:var(--primary)]">Thử gửi lại</button>}{answerConflict && <button type="button" disabled={finishMutation.isLoading} onClick={skipUnconfirmed} className="font-bold text-[color:var(--primary)]">{questionIndex === questions.length - 1 ? 'Kết thúc phiên' : 'Bỏ qua câu'}</button>}</div></div>}
          {feedback && <FeedbackPanel result={feedback} />}

          {feedback && <div className="mt-5 flex justify-end"><button type="button" disabled={finishMutation.isLoading} onClick={goNext} className="inline-flex min-h-12 min-w-40 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 font-bold text-[color:var(--primary-contrast)] transition hover:brightness-95 disabled:opacity-50">{finishMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{questionIndex === questions.length - 1 ? 'Xem kết quả' : 'Tiếp theo'}<ChevronRight className="h-4 w-4" /></button></div>}
        </section>
        <div className="flex items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]"><span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />Phím 1–4 để chọn đáp án · Enter để tiếp tục</span><span className="hidden sm:inline">Thời gian được tính riêng cho mỗi câu</span></div>
      </>}

      {screen === 'session' && !currentQuestion && <section className="theme-card rounded-3xl p-8 text-center"><p className="font-semibold text-[color:var(--text)]">Phiên này không có câu hỏi.</p><button type="button" onClick={() => setScreen('setup')} className="mt-4 font-bold text-[color:var(--primary)]">Quay lại thiết lập</button></section>}

      {screen === 'result' && result && <SessionResult result={result} loading={startMutation.isLoading} onRedoWrong={handleRedoWrong} onContinue={() => { setScreen('setup'); setSessionId(null); setResult(null) }} />}

      {screen === 'setup' && <div className="grid gap-3 sm:grid-cols-2"><div className="theme-card flex items-center gap-3 rounded-2xl p-4"><BookOpenCheck className="h-5 w-5 text-[color:var(--primary)]" /><div><p className="text-sm font-bold text-[color:var(--text)]">Học theo mẫu</p><p className="text-xs text-[color:var(--text-muted)]">Ôn đúng phần bạn muốn cải thiện.</p></div></div><div className="theme-card flex items-center gap-3 rounded-2xl p-4"><Check className="h-5 w-5 text-[color:var(--primary)]" /><div><p className="text-sm font-bold text-[color:var(--text)]">Phản hồi tức thì</p><p className="text-xs text-[color:var(--text-muted)]">Xem đáp án, giải thích và ví dụ sau mỗi câu.</p></div></div></div>}
    </div>
  )
}
