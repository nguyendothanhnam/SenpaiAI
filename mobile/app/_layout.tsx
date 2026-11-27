import { ThemeBackdrop } from '../src/theme/ThemeBackdrop'
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
import { ConnectivityMonitor } from '../src/components/ConnectivityMonitor'
import { AccountThemeBridge } from '../src/components/AccountThemeBridge'
import { NotificationProvider } from '../src/features/reminders/NotificationProvider'
import { LocalReminderProvider } from '../src/features/reminders/LocalReminderProvider'
import { KanjiLookupProvider } from '../src/components/KanjiLookup'

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <SafeAreaProvider><I18nextProvider i18n={i18n}><ThemeProvider><ThemeBackdrop><ErrorScreen retry={() => void retry()} /></ThemeBackdrop></ThemeProvider></I18nextProvider></SafeAreaProvider>
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
  if (status === 'offline' || status === 'storage-error') return <SafeAreaView style={{ flex: 1, backgroundColor: colors.screen }}>
    <Screen><AppText>{t(status === 'offline' ? 'sessionOffline' : 'storageError')}</AppText><ConnectivityPanel details /><Button title={t('retry')} onPress={() => void retry()} /><Button secondary title={i18n.t('signOut', { ns: 'nav' })} onPress={() => void logout()} /></Screen>
  </SafeAreaView>
  return <>
    <AccountThemeBridge />
    <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screen } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'anonymous'}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(tabs)" />
        {['notifications', 'reminder-settings'].map(name => <Stack.Screen key={name} name={name} options={{ headerShown: true, title: name === 'notifications' ? i18n.t('notifications.title') : t('reminders.title'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />)}
        {['games/index', 'games/[game]'].map(name => <Stack.Screen key={name} name={name} options={{ headerShown: true, title: i18n.t('minigames.title'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />)}
        {['study/index', 'study/quiz', 'study/flashcard', 'study/editor', 'study/import', 'study/quiz-play', 'study/flashcard-play', 'study/flashcard-detail', 'study/flashcard-editor', 'study/flashcard-learn', 'study/flashcard-test', 'study/flashcard-stats'].map(name => <Stack.Screen key={name} name={name} options={{ headerShown: true, title: t('phase4.hub'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />)}
        {['kanji', 'kanji/[character]', 'kanji-quiz', 'kanji-write', 'theme-shop', 'export-data'].map(name => <Stack.Screen key={name} name={name} options={{ headerShown: true, title: t(name.startsWith('kanji') ? 'phase3.kanji' : name === 'theme-shop' ? 'phase3.themeShop' : 'phase3.exportData'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />)}
        {['grammar', 'grammar-progress', 'chat-folders', 'conversation/[id]'].map(name => <Stack.Screen key={name} name={name} options={{ headerShown: true, title: t(name === 'grammar' ? 'phase2.grammar' : name === 'grammar-progress' ? 'phase2.progress' : name === 'chat-folders' ? 'phase2.manageFolders' : 'phase2.conversation'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />)}
        <Stack.Screen name="daily-exercise" options={{ headerShown: true, title: i18n.t('daily.title'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="library-document/[id]" options={{ headerShown: true, title: i18n.t('library.documentDetail'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="library-editor" options={{ headerShown: true, title: i18n.t('library.documentDialog'), headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  </>
}

export default function RootLayout() {
  return <SafeAreaProvider><I18nextProvider i18n={i18n}><ThemeProvider><ThemeBackdrop><AppErrorBoundary><RuntimeGuard><QueryClientProvider client={queryClient}><AuthProvider><LanguageProvider><NotificationProvider><LocalReminderProvider><KanjiLookupProvider><ConnectivityMonitor /><Navigation /></KanjiLookupProvider></LocalReminderProvider></NotificationProvider></LanguageProvider></AuthProvider></QueryClientProvider></RuntimeGuard></AppErrorBoundary></ThemeBackdrop></ThemeProvider></I18nextProvider></SafeAreaProvider>
}
