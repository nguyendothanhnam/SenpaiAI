import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useNotifications } from '../features/reminders/NotificationProvider'
import { useTheme } from '../theme/ThemeProvider'
import { AppText } from './ui'

export function NotificationBell() {
  const { count, countError } = useNotifications()
  const { t } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const { colors } = useTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={countError ? mobile('reminders.countError') : t('notifications.unread', { count })} onPress={() => router.push('/notifications')} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
    <Ionicons name="notifications-outline" size={24} color={colors.text} />
    {(count > 0 || countError) && <View style={{ position: 'absolute', right: 0, top: 0, minWidth: 20, borderRadius: 12, paddingHorizontal: 4, backgroundColor: colors.primary }}><AppText style={{ color: colors.primaryContrast, fontSize: 12, lineHeight: 20, textAlign: 'center' }}>{countError ? mobile('reminders.badgeError') : count > 99 ? mobile('reminders.badgeMax') : count}</AppText></View>}
  </Pressable>
}
