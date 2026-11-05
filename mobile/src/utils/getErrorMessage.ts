import type { i18n } from 'i18next'

// Mirrors frontend/src/utils/getErrorMessage.ts without importing its browser i18n singleton.
export function getErrorMessage(error: unknown, translator: i18n): string {
  const value = error as { code?: string; response?: { status?: number; data?: { detail?: unknown } } }
  const status = value?.response?.status
  const detail = value?.response?.data?.detail
  const detailCode = typeof detail === 'object' && detail !== null && 'code' in detail
    ? String((detail as { code: unknown }).code)
    : typeof detail === 'string' ? detail : undefined
  if (detailCode) {
    const known = translator.t(`details.${detailCode}`, { ns: 'errors', defaultValue: '' })
    if (known) return known
  }
  if (value?.code === 'ECONNABORTED' || value?.code === 'ETIMEDOUT') return translator.t('timeout', { ns: 'errors' })
  if (!value?.response) return translator.t('network', { ns: 'errors' })
  const key = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 409 ? 'conflict' : status === 429 ? 'rateLimited' : status === 408 ? 'timeout' : status === 400 || status === 422 ? 'badRequest' : status && status >= 500 ? 'server' : 'generic'
  return translator.t(key, { ns: 'errors' })
}
