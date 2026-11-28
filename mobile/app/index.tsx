import { Redirect } from 'expo-router'
import { useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../src/auth/AuthProvider'
import { api } from '../src/api/services'
import { createPlacementAPI } from '../src/api/placement'
import { createPlacementResume } from '../src/features/placement/resume'
import { Button, ErrorNotice, Loading, Screen } from '../src/components/ui'
import { getErrorMessage } from '../src/utils/getErrorMessage'

const placement = createPlacementAPI(api), resume = createPlacementResume(AsyncStorage)

export default function Index() {
  const { status, user } = useAuth(), { i18n } = useTranslation('placement')
  const [skipCheck, setSkipCheck] = useState(false)
  const startup = useQuery(['placement', 'startup', user?.id], async () => {
    const [current, saved] = await Promise.all([placement.status(), resume.read(user!.id)])
    return current.active_attempt_id ?? saved
  }, { enabled: status === 'authenticated' && !!user, staleTime: 0 })
  if (status !== 'authenticated') return <Redirect href="/(auth)/login" />
  if (skipCheck) return <Redirect href="/(tabs)/daily" />
  if (startup.isLoading) return <Loading />
  if (startup.isError) return <Screen><ErrorNotice message={getErrorMessage(startup.error, i18n)} retry={() => void startup.refetch()} /><Button secondary title={i18n.t('continue', { ns: 'placement' })} onPress={() => setSkipCheck(true)} /></Screen>
  return <Redirect href={startup.data ? { pathname: '/placement', params: { resume: String(startup.data) } } : '/(tabs)/daily'} />
}
