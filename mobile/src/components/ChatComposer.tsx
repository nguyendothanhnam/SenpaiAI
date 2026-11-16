import { useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { composerHeight } from '../features/keyboard/geometry'
import { useTheme } from '../theme/ThemeProvider'
import { KeyboardInput, useKeyboardLayout } from './KeyboardLayout'
import { styles } from './ui'

export function ChatComposer({ text, onChange, busy, uncertain, sendDisabled, onSend, onFocus }: { text: string; onChange: (text: string) => void; busy: boolean; uncertain: boolean; sendDisabled: boolean; onSend: () => void; onFocus: () => void }) {
  const { t } = useTranslation('mobile'), { colors } = useTheme(), layout = useKeyboardLayout()
  const [contentHeight, setContentHeight] = useState(48)
  const size = composerHeight(text ? contentHeight : 48, layout.availableHeight)
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexShrink: 0, gap: 8, padding: 12, paddingBottom: layout.visible ? 8 : Math.max(layout.bottomInset, 8), backgroundColor: colors.bg }}>
    <KeyboardInput ensureVisible={false} multiline value={text} onChangeText={onChange} editable={!busy && !uncertain} onFocus={onFocus} onContentSizeChange={event => setContentHeight(event.nativeEvent.contentSize.height)} scrollEnabled={size.scroll} textAlignVertical="top" placeholder={t('phase2.messagePlaceholder')} accessibilityLabel={t('phase2.messagePlaceholder')} placeholderTextColor={colors.textMuted} style={[styles.field, { flex: 1, minWidth: 0, height: size.height, lineHeight: 24, color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
    <Pressable accessibilityRole="button" accessibilityLabel={t(busy ? 'phase2.replying' : 'phase2.send')} accessibilityState={{ disabled: sendDisabled, busy }} disabled={sendDisabled} onPress={onSend} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: sendDisabled ? .45 : pressed ? .75 : 1 })}>
      {busy ? <ActivityIndicator color={colors.primaryContrast} /> : <Ionicons name="arrow-up" size={24} color={colors.primaryContrast} />}
    </Pressable>
  </View>
}
