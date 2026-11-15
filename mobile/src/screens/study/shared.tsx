import { KeyboardInput as TextInput, KeyboardFlatList as FlatList, KeyboardLayout } from '../../components/KeyboardLayout'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Alert, View, type ListRenderItem } from 'react-native'
import { usePreventRemove } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AppText, Button, Card, Muted, styles } from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import { useAuth } from '../../auth/AuthProvider'
import { importIssues } from '../../features/study/importErrors'
import { studyStore, useStudy } from '../../features/study/useStudy'

export function StudyList<T>({ data, renderItem, header, footer, refreshing = false, onRefresh, keyExtractor, solid = false }: { data: T[]; renderItem: ListRenderItem<T>; header: ReactElement; footer?: ReactElement; refreshing?: boolean; onRefresh?: () => void; keyExtractor?: (item: T, index: number) => string; solid?: boolean }) {
  const { colors } = useTheme()
  return <KeyboardLayout style={{ flex: 1, backgroundColor: solid ? colors.bg : colors.screen }}>
    <FlatList data={data} renderItem={renderItem} keyExtractor={keyExtractor || ((_, i) => String(i))} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" removeClippedSubviews={false} contentContainerStyle={[styles.screen, { paddingBottom: 40 }]} ListHeaderComponent={header} ListFooterComponent={footer} refreshing={refreshing} onRefresh={onRefresh} />
  </KeyboardLayout>
}
export function Field({ label, value, onChange, multiline = false, limit = 10000, disabled = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; limit?: number; disabled?: boolean }) {
  const { colors } = useTheme()
  return <View style={{ gap: 5 }}><AppText>{label}</AppText><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} maxLength={limit} multiline={multiline} autoCorrect={false} textAlignVertical="top" style={[styles.field, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgElevated }, multiline ? { minHeight: 90, maxHeight: 220 } : {}]} /></View>
}
export function Issues({ error }: { error: unknown }) {
  const { t } = useTranslation('mobile')
  if (!error) return null
  return <Card accessibilityLiveRegion="polite">{importIssues(error).map((issue, index) => <AppText selectable accessibilityRole="alert" key={index}>{issue.raw || t(`phase4.${issue.key}`, issue.values || {})}</AppText>)}</Card>
}
export function useWork() {
  const lock = useRef(false), alive = useRef(true)
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>()
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function run(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(undefined)
    try { await work() } catch (error) { if (alive.current) setError(error) }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return { busy, error, setError, run }
}
export function useLeaveGuard(enabled: boolean, busy = false) {
  const { t } = useTranslation('mobile')
  const { status } = useAuth()
  return usePreventRemove(status === 'authenticated' && (enabled || busy), ({ repeat }) => {
    if (busy) { Alert.alert(t('phase4.working')); return }
    Alert.alert(t('phase4.leaveTitle'), t('phase4.leaveMessage'), [{ text: t('phase4.cancel'), style: 'cancel' }, { text: t('phase4.leave'), style: 'destructive', onPress: repeat }])
  })
}
export function StorageNotice({ library }: { library: ReturnType<typeof useStudy> }) {
  const { t } = useTranslation('mobile'), work = useWork()
  const warning = library.query.data?.warning
  return <View style={{ gap: 10 }}><Muted>{t('phase4.localNotice')}</Muted>{warning && <Card><AppText>{t(`phase4.${warning}`)}</AppText><Button secondary title={t('retry')} disabled={work.busy} onPress={() => void library.query.refetch()} />{warning === 'storageCorrupt' && <Button secondary title={t('phase4.resetLocal')} disabled={work.busy} onPress={() => Alert.alert(t('phase4.resetLocal'), t('phase4.resetConfirm'), [{ text: t('phase4.cancel'), style: 'cancel' }, { text: t('phase4.delete'), style: 'destructive', onPress: () => void work.run(async () => { await studyStore.reset(library.account!); await library.refresh() }) }])} />}</Card>}<Issues error={work.error} /></View>
}
