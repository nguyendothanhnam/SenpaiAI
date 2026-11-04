export interface ChatExportMessage {
  question: string
  answer: string
  created_at: string
  jlpt_level?: string
  translation?: string | null
  grammar_points?: Array<{ pattern?: string; explanation?: string }> | null
  sources?: Array<{ title?: string; url?: string }> | null
}

export interface ChatExportLabels {
  question: string
  answer: string
  level: string
  translation: string
  grammar: string
  sources: string
}

export function serializeChatHistory(messages: ChatExportMessage[], labels: ChatExportLabels, locale: string) {
  return messages.map((message) => {
    const timestamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at))
    const sections = [`[${timestamp}]`, `${labels.question}:\n${message.question}`, `${labels.answer}:\n${message.answer}`]
    if (message.jlpt_level) sections.push(`${labels.level}: ${message.jlpt_level}`)
    if (message.translation) sections.push(`${labels.translation}:\n${message.translation}`)
    if (message.grammar_points?.length) {
      sections.push(`${labels.grammar}:\n${message.grammar_points.map((point) => `- ${point.pattern || ''}${point.explanation ? `: ${point.explanation}` : ''}`).join('\n')}`)
    }
    if (message.sources?.length) {
      sections.push(`${labels.sources}:\n${message.sources.map((source) => source.url ? `- ${source.title || source.url} (${source.url})` : `- ${source.title || ''}`).join('\n')}`)
    }
    return sections.join('\n\n')
  }).join('\n\n----------------------------------------\n\n')
}

export function downloadChatHistory(content: string, filename?: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeName = filename?.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
  link.download = `${safeName || `senpaiai-chat-${new Date().toISOString().slice(0, 10)}`}.txt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
