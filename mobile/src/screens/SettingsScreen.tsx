import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title, styles } from '../components/ui'
import { ConnectivityPanel } from '../components/ConnectivityPanel'

export function SettingsScreen() {
  const { t } = useTranslation('settings')
  const { t: common } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const { mode, setMode, error } = useTheme()
  return <Screen>
    <Title>{t('title')}</Title>
    <Card><LanguageSwitcher /></Card>
    <Card>
      <AppText>{t('displayMode')}</AppText>
      <View style={styles.row}>
        {(['light', 'dark', 'system'] as const).map((value) => <Button key={value} title={common(value)} selected={mode === value} secondary={mode !== value} onPress={() => void setMode(value)} />)}
      </View>
      {error && <ErrorNotice message={mobile('preferenceError')} retry={() => void setMode(mode)} />}
      <Muted>{mobile('classicOnly')}</Muted>
    </Card>
    <ConnectivityPanel details />
  </Screen>
}
