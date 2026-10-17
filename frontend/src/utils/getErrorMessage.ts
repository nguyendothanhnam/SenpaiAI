import i18n from '../i18n'

export function getErrorMessage(error: unknown): string {
  const value = error as { response?: { status?: number; data?: { detail?: unknown } } }
  const status = value?.response?.status
  const detail = value?.response?.data?.detail
  if (typeof detail === 'string') {
    const known = i18n.t(`details.${detail}`, { ns: 'errors', defaultValue: '' })
    if (known) return known
  }
  if (!value?.response) return i18n.t('network', { ns: 'errors' })
  const key = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 409 ? 'conflict' : status === 400 || status === 422 ? 'badRequest' : status && status >= 500 ? 'server' : 'generic'
  return i18n.t(key, { ns: 'errors' })
}
