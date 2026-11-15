import { StudyError, asRecord } from './validation'
export interface ImportIssue { key: string; values?: Record<string, string | number>; raw?: string }
export function importIssues(error: unknown): ImportIssue[] {
  if (error instanceof StudyError) return [{ key: error.key, values: error.values }]
  const value = asRecord(error), response = asRecord(value.response)
  if (value.code === 'ERR_CANCELED') return [{ key: 'cancelled' }]
  if (value.code === 'ECONNABORTED' || value.code === 'ETIMEDOUT') return [{ key: 'timeout' }]
  if (response.status === 401) return [{ key: 'unauthorized' }]
  if (response.status === 413) return [{ key: 'fileTooLarge', values: { count: 5 } }]
  const detail = asRecord(response.data).detail
  if (typeof detail === 'string' && detail.trim()) {
    // Preserve authoritative server line numbers, including the header row.
    const clean = detail.replace(/^Invalid (?:file format|flashcard file):\s*/i, '')
    return clean.split(/;\s*(?=Row\s+\d+:)/i).slice(0, 500).map(raw => ({ key: 'serverDetail', raw }))
  }
  if (Array.isArray(detail)) return detail.slice(0, 500).map(item => ({ key: 'serverDetail', raw: String(asRecord(item).msg || '422') }))
  if (typeof response.status === 'number') return [{ key: 'httpError', values: { status: response.status } }]
  return [{ key: 'networkError' }]
}
