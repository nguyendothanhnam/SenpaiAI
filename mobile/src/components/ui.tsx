import type { PropsWithChildren } from 'react'
import appIcon from '../../assets/icon.png'
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, Text, View, type TextProps, type ViewProps } from 'react-native'
import { KeyboardLayout, KeyboardScrollView } from './KeyboardLayout'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { readableText } from '../theme/nativeStyle'

export function AppText({ style, ...props }: TextProps) {
  const { colors } = useTheme()
  return <Text {...props} style={[{ color: colors.text, fontSize: 16, lineHeight: 24 }, style]} />
}

export function Title({ children }: PropsWithChildren) {
  return <AppText accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700', lineHeight: 34 }}>{children}</AppText>
}

export function Muted({ children }: PropsWithChildren) {
  const { colors } = useTheme()
  return <AppText style={{ color: colors.textMuted }}>{children}</AppText>
}

export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme()
  return <View {...props} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} />
}

export function Button({ title, onPress, disabled, secondary = false, selected = false }: {
  title: string
  onPress: () => void
  disabled?: boolean
  secondary?: boolean
  selected?: boolean
}) {
  const { colors } = useTheme()
  const background = secondary ? colors.accent : colors.primary
  const foreground = readableText(background, secondary ? colors.text : colors.primaryContrast, [colors.text, colors.primaryContrast, colors.bg])
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled, selected }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: pressed ? 0.9 : 1, backgroundColor: background, borderColor: selected ? colors.primary : colors.border }]}
  >
    <AppText style={{ color: foreground, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
  </Pressable>
}

export function Screen({ children, refreshing, onRefresh, pullToRefresh = false, scrollEnabled = true, solid = false }: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void; pullToRefresh?: boolean; scrollEnabled?: boolean; solid?: boolean }>) {
  const { colors } = useTheme()
  const { t } = useTranslation('mobile')
  return <KeyboardLayout style={{ backgroundColor: solid ? colors.bg : colors.screen }}>
    <KeyboardScrollView scrollEnabled={scrollEnabled} refreshControl={pullToRefresh && onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined} contentContainerStyle={styles.screen}>
      {children}
      {onRefresh && !pullToRefresh && <Button secondary title={t('refresh')} disabled={refreshing} onPress={onRefresh} />}
    </KeyboardScrollView>
  </KeyboardLayout>
}

export function Loading() {
  const { t } = useTranslation('mobile')
  const { colors } = useTheme()
  return <View accessibilityRole="progressbar" style={[styles.loading, { backgroundColor: colors.screen }]}><Image source={appIcon} accessibilityLabel="SenpaiAI" style={{ width: 88, height: 88, borderRadius: 22 }} /><AppText style={{ fontSize: 26, fontWeight: '800', lineHeight: 34, color: colors.primary }}>SenpaiAI</AppText><ActivityIndicator color={colors.primary} size="large" /><AppText>{t('loading')}</AppText></View>
}

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useTranslation('mobile')
  return <Card accessibilityLiveRegion="polite"><AppText accessibilityRole="alert">{message}</AppText>{retry && <Button secondary title={t('retry')} onPress={retry} />}</Card>
}

export function Badge({ children }: PropsWithChildren) {
  const { colors } = useTheme()
  return <View style={{ alignSelf: 'flex-start', borderRadius: 30, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4 }}><AppText style={{ color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 18 }}>{children}</AppText></View>
}

export function Progress({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme()
  const percentage = total > 0 ? Math.min(100, Math.max(0, current / total * 100)) : 0
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: current }} style={{ height: 9, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.accent }}><View style={{ height: 9, width: `${percentage}%`, backgroundColor: colors.primary, borderRadius: 9 }} /></View>
}

export const styles = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 40, gap: 18, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 12 },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
})
