import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Send, Bot, User, Loader2, Trash2, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { chatAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { formatRelativeTime } from '../utils/helpers'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

interface ChatMessage {
  id: number
  question: string
  answer: string
  jlpt_level?: string
  grammar_points?: any[]
  translation?: string
  sources?: any[]
  created_at: string
}

interface MessageFormData {
  message: string
}

export default function Chat() {
  const [searchQuery, setSearchQuery] = useState('')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
        toast.error(error.response?.data?.detail || 'Failed to send message')
      },
    }
  )

  const deleteMessageMutation = useMutation(
    (chatId: number) => chatAPI.deleteEntry(chatId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['chatHistory'])
        toast.success('Message deleted')
      },
      onError: () => {
        toast.error('Failed to delete message')
      },
    }
  )

  const clearHistoryMutation = useMutation(
    () => chatAPI.clearHistory(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['chatHistory'])
        toast.success('Chat history cleared')
      },
      onError: () => {
        toast.error('Failed to clear history')
      },
    }
  )

  const filteredHistory = chatHistory?.filter((message: ChatMessage) =>
    message.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.answer.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSubmit = (data: MessageFormData) => {
    if (!data.message.trim()) return
    
    sendMessageMutation.mutate({
      message: data.message,
      jlpt_level: user?.current_jlpt_level,
    })
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Chat with HineGoldAI</h1>
          <p className="text-sm text-gray-600 mt-1">
            Ask questions about Japanese language, grammar, or culture
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-400" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent bg-orange-50"
            />
          </div>
          <button
            onClick={() => clearHistoryMutation.mutate()}
            className="btn btn-outline btn-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            disabled={clearHistoryMutation.isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto border border-orange-100 rounded-2xl bg-white/80 backdrop-blur p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Bot className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation by asking a question below</p>
          </div>
        ) : (
          filteredHistory.map((message: ChatMessage) => (
            <div key={message.id} className="space-y-3 animate-fadeIn">
              {/* User Question */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4">
                    <p className="text-sm text-gray-900 font-medium">{message.question}</p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 font-medium">
                    {formatRelativeTime(message.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => deleteMessageMutation.mutate(message.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  disabled={deleteMessageMutation.isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* AI Response */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center shadow-md">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-sm text-gray-900 japanese-text leading-relaxed">{message.answer}</p>
                    
                    {message.jlpt_level && (
                      <div className="mt-3">
                        <span className={`jlpt-badge bg-orange-100 text-orange-700`}>
                          {message.jlpt_level}
                        </span>
                      </div>
                    )}
                    
                    {message.translation && (
                      <div className="mt-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                        <p className="text-xs text-orange-800 font-semibold">Translation:</p>
                        <p className="text-sm text-orange-900 mt-1">{message.translation}</p>
                      </div>
                    )}
                    
                    {message.grammar_points && message.grammar_points.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Grammar Points:</p>
                        <div className="space-y-2">
                          {message.grammar_points.map((point, index) => (
                            <div key={index} className="text-xs text-gray-700 bg-orange-50 p-2 rounded-lg">
                              <span className="font-semibold text-orange-600">{point.pattern}:</span> {point.explanation}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Sources:</p>
                        <div className="space-y-1">
                          {message.sources.map((source, index) => (
                            <div key={index} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                              📚 {source.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {formatRelativeTime(message.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="mt-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex space-x-2">
          <input
            {...form.register('message', { required: 'Message is required' })}
            type="text"
            placeholder="Ask a question about Japanese..."
            className="flex-1 input border-orange-200 focus:ring-orange-300 bg-orange-50"
            disabled={sendMessageMutation.isLoading}
          />
          <button
            type="submit"
            disabled={sendMessageMutation.isLoading || !form.watch('message')?.trim()}
            className="btn btn-primary bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
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

