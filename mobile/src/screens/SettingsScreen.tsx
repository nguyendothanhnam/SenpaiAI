import { useRef, useState } from 'react'
import { Linking, View } from 'react-native'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthProvider'
import { personalAPI } from '../api/phase3'
import { queryClient } from '../api/services'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title, styles } from '../components/ui'
import { DangerDialog } from '../components/DangerDialog'
import { getErrorMessage } from '../utils/getErrorMessage'
export function SettingsScreen() {
  const { t, i18n } = useTranslation('settings'); const { t: common } = useTranslation('common'); const { t: mobile } = useTranslation('mobile')
  const { mode, setMode, error } = useTheme(); const { logout } = useAuth()
  const [action, setAction] = useState<'reset' | 'delete' | null>(null); const [busy, setBusy] = useState(false); const [failure, setFailure] = useState<unknown>(); const [notice, setNotice] = useState(false); const lock = useRef(false)
  async function confirm() {
    if (lock.current || !action) return
    lock.current = true; setBusy(true); setFailure(undefined)
    try {
      if (action === 'delete') { await personalAPI.remove(); await logout() }
      else { await personalAPI.reset(); await queryClient.cancelQueries(); queryClient.removeQueries({ predicate: q => ['chat-list', 'chat-messages', 'conversation', 'grammar-stats', 'grammar-patterns', 'personal-export'].includes(String(q.queryKey[0])) }); void queryClient.invalidateQueries(['profile']); setNotice(true) }
      setAction(null)
    } catch (e) { setAction(null); setFailure(e) } finally { lock.current = false; setBusy(false) }
  }
  return <Screen><Title>{i18n.t('settings', { ns: 'nav' })}</Title><Card><LanguageSwitcher /></Card><Card><AppText>{t('displayMode')}</AppText><View style={styles.row}>{(['light', 'dark', 'system'] as const).map(value => <Button key={value} title={common(value)} selected={mode === value} secondary={mode !== value} onPress={() => void setMode(value)} />)}</View>{error && <ErrorNotice message={mobile('preferenceError')} retry={() => void setMode(mode)} />}<Button secondary title={t('themeShop')} onPress={() => router.push('/theme-shop')} /></Card>
    <Card><Title>{mobile('phase3.about')}</Title><AppText>{mobile('phase3.appVersion', { version: Constants.expoConfig?.version || mobile('phase3.unknown') })}</AppText><Muted>{mobile('phase3.description')}</Muted><AppText selectable>{mobile('phase3.attribution')}</AppText>{[{ name: 'KanjiVG', url: 'https://kanjivg.tagaini.net' }, { name: 'KANJIDIC · EDRDG', url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' }, { name: 'Jonathan Waller · JLPT', url: 'https://www.tanos.co.uk/jlpt/' }].map(source => <Button secondary key={source.name} title={source.name} onPress={() => void Linking.openURL(source.url).catch(setFailure)} />)}</Card>
    <Card><Title>{common('dictionaryData.creditsTitle')}</Title><AppText>{common('dictionaryData.credits')}</AppText><Muted>{common('dictionaryData.communityLevels')}</Muted><Muted>{common('dictionaryData.englishFallback')}</Muted><Muted>{common('dictionaryData.automaticMeaning')}</Muted><Button secondary title={common('dictionaryData.sourceLink')} onPress={() => void Linking.openURL('https://github.com/evanclan/OpenJLPT').catch(setFailure)} /><Button secondary title={common('dictionaryData.licenseLink')} onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by-sa/4.0/').catch(setFailure)} /></Card>
    <Card><Title>{mobile('phase3.accountData')}</Title>{!!failure && <ErrorNotice message={getErrorMessage(failure, i18n)} />}{notice && <AppText accessibilityLiveRegion="polite">{mobile('phase3.resetDone')}</AppText>}<Button secondary title={mobile('phase3.exportData')} disabled={busy} onPress={() => router.push('/export-data')} /><Button secondary title={mobile('phase3.resetProgress')} disabled={busy} onPress={() => { setFailure(undefined); setAction('reset') }} /><Button secondary title={mobile('phase3.deleteAccount')} disabled={busy} onPress={() => { setFailure(undefined); setAction('delete') }} /></Card><Button title={i18n.t('signOut', { ns: 'nav' })} disabled={busy} onPress={() => void logout()} /><DangerDialog action={action} onClose={() => setAction(null)} onConfirm={() => void confirm()} busy={busy} /></Screen>
}
