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
    const phase2: Record<string, string> = {
      'Không có câu hỏi phù hợp ở cấp độ và dạng đã chọn.': 'noQuestions',
      'Question already answered in this session': 'alreadyAnswered',
      'Session is already finished': 'sessionFinished',
      'Grammar practice session not found': 'sessionMissing',
      'Grammar pattern not found': 'patternMissing',
      conversation_not_found: 'conversationMissing',
      chat_folder_not_found: 'folderMissing',
      chat_folder_limit_reached: 'folderLimit',
      folder_name_required: 'nameRequired',
      conversation_title_required: 'nameRequired',
      folder_name_too_long: 'nameTooLong',
      conversation_title_too_long: 'nameTooLong',
      conversation_mode_mismatch: 'voiceReadOnly',
    }
    if (detailCode === 'mobile_no_quiz_questions') return translator.t('phase3.noQuizQuestions', { ns: 'mobile' })
    if (phase2[detailCode]) return translator.t(`phase2.${phase2[detailCode]}`, { ns: 'mobile' })
  }
  if (value?.code === 'ECONNABORTED' || value?.code === 'ETIMEDOUT') return translator.t('timeout', { ns: 'errors' })
  if (!value?.response) return translator.t('network', { ns: 'errors' })
  const key = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 409 ? 'conflict' : status === 429 ? 'rateLimited' : status === 408 ? 'timeout' : status === 400 || status === 422 ? 'badRequest' : status && status >= 500 ? 'server' : 'generic'
  return translator.t(key, { ns: 'errors' })
}
