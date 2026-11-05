import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../i18n/LanguageProvider'
import { AppText, Button, ErrorNotice, styles } from './ui'

export function LanguageSwitcher() {
  const { t } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const { language, setLanguage, error, sync } = useLanguage()
  return <View style={{ gap: 10 }}>
    <AppText>{t('language')}</AppText>
    <View style={styles.row}>
      {(['vi', 'en'] as const).map((value) => <Button key={value} title={t(value === 'vi' ? 'vietnamese' : 'english')} secondary={language !== value} selected={language === value} onPress={() => void setLanguage(value)} />)}
    </View>
    {error && <ErrorNotice message={mobile(error)} retry={error === 'languageSyncFailed' ? () => void sync() : undefined} />}
  </View>
}
