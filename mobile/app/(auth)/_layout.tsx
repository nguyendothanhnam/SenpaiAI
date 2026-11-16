import { Stack } from 'expo-router'
import { useTheme } from '../../src/theme/ThemeProvider'

export default function AuthLayout() {
  const { colors } = useTheme()
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screen }, animation: 'fade' }}>
    <Stack.Screen name="login" />
    <Stack.Screen name="register" />
  </Stack>
}
