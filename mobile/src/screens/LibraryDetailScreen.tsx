import { useState } from 'react'
import { Alert, FlatList, Linking, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { libraryAPI, queryClient } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { useLanguage } from '../i18n/LanguageProvider'
import { useTheme } from '../theme/ThemeProvider'
import { documentPermissions, safeHttpUrl, scopeLabelKey } from '../features/library/logic'
import { getErrorMessage } from '../utils/getErrorMessage'
import { formatTimestamp } from '../utils/date'
import { AppText, Badge, Button, Card, ErrorNotice, Loading, Muted, Screen, Title, styles } from '../components/ui'

export function LibraryDetailScreen() {
  const { id: parameter } = useLocalSearchParams<{ id: string }>()
  const id = Number(parameter)
  const { user } = useAuth()
  const { language } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const [sourceError, setSourceError] = useState(false)
  const query = useQuery(['library', user?.id, 'detail', id, language], () => libraryAPI.document(id, language), { enabled: !!user && Number.isInteger(id) && id > 0 })
  const removal = useMutation(async () => {
    const latest = await libraryAPI.document(id)
    if (!documentPermissions(latest).remove) throw new Error('permission-denied')
    await libraryAPI.remove(id)
  }, { retry: false, onSuccess: () => { void queryClient.invalidateQueries(['library', user?.id]); router.back() } })
  const document = query.data
  const deniedStatus = (query.error as { response?: { status?: number } })?.response?.status
  if (query.isLoading) return <Loading />
  if (query.isError && [401, 403, 404].includes(deniedStatus ?? 0)) return <Screen><ErrorNotice message={getErrorMessage(query.error, i18n)} retry={() => void query.refetch()} /></Screen>
  if (!document) return <Screen><ErrorNotice message={query.isError ? getErrorMessage(query.error, i18n) : mobile('phase1.library.missingDocument')} retry={() => void query.refetch()} /></Screen>
  const permissions = query.isError ? { edit: false, remove: false } : documentPermissions(document)
  const confirmDelete = () => Alert.alert(t('library.deleteConfirmation.title'), t('library.deleteConfirmation.message', { title: document.title }), [{ text: t('library.cancel'), style: 'cancel' }, { text: t('library.delete'), style: 'destructive', onPress: () => removal.mutate() }])
  return <View style={{ flex: 1, backgroundColor: colors.bg }}><FlatList
    data={[document.content]} keyExtractor={() => String(document.id)}
    contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 16 }}
    refreshing={query.isRefetching} onRefresh={() => void query.refetch()}
    ListHeaderComponent={<View style={{ gap: 14 }}><Title>{document.title}</Title><View style={styles.row}><Badge>{t(`library.documentTypes.${document.document_type}`, { defaultValue: document.document_type })}</Badge><Badge>{i18n.t(scopeLabelKey(document))}</Badge>{document.jlpt_level && <Badge>{document.jlpt_level}</Badge>}{document.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</View><Muted>{t('library.created', { date: formatTimestamp(document.created_at, language) })}</Muted>{document.updated_at && <Muted>{t('library.updated', { date: formatTimestamp(document.updated_at, language) })}</Muted>}
      {document.source_url && <Button secondary title={mobile('phase1.library.openSource')} onPress={() => { const url = document.source_url; if (!url || !safeHttpUrl(url)) { setSourceError(true); return } void Linking.openURL(url).catch(() => setSourceError(true)) }} />}
      {document.source_url && <AppText selectable style={{ fontSize: 13 }}>{document.source_url}</AppText>}
      {sourceError && <ErrorNotice message={mobile('phase1.library.sourceError')} />}
      {document.is_mine === undefined && <Muted>{mobile('phase1.library.permissionsUnavailable')}</Muted>}
      {permissions.edit && <Button title={t('library.edit')} disabled={removal.isLoading} onPress={() => router.push({ pathname: '/library-editor', params: { id: String(id) } })} />}
      {permissions.remove && <Button secondary title={t('library.delete')} disabled={removal.isLoading} onPress={confirmDelete} />}
      {removal.isError && <ErrorNotice message={mobile('phase1.library.deleteFailed')} retry={() => void query.refetch()} />}
      {query.isError && <ErrorNotice message={getErrorMessage(query.error, i18n)} retry={() => void query.refetch()} />}
    </View>}
    renderItem={({ item }) => <Card><AppText selectable style={{ lineHeight: 28 }}>{item}</AppText></Card>}
  /></View>
}
