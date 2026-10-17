import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MessageCircle, Pause, Play, Send, Square, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { voiceAPI, type VoiceFeedback, type VoiceScenario } from '../../services/api'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { getErrorMessage } from '../../utils/getErrorMessage'

type Phase = 'setup' | 'ready' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'ended'
type Turn = { question: string; reply: string; chatId: number; feedback?: VoiceFeedback }

export default function VoiceChatPanel({ onClose }: { onClose: () => void }) {
  const [scenarios, setScenarios] = useState<VoiceScenario[]>([])
  const [scenarioId, setScenarioId] = useState('restaurant')
  const [level, setLevel] = useState<'N5' | 'N4' | 'N3'>('N5')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [autoSend, setAutoSend] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const recorder = useVoiceRecorder()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoSendRef = useRef(false)

  useEffect(() => {
    voiceAPI.getScenarios().then((response) => setScenarios(response.data)).catch((cause) => setError(getErrorMessage(cause)))
    return () => {
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const stopSpeaking = () => {
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
    setPhase(conversationId ? 'ready' : 'setup')
  }

  const speak = (text: string, audioUrl?: string | null) => {
    stopSpeaking()
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => setPhase('ready')
      audio.onerror = () => setPhase('ready')
      setPhase('speaking')
      void audio.play().catch(() => setPhase('ready'))
      return
    }
    if (!window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.onend = () => setPhase('ready')
    utterance.onerror = () => setPhase('ready')
    setPhase('speaking')
    window.speechSynthesis.speak(utterance)
  }

  const startConversation = async () => {
    setError('')
    try {
      const response = await voiceAPI.createConversation({ scenario_id: scenarioId, jlpt_level: level })
      setConversationId(response.data.id)
      setPhase('ready')
      speak(response.data.opening_text, response.data.audio_url)
    } catch (cause) {
      setError(getErrorMessage(cause))
    }
  }

  const submitTranscript = async () => {
    const text = transcript.trim()
    if (!conversationId || !text || phase === 'thinking') return
    setError('')
    setPhase('thinking')
    try {
      const response = await voiceAPI.sendTurn(conversationId, text, confidence)
      setTurns((previous) => [...previous, { question: text, reply: response.data.reply, chatId: response.data.chat_id }])
      setTranscript('')
      setConfidence(null)
      speak(response.data.reply, response.data.audio_url)
    } catch (cause) {
      setPhase('ready')
      setError(getErrorMessage(cause))
    }
  }

  const recordAndTranscribe = async () => {
    setError('')
    autoSendRef.current = autoSend
    setPhase('listening')
    try {
      const blob = await recorder.start()
      setPhase('transcribing')
      const response = await voiceAPI.transcribe(blob)
      setTranscript(response.data.text)
      setConfidence(response.data.confidence)
      setPhase('ready')
      if (autoSendRef.current && response.data.text.trim()) {
        const result = await voiceAPI.sendTurn(conversationId!, response.data.text.trim(), response.data.confidence)
        setTurns((previous) => [...previous, { question: response.data.text.trim(), reply: result.data.reply, chatId: result.data.chat_id }])
        setTranscript('')
        speak(result.data.reply, result.data.audio_url)
      }
    } catch (cause) {
      setPhase('ready')
      if (recorder.error) setError(recorder.error)
      else if ((cause as Error)?.message !== 'recording_failed') setError(getErrorMessage(cause))
    }
  }

  const loadFeedback = async (chatId: number) => {
    try {
      const response = await voiceAPI.feedback(chatId)
      setTurns((previous) => previous.map((turn) => turn.chatId === chatId ? { ...turn, feedback: response.data } : turn))
    } catch (cause) {
      toast.error(getErrorMessage(cause))
    }
  }

  const endConversation = async () => {
    if (!conversationId) return
    stopSpeaking()
    try {
      const response = await voiceAPI.endConversation(conversationId)
      setSummary(response.data.summary || {})
      setPhase('ended')
    } catch (cause) {
      setError(getErrorMessage(cause))
    }
  }

  const phaseLabel: Record<Phase, string> = {
    setup: 'Chọn tình huống và cấp độ', ready: 'Sẵn sàng', listening: 'Đang nghe',
    transcribing: 'Đang chép lời', thinking: 'Đang nghĩ', speaking: 'Đang nói', ended: 'Đã kết thúc',
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Hội thoại giọng nói với AI">
    <section className="theme-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] p-5">
        <div><h2 className="text-xl font-bold text-[color:var(--text)]">Hội thoại giọng nói</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">{phaseLabel[phase]}</p></div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-2 hover:bg-[color:var(--accent)]"><X className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {phase === 'setup' && <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Tình huống<select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className="input mt-2 w-full">{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name} — {scenario.description}</option>)}</select></label>
          <label className="text-sm font-medium">Cấp độ JLPT<select value={level} onChange={(event) => setLevel(event.target.value as typeof level)} className="input mt-2 w-full">{(['N5', 'N4', 'N3'] as const).map((item) => <option key={item}>{item}</option>)}</select></label>
          <button type="button" disabled={!scenarios.length} onClick={startConversation} className="btn btn-primary sm:col-span-2">Bắt đầu hội thoại</button>
        </div>}

        {phase !== 'setup' && phase !== 'ended' && scenarios.find((item) => item.id === scenarioId) && <div className="rounded-2xl bg-[color:var(--accent)] p-3 text-sm text-[color:var(--text-muted)]">{scenarios.find((item) => item.id === scenarioId)?.name} · {level}</div>}

        {turns.map((turn) => <article key={turn.chatId} className="space-y-3">
          <div className="rounded-2xl bg-[color:var(--accent)] p-4"><p className="mb-1 text-xs font-semibold text-[color:var(--primary)]">Bạn</p><p>{turn.question}</p></div>
          <div className="theme-card rounded-2xl p-4"><p className="mb-1 text-xs font-semibold text-[color:var(--primary)]">AI</p><p className="japanese-text">{turn.reply}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => speak(turn.reply)} className="btn btn-outline btn-sm"><Play className="mr-1 h-4 w-4" />Nghe lại</button>{!turn.feedback && <button type="button" onClick={() => loadFeedback(turn.chatId)} className="btn btn-outline btn-sm">Phản hồi sửa lỗi</button>}</div>
            {turn.feedback && <details className="mt-3 rounded-xl bg-[color:var(--bg-elevated)] p-3"><summary className="cursor-pointer font-semibold">Gợi ý cải thiện</summary><p className="mt-2 japanese-text">{turn.feedback.corrected_sentence}</p><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{turn.feedback.issues.map((issue, index) => <li key={index}><span className="japanese-text">{issue.original} → {issue.suggestion}</span><p className="text-[color:var(--text-muted)]">{issue.explanation_vi}</p></li>)}</ul>{turn.feedback.better_phrases.length > 0 && <p className="mt-2 text-sm">Cách nói khác: {turn.feedback.better_phrases.join(' · ')}</p>}</details>}
          </div>
        </article>)}

        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {recorder.error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{recorder.error}</p>}
        {confidence !== null && <p className="text-xs text-[color:var(--text-muted)]">Độ tin cậy nhận dạng tham khảo: {Math.round(confidence * 100)}%</p>}
      </div>

      {phase === 'ready' && conversationId && <footer className="space-y-3 border-t border-[color:var(--border)] p-4">
        {transcript && <label className="block text-xs text-[color:var(--text-muted)]">Bản chép lời — bạn có thể chỉnh trước khi gửi<textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={3} className="input mt-1 w-full resize-y" /></label>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoSend} onChange={(event) => setAutoSend(event.target.checked)} />Tự gửi sau khi chép lời</label>
          <div className="flex gap-2">
            <button type="button" onClick={recordAndTranscribe} className="btn btn-primary"><Mic className="mr-2 h-4 w-4" />Ghi âm</button>
            {transcript.trim() && <button type="button" onClick={submitTranscript} className="btn btn-outline"><Send className="mr-2 h-4 w-4" />Gửi câu</button>}
            <button type="button" onClick={endConversation} className="btn btn-outline">Kết thúc</button>
          </div>
        </div>
      </footer>}

      {(phase === 'listening' || phase === 'transcribing' || phase === 'thinking') && <footer className="flex items-center justify-between border-t border-[color:var(--border)] p-4">
        <span className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />{phaseLabel[phase]}</span>
        {phase === 'listening' && <button type="button" onClick={recorder.stop} className="btn btn-outline"><Square className="mr-2 h-4 w-4" />Dừng ghi</button>}
      </footer>}
      {phase === 'speaking' && <footer className="flex justify-between border-t border-[color:var(--border)] p-4"><span className="inline-flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4" />Đang phát tiếng Nhật</span><button type="button" onClick={stopSpeaking} className="btn btn-outline"><Pause className="mr-2 h-4 w-4" />Dừng đọc</button></footer>}
      {phase === 'ended' && <footer className="space-y-3 border-t border-[color:var(--border)] p-5"><h3 className="font-bold">Tóm tắt buổi luyện nói</h3><p>{String(summary?.summary_vi || 'Buổi hội thoại đã kết thúc.')}</p>{Array.isArray(summary?.common_errors) && <ul className="list-disc pl-5 text-sm">{(summary.common_errors as string[]).map((item, index) => <li key={index}>{item}</li>)}</ul>}{Array.isArray(summary?.improvements) && <ol className="list-decimal pl-5 text-sm">{(summary.improvements as string[]).map((item, index) => <li key={index}>{item}</li>)}</ol>}<button type="button" onClick={onClose} className="btn btn-primary">Đóng</button></footer>}
    </section>
  </div>
}
