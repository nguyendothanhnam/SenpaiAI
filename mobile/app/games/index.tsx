import Ionicons from '@expo/vector-icons/Ionicons'
import { Stack, router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { setToolsButtonVisible } from 'expo-dev-client'
import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../src/theme/ThemeProvider'
import { MiniGamesScreen } from '../../src/screens/MiniGamesScreen'

export default function GamesRoute() {
  const { colors } = useTheme()
  const { t } = useTranslation('nav')
  useFocusEffect(useCallback(() => {
    if (!__DEV__) return
    const toolsVisible = (visible: boolean) => {
      try { void Promise.resolve(setToolsButtonVisible(visible)).catch(() => undefined) }
      catch { /* Older Expo Go/dev builds may not expose the SDK 58 tools API. */ }
    }
    toolsVisible(false)
    return () => toolsVisible(true)
  }, []))
  return <>
    <Stack.Screen options={{
      headerBackButtonDisplayMode: 'minimal',
      headerTitleStyle: { fontSize: 17, fontWeight: '700' },
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} onPress={() => router.push('/(tabs)/personal/settings')} style={({ pressed }) => ({ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Ionicons name="settings-outline" size={23} color={colors.primary} />
      </Pressable>,
    }} />
    <MiniGamesScreen />
  </>
}
