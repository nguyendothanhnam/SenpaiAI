import { Stack } from 'expo-router'
import { useTheme } from '../../src/theme/ThemeProvider'
import { useTranslation } from 'react-i18next'

export default function AuthLayout() {
  const { colors } = useTheme()
  const { t } = useTranslation('auth')
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Screen name="login" options={{ title: t('signInTab') }} />
    <Stack.Screen name="register" options={{ title: t('signUpTab') }} />
  </Stack>
}
