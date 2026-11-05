import { Tabs } from 'expo-router/js-tabs'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../src/theme/ThemeProvider'

export const unstable_settings = { initialRouteName: 'daily' }

export default function TabLayout() {
  const { t } = useTranslation('nav')
  const { t: mobile } = useTranslation('mobile')
  const { colors } = useTheme()
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text,
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
    tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted,
    sceneStyle: { backgroundColor: colors.bg },
  }}>
    <Tabs.Screen name="daily" options={{ title: t('daily'), tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={typeof color === 'string' ? color : colors.primary} size={size} /> }} />
    <Tabs.Screen name="chat" options={{ title: t('chat'), tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={typeof color === 'string' ? color : colors.primary} size={size} /> }} />
    <Tabs.Screen name="library" options={{ title: t('library'), tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={typeof color === 'string' ? color : colors.primary} size={size} /> }} />
    <Tabs.Screen name="practice" options={{ title: mobile('practice'), tabBarIcon: ({ color, size }) => <Ionicons name="school-outline" color={typeof color === 'string' ? color : colors.primary} size={size} /> }} />
    <Tabs.Screen name="personal" options={{ title: mobile('personal'), headerShown: false, tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={typeof color === 'string' ? color : colors.primary} size={size} /> }} />
  </Tabs>
}
