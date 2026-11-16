import { useEffect, useState } from 'react'
import { Modal } from 'react-native'
import { KeyboardInput as TextInput, KeyboardLayout, KeyboardScrollView as ScrollView } from './KeyboardLayout'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { AppText, Button, Card, Title, styles } from './ui'
export function DangerDialog({ action, onClose, onConfirm, busy }: { action: 'reset' | 'delete' | null; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  const { t } = useTranslation('mobile'); const { colors } = useTheme(); const [text, setText] = useState('')
  useEffect(() => setText(''), [action])
  const keyword = t(action === 'delete' ? 'phase3.deleteKeyword' : 'phase3.resetKeyword')
  return <Modal transparent visible={!!action} onRequestClose={() => { if (!busy) { setText(''); onClose() } }} animationType="slide"><KeyboardLayout safeTop style={{ backgroundColor: colors.scrim }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}><Card><Title>{t(action === 'delete' ? 'phase3.deleteAccount' : 'phase3.resetProgress')}</Title><AppText>{t(action === 'delete' ? 'phase3.deleteWarning' : 'phase3.resetWarning')}</AppText><AppText>{t('phase3.confirmKeyword', { keyword })}</AppText><TextInput value={text} onChangeText={setText} editable={!busy} autoCapitalize="characters" accessibilityLabel={t('phase3.confirmKeyword', { keyword })} style={[styles.field, { color: colors.text, borderColor: colors.border }]} /><Button title={t('phase3.confirmAction')} disabled={busy || text.trim() !== keyword} onPress={onConfirm} /><Button secondary title={t('phase2.cancel')} disabled={busy} onPress={() => { setText(''); onClose() }} /></Card></ScrollView></KeyboardLayout></Modal>
}
