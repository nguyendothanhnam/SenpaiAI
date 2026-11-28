import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { api } from '../../api/services'
import { createPlacementAPI } from '../../api/placement'
import { useAuth } from '../../auth/AuthProvider'
import { AppText, Button, Card, ErrorNotice, Muted, Title } from '../ui'
import { getErrorMessage } from '../../utils/getErrorMessage'

const placement = createPlacementAPI(api)
export function PlacementProfile() {
  const { user } = useAuth(), { t, i18n } = useTranslation('placement')
  const summary = useQuery(['placement', 'summary', user?.id], placement.summary, { enabled: !!user })
  return <Card><Title>{t('profileTitle')}</Title>
    {summary.isLoading && <Muted>{t('loading')}</Muted>}
    {summary.isError && <ErrorNotice message={getErrorMessage(summary.error, i18n)} retry={() => void summary.refetch()} />}
    {summary.data && <><AppText>{summary.data.manual_level || summary.data.current_estimated_level || t('unassessed')}</AppText><Muted>{t('profileSource', { source: t(`sources.${summary.data.source}`) })}</Muted>{summary.data.last_assessed_at && <Muted>{t('lastAssessment', { date: new Date(summary.data.last_assessed_at).toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN') })}</Muted>}</>}
    <Button secondary title={t('profileRetake')} onPress={() => router.push('/placement')} />
  </Card>
}
