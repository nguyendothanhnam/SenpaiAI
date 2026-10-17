import { useState, useRef, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Send, Bot, User, Loader2, Trash2, Search, PenLine, Mic } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chatAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { formatRelativeTime } from '../utils/helpers'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../utils/getErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import HandwritingInputModal from '../components/kanji/HandwritingInputModal.jsx'
import VoiceChatPanel from '../components/chat/VoiceChatPanel'

interface ChatMessage {
  id: number
  question: string
  answer: string
  jlpt_level?: string
  grammar_points?: any[]
  translation?: string
  sources?: any[]
  created_at: string
  input_mode?: 'text' | 'voice'
}

interface MessageFormData {
  message: string
}

export default function Chat() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const [searchQuery, setSearchQuery] = useState('')
  const [handwritingOpen, setHandwritingOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const form = useForm<MessageFormData>()

  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery(
    ['chatHistory'],
    () => chatAPI.getHistory().then(res => res.data),
    {
      refetchOnWindowFocus: false,
    }
  )

  const sendMessageMutation = useMutation(
    (data: { message: string; context?: string; jlpt_level?: string }) =>
      chatAPI.sendMessage(data.message, data.context, data.jlpt_level).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['chatHistory'])
        form.reset()
      },
      onError: (error: any) => {
        toast.error(getErrorMessage(error))
      },
    }
  )

  const deleteMessageMutation = useMutation(
    (chatId: number) => chatAPI.deleteEntry(chatId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['chatHistory'])
        toast.success(t('chat.messageDeleted'))
      },
      onError: (error: unknown) => {
        toast.error(getErrorMessage(error))
      },
    }
  )

  const clearHistoryMutation = useMutation(
    () => chatAPI.clearHistory(),
    {
      onSuccess: () => {
        queryClient.setQueryData(['chatHistory'], [])
        queryClient.invalidateQueries(['chatHistory'])
        toast.success(t('chat.historyCleared'))
      },
      onError: (error: unknown) => {
        toast.error(getErrorMessage(error))
      },
    }
  )

  const sortedMessages = useMemo(() => {
    return [...(chatHistory || [])].sort(
      (a: ChatMessage, b: ChatMessage) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [chatHistory])

  const displayedMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return sortedMessages
    }

    return sortedMessages.filter((message: ChatMessage) =>
      message.question.toLowerCase().includes(query) ||
      message.answer.toLowerCase().includes(query)
    )
  }, [searchQuery, sortedMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedMessages])

  useEffect(() => {
    const state = location.state as { prefillMessage?: string } | null
    if (state?.prefillMessage) {
      form.setValue('message', state.prefillMessage, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
    }
  }, [location.state, form])

  const handleSubmit = (data: MessageFormData) => {
    if (!data.message.trim()) return
    
    sendMessageMutation.mutate({
      message: data.message,
      jlpt_level: user?.current_jlpt_level,
    })
  }

  const insertKanji = (kanji: string) => {
    const currentMessage = form.getValues('message') || ''
    form.setValue('message', `${currentMessage}${kanji}`, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <HandwritingInputModal
        open={handwritingOpen}
        onClose={() => setHandwritingOpen(false)}
        onSelect={insertKanji}
      />
      {voiceOpen && <VoiceChatPanel onClose={() => setVoiceOpen(false)} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[color:var(--text)]">{t('chat.title')}</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            {t('chat.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setVoiceOpen(true)} className="btn btn-outline btn-sm inline-flex items-center gap-2" aria-label={t('chat.voiceChat')}>
            <Mic className="h-4 w-4" /><span className="hidden sm:inline">{t('chat.voiceChat')}</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              placeholder={t('chat.searchHistory')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-pill border border-[color:var(--border)] bg-[color:var(--card-glass)] py-2 pl-10 pr-4 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
            />
          </div>
          <button
            onClick={() => clearHistoryMutation.mutate()}
            className="btn btn-outline btn-sm text-[color:var(--text-muted)] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            disabled={clearHistoryMutation.isLoading}
            aria-label={t('chat.clearHistory')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="theme-card flex-1 space-y-4 overflow-y-auto p-4">
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)]">
            <Bot className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">{t('chat.emptyTitle')}</p>
            <p className="text-sm">{t('chat.emptyDescription')}</p>
          </div>
        ) : (
          displayedMessages.map((message: ChatMessage) => (
            <div key={message.id} className="space-y-3 animate-fadeIn">
              {/* User Question */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] shadow-md">
                    <User className="h-4 w-4 text-[color:var(--primary-contrast)]" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="theme-card rounded-card p-4">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-[color:var(--text)]">{message.question}</p>{message.input_mode === 'voice' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--accent)] px-2 py-1 text-[10px] font-semibold text-[color:var(--primary)]"><Mic className="h-3 w-3" />{t('chat.voice')}</span>}</div>
                  </div>
                  <p className="mt-2 text-xs font-medium text-[color:var(--text-muted)]">
                    {formatRelativeTime(message.created_at, language)}
                  </p>
                </div>
                <button
                  onClick={() => deleteMessageMutation.mutate(message.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  disabled={deleteMessageMutation.isLoading}
                  aria-label={t('chat.deleteMessage')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* AI Response */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] shadow-md">
                    <Bot className="h-4 w-4 text-[color:var(--primary)]" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="theme-card rounded-card p-4">
                    <p className="japanese-text whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--text)]">{message.answer}</p>
                    
                    {message.jlpt_level && (
                      <div className="mt-3">
                          <span className="jlpt-badge bg-[color:var(--accent)] text-[color:var(--primary)]">
                          {message.jlpt_level}
                        </span>
                      </div>
                    )}
                    
                    {message.translation && (
                      <div className="mt-3 rounded-lg border-l-4 border-[color:var(--primary)] bg-[color:var(--accent)] p-3">
                        <p className="text-xs font-semibold text-[color:var(--primary)]">{t('chat.translation')}:</p>
                        <p className="mt-1 text-sm text-[color:var(--text)]">{message.translation}</p>
                      </div>
                    )}
                    
                    {message.grammar_points && message.grammar_points.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold text-[color:var(--text)]">{t('chat.grammarPoints')}:</p>
                        <div className="space-y-2">
                          {message.grammar_points.map((point, index) => (
                            <div key={index} className="rounded-lg bg-[color:var(--accent)] p-2 text-xs text-[color:var(--text)]">
                              <span className="font-semibold text-[color:var(--primary)]">{point.pattern}:</span> {point.explanation}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold text-[color:var(--text)]">{t('chat.sources')}:</p>
                        <div className="space-y-1">
                          {message.sources.map((source, index) => (
                            <div key={index} className="text-xs font-medium text-[color:var(--primary)]">
                              📚 {source.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[color:var(--text-muted)]">
                    {formatRelativeTime(message.created_at, language)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <div className="mt-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex space-x-2">
          <input
            {...form.register('message', { required: t('chat.messageRequired') })}
            type="text"
            placeholder={t('chat.messagePlaceholder')}
            className="input flex-1 border-[color:var(--border)] bg-[color:var(--card-glass)] text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:ring-[color:var(--primary)]"
            disabled={sendMessageMutation.isLoading}
          />
          <button
            type="button"
            onClick={() => setHandwritingOpen(true)}
            disabled={sendMessageMutation.isLoading}
            className="btn btn-outline border-[color:var(--border)] bg-[color:var(--card-glass)] text-[color:var(--primary)] hover:bg-[color:var(--accent)]"
            aria-label={t('chat.handwritingInput')}
          >
            <PenLine className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={sendMessageMutation.isLoading || !form.watch('message')?.trim()}
            className="btn rounded-pill bg-[color:var(--primary)] px-4 font-semibold text-[color:var(--primary-contrast)] shadow-md transition-all hover:opacity-90 hover:shadow-lg"
            aria-label={t('chat.send')}
          >
            {sendMessageMutation.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        {form.formState.errors.message && (
          <p className="mt-2 text-sm text-red-600 font-medium">
            {form.formState.errors.message.message}
          </p>
        )}
      </div>
    </div>
  )
}

