import { useEffect, useState } from 'react'
import { Modal, View } from 'react-native'
import { KeyboardInput as TextInput, KeyboardLayout, KeyboardScrollView } from './KeyboardLayout'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { Button, Card, Title, styles } from './ui'
export function NameDialog({ title, value, limit, onClose, onSave }: { title: string; value: string | null; limit: number; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(value || ''); const { t } = useTranslation('mobile'); const { colors } = useTheme()
  useEffect(() => setName(value || ''), [value])
  return <Modal transparent visible={value !== null} animationType="fade" onRequestClose={onClose}><KeyboardLayout safeTop style={{ backgroundColor: colors.scrim }}><KeyboardScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}><Card><Title>{title}</Title><TextInput autoFocus value={name} onChangeText={setName} maxLength={limit} accessibilityLabel={title} style={[styles.field, { color: colors.text, borderColor: colors.border }]} /><View style={styles.row}><Button title={t('phase2.save')} disabled={!name.trim()} onPress={() => { onSave(name.trim()); onClose() }} /><Button secondary title={t('phase2.cancel')} onPress={onClose} /></View></Card></KeyboardScrollView></KeyboardLayout></Modal>
}
