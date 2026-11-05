import type { PropsWithChildren } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type TextProps, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'

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
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled, selected }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.5 : pressed ? 0.75 : 1, backgroundColor: secondary ? colors.accent : colors.primary, borderColor: selected ? colors.primary : colors.border }]}
  >
    <AppText style={{ color: secondary ? colors.text : colors.primaryContrast, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
  </Pressable>
}

export function Screen({ children, refreshing, onRefresh, pullToRefresh = false }: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void; pullToRefresh?: boolean }>) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('mobile')
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={pullToRefresh && onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined} contentContainerStyle={[styles.screen, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
      {children}
      {onRefresh && !pullToRefresh && <Button secondary title={t('refresh')} disabled={refreshing} onPress={onRefresh} />}
    </ScrollView>
  </KeyboardAvoidingView>
}

export function Loading() {
  const { t } = useTranslation('mobile')
  const { colors } = useTheme()
  return <View accessibilityRole="progressbar" style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} size="large" /><AppText>{t('loading')}</AppText></View>
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
