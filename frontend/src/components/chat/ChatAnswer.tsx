import { Fragment } from 'react'

function highlight(text: string, term: string) {
  const query = term.trim()
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'ig')).map((part, index) => part.toLocaleLowerCase() === query.toLocaleLowerCase()
    ? <mark key={index} className="rounded bg-[color:var(--accent)] px-0.5 text-[color:var(--primary)]">{part}</mark>
    : <Fragment key={index}>{part}</Fragment>)
}

function inline(text: string, searchTerm: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-[color:var(--text)]">{highlight(part.slice(2, -2), searchTerm)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded-md bg-[color:var(--accent)] px-1.5 py-0.5 text-[0.9em] text-[color:var(--primary)]">{highlight(part.slice(1, -1), searchTerm)}</code>
    return <Fragment key={index}>{highlight(part, searchTerm)}</Fragment>
  })
}

// Render the small Markdown subset used in answers as React nodes. Model text
// is never inserted as HTML, and legacy internal labels are hidden on display.
export default function ChatAnswer({ text, searchTerm = '' }: { text: string; searchTerm?: string }) {
  const renderInline = (value: string) => inline(value, searchTerm)
  const lines = text.split('\n').filter(line => !/^(?:\*\*)?(?:Intent|Output|Classification|Task)\s*[:：]/i.test(line.trim()))
  const blocks = lines.join('\n').trim().split(/\n\s*\n/)
  return <div className="japanese-text space-y-4 break-words text-[15px] leading-7 text-[color:var(--text)]">
    {blocks.map((block, index) => {
      const rows = block.split('\n')
      if (rows.every(row => /^\s*[-*•]\s+/.test(row))) return <ul key={index} className="list-disc space-y-2 pl-5 marker:text-[color:var(--primary)]">{rows.map((row, i) => <li key={i}>{renderInline(row.replace(/^\s*[-*•]\s+/, ''))}</li>)}</ul>
      if (rows.every(row => /^\s*\d+[.)]\s+/.test(row))) return <ol key={index} className="list-decimal space-y-2 pl-5">{rows.map((row, i) => <li key={i}>{renderInline(row.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>
      return <div key={index}>{rows.map((row, i) => /^#{1,6}\s/.test(row)
        ? <h3 key={i} className="mb-2 font-semibold">{renderInline(row.replace(/^#{1,6}\s+/, ''))}</h3>
        : <Fragment key={i}>{i > 0 && <br />}{renderInline(row)}</Fragment>)}</div>
    })}
  </div>
}
