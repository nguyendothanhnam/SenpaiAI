import { FlatList, Share, View } from 'react-native'
import { useState } from 'react'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { personalAPI } from '../api/phase3'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { SkeletonList } from '../components/SkeletonList'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
export function ExportScreen() {
  const { user } = useAuth(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme(); const [shareError, setShareError] = useState(false)
  const query = useQuery(['personal-export', user?.id], personalAPI.export, { cacheTime: 0, retry: false })
  const json = query.data ? JSON.stringify(query.data, null, 2) : ''
  const parts = json.match(/[\s\S]{1,4000}/g) || []
  return <FlatList style={{ backgroundColor: colors.screen }} contentContainerStyle={styles.screen} data={parts} keyExtractor={(_, n) => String(n)} ListHeaderComponent={<View style={{ gap: 14 }}><Title>{t('phase3.exportData')}</Title><Muted>{t('phase3.exportHint')}</Muted>{query.isError && <ErrorNotice message={getErrorMessage(query.error, i18n)} retry={() => void query.refetch()} />}{query.isLoading && <SkeletonList />}{shareError && <ErrorNotice message={t('phase3.shareError')} />}<Button title={t('phase3.shareJson')} disabled={!json} onPress={() => { setShareError(false); void Share.share({ message: json, title: 'SenpaiAI.json' }).catch(() => setShareError(true)) }} /></View>} renderItem={({ item, index }) => <Card style={{ marginTop: 12 }}><Muted>{t('phase3.exportPart', { index: index + 1, total: parts.length })}</Muted><AppText selectable style={{ fontSize: 12, lineHeight: 19 }}>{item}</AppText></Card>} />
}
