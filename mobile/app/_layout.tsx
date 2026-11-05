import { useEffect } from 'react'
import { AppState } from 'react-native'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { QueryClientProvider, focusManager } from 'react-query'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { i18n } from '../src/i18n'
import { queryClient } from '../src/api/services'
import { AuthProvider, useAuth } from '../src/auth/AuthProvider'
import { LanguageProvider, useLanguage } from '../src/i18n/LanguageProvider'
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider'
import { AppErrorBoundary, ErrorScreen } from '../src/components/ErrorBoundary'
import { RuntimeGuard } from '../src/components/RuntimeGuard'
import { AppText, Button, Loading, Screen } from '../src/components/ui'
import { ConnectivityPanel } from '../src/components/ConnectivityPanel'

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <SafeAreaProvider><I18nextProvider i18n={i18n}><ThemeProvider><ErrorScreen retry={() => void retry()} /></ThemeProvider></I18nextProvider></SafeAreaProvider>
}

function Navigation() {
  const { status, retry, logout } = useAuth()
  const { ready: languageReady } = useLanguage()
  const { ready: themeReady, colors, resolvedMode } = useTheme()
  const { t } = useTranslation('mobile')
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active')
    const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'))
    return () => subscription.remove()
  }, [])
  if (!languageReady || !themeReady || status === 'loading') return <Loading />
  if (status === 'offline' || status === 'storage-error') return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <Screen><AppText>{t(status === 'offline' ? 'sessionOffline' : 'storageError')}</AppText><ConnectivityPanel details /><Button title={t('retry')} onPress={() => void retry()} /><Button secondary title={i18n.t('signOut', { ns: 'nav' })} onPress={() => void logout()} /></Screen>
  </SafeAreaView>
  return <>
    <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'anonymous'}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="daily-exercise" options={{ headerShown: true, title: i18n.t('daily.title'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="library-document/[id]" options={{ headerShown: true, title: i18n.t('library.documentDetail'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="library-editor" options={{ headerShown: true, title: i18n.t('library.documentDialog'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  </>
}

export default function RootLayout() {
  return <SafeAreaProvider><I18nextProvider i18n={i18n}><ThemeProvider><AppErrorBoundary><RuntimeGuard><QueryClientProvider client={queryClient}><AuthProvider><LanguageProvider><Navigation /></LanguageProvider></AuthProvider></QueryClientProvider></RuntimeGuard></AppErrorBoundary></ThemeProvider></I18nextProvider></SafeAreaProvider>
}
