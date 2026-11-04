import { useState } from 'react'
import { Bot, Check, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { ChatMessageEntry } from '../../services/api'
import { formatRelativeTime } from '../../utils/helpers'
import ChatAnswer from './ChatAnswer'

interface Props {
  message: ChatMessageEntry
  searchTerm?: string
  deleting?: boolean
  onDelete: (id: number) => void
}

function highlight(text: string, term: string) {
  const query = term.trim()
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'ig')).map((part, index) => part.toLocaleLowerCase() === query.toLocaleLowerCase()
    ? <mark key={index} className="rounded bg-[color:var(--primary)] px-0.5 text-[color:var(--text)]">{part}</mark>
    : <span key={index}>{part}</span>)
}

function isInternalSource(source: NonNullable<ChatMessageEntry['sources']>[number]) {
  const type = (source.type || '').toLowerCase()
  const title = (source.title || '').toLowerCase()
  return type === 'deterministic_chat' || type.includes('internal') || type.includes('system_rule') ||
    title.includes('intent rules') || title.includes('internal rules') || title.includes('system rules')
}

export default function ChatMessageBubble({ message, searchTerm = '', deleting = false, onDelete }: Props) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const sources = (message.sources || []).filter((source) => !isInternalSource(source))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error(t('chat.copyError')) }
  }

  return <article className="group space-y-6 animate-fadeIn">
    <div className="ml-auto flex max-w-[92%] justify-end sm:max-w-[85%]">
      <div className="min-w-0">
        <div className="rounded-2xl rounded-tr-sm bg-[color:var(--accent)] px-5 py-3.5">
          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[color:var(--text)]">{highlight(message.question, searchTerm)}</p>
        </div>
        <p className="mt-1.5 text-right text-[11px] text-[color:var(--text-muted)]">{t('chat.you')} · {formatRelativeTime(message.created_at, language)}</p>
      </div>
    </div>

    <div className="flex items-start gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)] shadow-sm"><Bot className="h-4 w-4 text-[color:var(--primary-contrast)]" /></span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-bold text-[color:var(--text)]">SenpaiAI</span>{message.jlpt_level && <span className="rounded-md bg-[color:var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">{message.jlpt_level}</span>}</div>
        <div className="min-w-0">
          <ChatAnswer text={message.answer} searchTerm={searchTerm} />


          {message.translation && <div className="mt-3 rounded-xl border-l-4 border-[color:var(--primary)] bg-[color:var(--accent)] p-3">
            <p className="text-xs font-semibold text-[color:var(--primary)]">{t('chat.translation')}:</p><p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--text)]">{message.translation}</p>
          </div>}

          {message.grammar_points && message.grammar_points.length > 0 && <details className="mt-4 rounded-xl border border-[color:var(--border)] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[color:var(--text-muted)]">{t('chat.grammarPoints')}</summary>
            <div className="space-y-2">{message.grammar_points.map((point, index) => <div key={index} className="rounded-xl bg-[color:var(--accent)] p-3 text-xs text-[color:var(--text)]"><span className="font-semibold text-[color:var(--primary)]">{point.pattern}:</span> {point.explanation}</div>)}</div>
          </details>}

          {sources.length > 0 && <div className="mt-4 border-t border-[color:var(--border)] pt-3">
            <p className="mb-2 text-[11px] font-semibold text-[color:var(--text-muted)]">{t('chat.sources')}</p>
            <div className="flex flex-wrap gap-2">{sources.map((source, index) => <span key={index} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-[color:var(--primary)]">{source.url && /^https?:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 hover:underline"><span className="truncate">{source.title || source.url}</span><ExternalLink className="h-3 w-3 shrink-0" /></a> : source.title}</span>)}</div>
          </div>}

        </div>
        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-1 text-[color:var(--text-muted)]">
          <button type="button" onClick={() => void copyAnswer()} className="rounded-lg p-2 transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]" title={t(copied ? 'chat.copied' : 'chat.copyAnswer')} aria-label={t(copied ? 'chat.copied' : 'chat.copyAnswer')}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          {confirmingDelete ? <div role="group" aria-label={t('chat.confirmDeleteMessage')} className="flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs"><span>{t('chat.confirmDeleteMessage')}</span><button type="button" onClick={() => onDelete(message.id)} disabled={deleting} className="font-semibold text-red-600 disabled:opacity-50">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('chat.deleteMessage')}</button><button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className="underline underline-offset-2">{t('chat.cancel')}</button></div> : <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" aria-label={t('chat.deleteMessage')} title={t('chat.deleteMessage')}><Trash2 className="h-3.5 w-3.5" /><span>{t('chat.deleteMessage')}</span></button>}
        </div>
      </div>
    </div>
  </article>
}
