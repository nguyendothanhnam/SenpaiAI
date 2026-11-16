import type { PropsWithChildren } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { AppText, Button, Title } from './ui'
export function AppDialog({ visible, title, message, primaryLabel, onConfirm, onClose, hideCancel = false, reduced = false, children }: PropsWithChildren<{ visible: boolean; title: string; message: string; primaryLabel: string; onConfirm: () => void; onClose: () => void; hideCancel?: boolean; reduced?: boolean }>) {
  const { colors } = useTheme(), { t } = useTranslation('common')
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 18 }}>
      <Pressable accessibilityLabel={t('dialogs.close')} accessibilityRole="button" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={onClose} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 540, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 24, overflow: 'hidden' }}>
        <View style={{ height: 5, backgroundColor: colors.primary }} /><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}><View style={{ borderRadius: 16, padding: 12, backgroundColor: colors.accent }}><Feather name={hideCancel ? 'book-open' : 'help-circle'} size={26} color={colors.primary} /></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('dialogs.close')} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><Feather name="x" size={23} color={colors.textMuted} /></Pressable></View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}><Title>{title}</Title><AppText>{message}</AppText>{children}</ScrollView>
        <View style={{ padding: 18, gap: 10, borderTopWidth: 1, borderColor: colors.border }}><Button title={primaryLabel} onPress={onConfirm} />{!hideCancel && <Button secondary title={t('dialogs.stay')} onPress={onClose} />}</View>
      </View>
    </SafeAreaView>
  </Modal>
}
