import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../../src/theme/ThemeProvider'

export default function PersonalLayout() {
  const { t } = useTranslation('nav')
  const { colors } = useTheme()
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Screen name="index" options={{ title: t('profile') }} />
    <Stack.Screen name="settings" options={{ title: t('settings') }} />
  </Stack>
}
