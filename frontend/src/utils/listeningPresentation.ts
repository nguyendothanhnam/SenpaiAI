// Presentation only. The existing backend remains authoritative for URL/subtitle validation.
export function youtubePreviewId(raw: string): string | null {
  if (!raw || raw.length > 500 || raw !== raw.trim()) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
    const host = url.hostname.toLowerCase()
    let id = ''
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) && url.pathname === '/watch') {
      const values = url.searchParams.getAll('v')
      if (values.length === 1) id = values[0]
    } else if (host === 'youtu.be' && /^\/[^/]+$/.test(url.pathname)) id = url.pathname.slice(1)
    else if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(host) && url.pathname.startsWith('/embed/')) id = url.pathname.slice(7)
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}

export function listeningTimestamp(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function listeningSourceKey(source: string): string {
  return source === 'video' ? 'listening.ui.sources.video' : source === 'library' ? 'listening.ui.sources.library' : 'listening.ui.sources.conversation'
}

export function documentWordCount(text: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: 'word' }) => { segment(value: string): Iterable<{ isWordLike?: boolean }> } }).Segmenter
  if (Segmenter) return [...new Segmenter('ja', { granularity: 'word' }).segment(text)].filter(item => item.isWordLike).length
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length
}
