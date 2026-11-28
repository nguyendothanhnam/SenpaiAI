export type ExportKind = 'json' | 'zip' | 'html'
export function exportDay(instant = new Date()) {
  return new Date(instant.getTime() + 7 * 3600000).toISOString().slice(0, 10)
}
export function exportPath(kind: ExportKind, language: string) {
  return kind === 'html' ? `/auth/me/export/report?language=${language.startsWith('en') ? 'en' : 'vi'}` : `/auth/me/export/download?format=${kind}`
}
export function exportHeaders(headers: Record<string, string>) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  let counts: Record<string, number> = {}
  try {
    const value: unknown = JSON.parse(normalized['x-export-summary'] || '{}')
    if (value && typeof value === 'object') counts = Object.fromEntries(Object.entries(value).filter(([, count]) => typeof count === 'number' && count >= 0))
  } catch { /* A report or older server may omit metadata. */ }
  return { counts, truncated: normalized['x-export-truncated'] === 'true' }
}
