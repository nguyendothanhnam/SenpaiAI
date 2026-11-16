import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { checkBackend, queryClient } from '../api/services'
import { apiConfiguration } from '../config/env'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Button } from './ui'
import { useTheme } from '../theme/ThemeProvider'
export function ConnectivityMonitor() {
  const { status, retry } = useAuth(); const { t } = useTranslation('mobile'); const { colors } = useTheme()
  const failed = useRef(false)
  const lastRestore = useRef(-Infinity)
  const health = useQuery('connection-monitor', checkBackend, { enabled: apiConfiguration.valid, retry: false, refetchInterval: 15000 })
  useEffect(() => {
    if (health.isError) failed.current = true
    if (health.isSuccess && failed.current) {
      failed.current = false
      void queryClient.invalidateQueries({ predicate: q => q.queryKey[0] !== 'connection-monitor' && q.queryKey[0] !== 'backend-health' })
    }
    if (health.isSuccess && status === 'offline' && performance.now() - lastRestore.current > 10000) {
      lastRestore.current = performance.now(); void retry()
    }
  }, [health.isError, health.isSuccess, health.dataUpdatedAt, retry, status])
  if (!health.isError || status === 'offline') return null
  return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.accent }}><View accessibilityLiveRegion="polite" style={{ padding: 12, gap: 6 }}><AppText>{t('phase3.connectionRetrying')}</AppText><Button secondary title={t('retry')} disabled={health.isFetching} onPress={() => void health.refetch()} /></View></SafeAreaView>
}
