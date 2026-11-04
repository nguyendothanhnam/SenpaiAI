import { useLayoutEffect, useRef, useState } from 'react'
import { Loader2, PenLine, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import HandwritingInputModal from '../kanji/HandwritingInputModal.jsx'

interface Props {
  sending: boolean
  onSend: (value: string) => Promise<boolean>
}

export default function ChatComposer({ sending, onSend }: Props) {
  const { t } = useTranslation('common')
  const [message, setMessage] = useState('')
  const [handwritingOpen, setHandwritingOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input) { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px` }
  }, [message])

  const submit = async () => {
    const text = message.trim()
    if (!text || sending) return
    if (await onSend(text)) setMessage('')
  }

  return <>
    <HandwritingInputModal open={handwritingOpen} onClose={() => setHandwritingOpen(false)} onSelect={(kanji: string) => setMessage((current) => `${current}${kanji}`)} />
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-2 shadow-sm transition focus-within:border-[color:var(--primary)] focus-within:ring-2 focus-within:ring-[color:var(--accent)]">
      <textarea ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
      }} rows={1} maxLength={6000} placeholder={t('chat.messagePlaceholder')} aria-label={t('chat.messagePlaceholder')} className="max-h-40 min-h-[48px] w-full resize-none border-0 !bg-transparent px-3 py-3 text-sm leading-6 text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)] focus:ring-0" disabled={sending} />
      <div className="flex items-center justify-between px-1 pb-1">
      <button type="button" onClick={() => setHandwritingOpen(true)} disabled={sending} className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)] disabled:opacity-50" aria-label={t('chat.handwritingInput')} title={t('chat.handwritingInput')}><PenLine className="h-4 w-4" /><span className="hidden sm:inline">{t('chat.handwritingInput')}</span></button>
      <button type="submit" disabled={sending || !message.trim()} className="btn h-9 w-10 rounded-xl bg-[color:var(--primary)] font-semibold text-[color:var(--primary-contrast)] shadow-sm transition hover:opacity-90 disabled:opacity-40" aria-label={t('chat.send')} title={t('chat.send')}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
      </div>
    </form>
    <p className="mt-2 text-center text-[10px] text-[color:var(--text-muted)]">{t('chat.sendShortcutHint')}</p>
  </>
}
