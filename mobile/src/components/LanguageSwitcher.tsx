import { Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../i18n/LanguageProvider'
import { AppText, Button, ErrorNotice, styles } from './ui'
import { useTheme } from '../theme/ThemeProvider'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const { language, setLanguage, error, sync } = useLanguage()
  const { colors } = useTheme()
  if (compact) return <View style={{ gap: 8, alignItems: 'flex-end' }}>
    <View accessibilityLabel={t('language')} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 99, padding: 4 }}>
      <Ionicons name="globe-outline" size={18} color={colors.textMuted} style={{ marginHorizontal: 6 }} />
      {(['vi', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={t(value === 'vi' ? 'vietnamese' : 'english')} accessibilityState={{ selected: language === value }} onPress={() => void setLanguage(value)} style={{ borderRadius: 99, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', backgroundColor: language === value ? colors.accent : 'transparent' }}><AppText style={{ fontSize: 12, lineHeight: 18, fontWeight: '700', color: language === value ? colors.primary : colors.textMuted }}>{value.toUpperCase()}</AppText></Pressable>)}
    </View>
    {error && <ErrorNotice message={mobile(error)} retry={error === 'languageSyncFailed' ? () => void sync() : undefined} />}
  </View>
  return <View style={{ gap: 10 }}>
    <AppText>{t('language')}</AppText>
    <View style={styles.row}>
      {(['vi', 'en'] as const).map((value) => <Button key={value} title={t(value === 'vi' ? 'vietnamese' : 'english')} secondary={language !== value} selected={language === value} onPress={() => void setLanguage(value)} />)}
    </View>
    {error && <ErrorNotice message={mobile(error)} retry={error === 'languageSyncFailed' ? () => void sync() : undefined} />}
  </View>
}
