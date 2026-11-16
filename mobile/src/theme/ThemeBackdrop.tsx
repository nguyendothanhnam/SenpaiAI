import type { PropsWithChildren } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import { gradientColors } from './nativeStyle'
import { useTheme } from './ThemeProvider'

/** The single backdrop is behind navigation; opaque cards keep text legible. */
export function ThemeBackdrop({ children }: PropsWithChildren) {
  const { colors, backgroundImage, resolvedMode } = useTheme()
  const base = resolvedMode === 'dark' ? DarkTheme : DefaultTheme
  const navigationTheme = { ...base, colors: { ...base.colors, background: colors.screen, card: colors.card, primary: colors.primary, text: colors.text, border: colors.border, notification: colors.primary } }
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <LinearGradient pointerEvents="none" colors={gradientColors(colors.bgImage, colors.bg)} style={StyleSheet.absoluteFill} />
    {backgroundImage && <><Image pointerEvents="none" source={backgroundImage} resizeMode="cover" style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.imageOverlay }]} /></>}
    <NavigationThemeProvider value={navigationTheme}><View style={{ flex: 1 }}>{children}</View></NavigationThemeProvider>
  </View>
}
