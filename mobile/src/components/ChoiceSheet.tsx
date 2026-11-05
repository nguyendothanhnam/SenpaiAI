import { FlatList, Modal, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { AppText, Button } from './ui'

export interface Choice { value: string; label: string; disabled?: boolean }
export function ChoiceSheet({ title, value, options, visible, onClose, onSelect }: {
  title: string; value: string; options: Choice[]; visible: boolean; onClose: () => void; onSelect: (value: string) => void
}) {
  const { colors } = useTheme()
  const { t } = useTranslation('mobile')
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000077' }}>
      <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={t('phase1.library.closePicker')} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', padding: 20 }} accessibilityViewIsModal>
        <AppText accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', marginBottom: 14 }}>{title}</AppText>
        <FlatList data={options} keyExtractor={(item) => item.value} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <View style={{ marginBottom: 8 }}><Button title={item.label} secondary={item.value !== value} selected={item.value === value} disabled={item.disabled} onPress={() => { onSelect(item.value); onClose() }} /></View>} />
        <Button secondary title={t('phase1.library.closePicker')} onPress={onClose} />
      </SafeAreaView>
    </View>
  </Modal>
}
