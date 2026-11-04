import { useLayoutEffect, useRef } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatMessageEntry } from '../../services/api'
import ChatMessageBubble from './ChatMessageBubble'

interface Props {
  messages: ChatMessageEntry[]
  loading: boolean
  loadingOlder: boolean
  hasMore: boolean
  searchTerm?: string
  showSuggestions?: boolean
  emptyTitle?: string
  emptyDescription?: string
  pendingText?: string
  deletingId?: number
  onDelete: (id: number) => void
  onLoadOlder: () => void
  onStartSuggestion: (value: string) => void
}

export default function ChatMessageList({ messages, loading, loadingOlder, hasMore, searchTerm = '', showSuggestions = true, emptyTitle, emptyDescription, pendingText, deletingId, onDelete, onLoadOlder, onStartSuggestion }: Props) {
  const { t } = useTranslation('common')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const preserveScroll = useRef<{ height: number; top: number } | null>(null)
  const previousLastId = useRef<number | null>(null)

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || loading) return
    if (preserveScroll.current) {
      const old = preserveScroll.current
      element.scrollTop = old.top + (element.scrollHeight - old.height)
      preserveScroll.current = null
    } else {
      const lastId = messages[messages.length - 1]?.id ?? null
      if (pendingText || previousLastId.current === null || (lastId !== null && previousLastId.current !== lastId)) {
        element.scrollTop = element.scrollHeight
      }
    }
    previousLastId.current = messages[messages.length - 1]?.id ?? null
  }, [messages, loading, pendingText])

  const onScroll = () => {
    const element = scrollRef.current
    if (!element || element.scrollTop > 70 || !hasMore || loadingOlder || loading) return
    preserveScroll.current = { height: element.scrollHeight, top: element.scrollTop }
    onLoadOlder()
  }

  return <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7" aria-label={t('chat.messages')}>
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
    {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[color:var(--primary)]" /></div> : <>
      {loadingOlder && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" /></div>}
      {!messages.length && !pendingText && <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-[color:var(--text-muted)]">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Bot className="h-7 w-7" /></span>
        <h2 className="text-lg font-semibold text-[color:var(--text)]">{emptyTitle || t('chat.emptyTitle')}</h2>
        <p className="mt-1 max-w-sm text-sm">{emptyDescription || t('chat.emptyDescription')}</p>
        {showSuggestions && <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-3">{(['starter1', 'starter2', 'starter3'] as const).map((key) => <button key={key} type="button" onClick={() => onStartSuggestion(t(`chat.${key}`))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-3 text-left text-sm text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)]">{t(`chat.${key}`)}</button>)}</div>}
      </div>}
      <div className="space-y-9">{messages.map((message) => <ChatMessageBubble key={message.id} message={message} searchTerm={searchTerm} deleting={deletingId === message.id} onDelete={onDelete} />)}</div>
      {pendingText && <div className="mt-8 space-y-6"><p className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[color:var(--accent)] px-5 py-3.5 text-sm text-[color:var(--text)]">{pendingText}</p><div role="status" className="flex items-center gap-3 py-3 text-sm text-[color:var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />{t('chat.thinking')}</div></div>}
    </>}
    </div>
  </div>
}
