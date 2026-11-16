import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { LibraryDocument } from '../../api/types'
import { scopeLabelKey } from '../../features/library/logic'
import { formatTimestamp } from '../../utils/date'
import { useTheme } from '../../theme/ThemeProvider'
import { AppText, Badge, Card, Muted, styles } from '../ui'

export function DocumentCard({ document, onOpen }: { document: LibraryDocument; onOpen: () => void }) {
  const { t, i18n } = useTranslation('common')
  const { colors } = useTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={`${document.title}. ${t('library.viewDetail')}`} onPress={onOpen} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, marginBottom: 14 })}>
    <Card>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}><Ionicons name="document-text-outline" size={26} color={colors.primary} /><Badge>{i18n.t(scopeLabelKey(document))}</Badge></View>
      <AppText accessibilityRole="header" style={{ fontSize: 20, lineHeight: 28, fontWeight: '700' }}>{document.title}</AppText>
      <View style={styles.row}><Badge>{t(`library.documentTypes.${document.document_type}`, { defaultValue: document.document_type })}</Badge>{document.jlpt_level && <Badge>{document.jlpt_level}</Badge>}</View>
      <AppText numberOfLines={4} style={{ color: colors.textMuted }}>{document.content_preview || document.content}</AppText>
      <View style={styles.row}>{document.tags.slice(0, 4).map((tag) => <Badge key={tag}>{tag}</Badge>)}</View>
      <Muted>{formatTimestamp(document.created_at, i18n.language)}</Muted>
      <AppText style={{ color: colors.primary, fontWeight: '600' }}>{t('library.viewDetail')} →</AppText>
    </Card>
  </Pressable>
}
