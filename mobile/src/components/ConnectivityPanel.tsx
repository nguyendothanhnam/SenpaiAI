import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { apiConfiguration } from '../config/env'
import { checkBackend } from '../api/services'
import { AppText, Button, Card, Muted } from './ui'

export function ConnectivityPanel({ details = false }: { details?: boolean }) {
  const { t } = useTranslation('mobile')
  const { t: errors } = useTranslation('errors')
  const check = useQuery('backend-health', checkBackend, { retry: false, refetchInterval: 30000, enabled: apiConfiguration.valid })
  if (!details && apiConfiguration.valid && !check.isError) return null
  if (!details) return <Card accessibilityLiveRegion="polite">
    <AppText accessibilityRole="alert">{errors('network')}</AppText>
    <Button secondary disabled={check.isFetching || !apiConfiguration.valid} title={t('retry')} onPress={() => void check.refetch()} />
  </Card>
  return <Card>
    <AppText accessibilityRole="header" style={{ fontWeight: '600' }}>{t('connectionTitle')}</AppText>
    <AppText selectable style={{ fontSize: 13 }}>{apiConfiguration.url || 'EXPO_PUBLIC_API_URL'}</AppText>
    <AppText accessibilityLiveRegion="polite">{!apiConfiguration.valid ? t('configMissing') : check.isFetching ? t('connectionChecking') : check.isSuccess ? t('connectionOk') : t('connectionFailed')}</AppText>
    {(check.isError || !apiConfiguration.valid) && <Muted>{t('connectionHint')}</Muted>}
    <Button secondary disabled={check.isFetching || !apiConfiguration.valid} title={t('retry')} onPress={() => void check.refetch()} />
  </Card>
}
