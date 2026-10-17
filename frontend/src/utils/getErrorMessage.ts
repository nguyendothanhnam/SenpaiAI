import i18n from '../i18n'

export function getErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string; response?: { status?: number; data?: { detail?: unknown } } }
  const status = value?.response?.status
  const detail = value?.response?.data?.detail
  const detailCode = typeof detail === 'object' && detail !== null && 'code' in detail
    ? String((detail as { code: unknown }).code)
    : typeof detail === 'string' ? detail : undefined
  if (detailCode) {
    const known = i18n.t(`details.${detailCode}`, { ns: 'errors', defaultValue: '' })
    if (known) return known
  }
  if (value?.code === 'ECONNABORTED' || value?.code === 'ETIMEDOUT') return i18n.t('timeout', { ns: 'errors' })
  if (!value?.response) return i18n.t('network', { ns: 'errors' })
  const key = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 409 ? 'conflict' : status === 429 ? 'rateLimited' : status === 408 ? 'timeout' : status === 400 || status === 422 ? 'badRequest' : status && status >= 500 ? 'server' : 'generic'
  return i18n.t(key, { ns: 'errors' })
}
