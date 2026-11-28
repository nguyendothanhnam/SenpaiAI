import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title } from '../components/ui'
import { apiConfiguration } from '../config/env'
import { secureToken } from '../storage/secureToken'
import { exportDay, exportHeaders, exportPath, type ExportKind } from '../utils/personalExport'
import { studyStorageKey } from '../features/study/storage'
import { accountStorageKey } from '@games/stats'

export function ExportScreen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('mobile')
  const [kind, setKind] = useState<ExportKind>('json')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [progress, setProgress] = useState(0)
  const [file, setFile] = useState<{ uri: string; owner: number; size: number; counts: Record<string, number>; truncated: boolean; kind: ExportKind }>()
  const lock = useRef(false)
  const task = useRef<FileSystem.DownloadResumable | null>(null)
  const mounted = useRef(true)
  const account = useRef(user?.id)
  account.current = user?.id
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void task.current?.cancelAsync().catch(() => undefined) } }, [])
  useEffect(() => { setFile(undefined); setError(false) }, [user?.id])
  async function prepare() {
    if (lock.current || !user) return
    lock.current = true; setBusy(true); setError(false); setFile(undefined); setProgress(0)
    let uri = ''
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const token = await secureToken.get()
      if (!token || !FileSystem.cacheDirectory) throw new Error('unavailable')
      const directory = `${FileSystem.cacheDirectory}personal-export-${user.id}/`
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
      uri = `${directory}senpaiai-${exportDay()}-${Date.now()}.${kind}`
      task.current = FileSystem.createDownloadResumable(`${apiConfiguration.url}${exportPath(kind, i18n.language)}`, uri, { headers: { Authorization: `Bearer ${token}` } }, data => { if (mounted.current) setProgress(data.totalBytesWritten) })
      timeout = setTimeout(() => { void task.current?.cancelAsync().catch(() => undefined) }, 180000)
      const result = await task.current.downloadAsync()
      if (!result || result.status !== 200 || !mounted.current || account.current !== user.id || await secureToken.get() !== token) throw new Error('download')
      const info = await FileSystem.getInfoAsync(uri)
      if (!info.exists) throw new Error('file')
      setFile({ uri, owner: user.id, kind, size: info.size, ...exportHeaders(result.headers) })
    } catch {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
      if (mounted.current) setError(true)
    } finally { clearTimeout(timeout); task.current = null; lock.current = false; if (mounted.current) setBusy(false) }
  }
  async function share(uri: string, mimeType: string) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(false)
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('unavailable')
      if (!file || file.owner !== account.current) throw new Error('account')
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: t('phase3.exportData') })
    } catch { setError(true) } finally { lock.current = false; setBusy(false) }
  }
  async function local() {
    if (!user || lock.current || !FileSystem.cacheDirectory) return
    lock.current = true; setBusy(true); setError(false)
    try {
      const keys = [studyStorageKey(user.id), accountStorageKey(user.id), `${accountStorageKey(user.id)}:recipes`, `senpaiai.study.v1.consent.${user.id}`, `senpaiai.study.v1.ledger.${user.id}`]
      const entries = await AsyncStorage.multiGet(keys)
      const uri = `${FileSystem.cacheDirectory}senpaiai-device-${user.id}-${exportDay()}.json`
      await FileSystem.writeAsStringAsync(uri, JSON.stringify({ schema_version: 1, scope: 'device_only', export_date: new Date().toISOString(), data: Object.fromEntries(entries) }))
      const info = await FileSystem.getInfoAsync(uri)
      if (!info.exists || account.current !== user.id) throw new Error('file')
      setFile({ uri, owner: user.id, kind: 'json', size: info.size, counts: {}, truncated: false })
      if (!await Sharing.isAvailableAsync()) throw new Error('unavailable')
      if (account.current !== user.id) throw new Error('account')
      await Sharing.shareAsync(uri, { mimeType: 'application/json' })
    } catch { setError(true) } finally { lock.current = false; setBusy(false) }
  }
  return <Screen><Title>{t('phase3.exportData')}</Title><Muted>{t('personalExport.confirm')}</Muted>
    <Card>{(['json', 'zip', 'html'] as const).map(value => <Button key={value} secondary selected={kind === value} title={t(`personalExport.${value}`)} disabled={busy} onPress={() => setKind(value)} />)}</Card>
    <Muted>{t('personalExport.limits')}</Muted><Button title={t(busy ? 'personalExport.preparing' : 'personalExport.download')} disabled={busy} onPress={() => void prepare()} />
    {busy && <AppText accessibilityLiveRegion="polite">{t('personalExport.bytes', { count: progress })}</AppText>}
    {error && <ErrorNotice message={t('personalExport.error')} />}
    {file && file.owner === user?.id && <Card><AppText>{t('personalExport.bytes', { count: file.size })}</AppText>
      {Object.entries(file.counts).map(([name, count]) => <AppText key={name}>{t(`personalExport.tables.${name}`)}: {count}</AppText>)}
      {file.truncated && <AppText>{t('personalExport.truncated')}</AppText>}
      <Button title={t('personalExport.share')} disabled={busy} onPress={() => void share(file.uri, file.kind === 'zip' ? 'application/zip' : file.kind === 'html' ? 'text/html' : 'application/json')} />
    </Card>}
    <Muted>{t('personalExport.localHint')}</Muted><Button secondary title={t('personalExport.local')} disabled={busy} onPress={() => void local()} />
  </Screen>
}
