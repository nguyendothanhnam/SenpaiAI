import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { Card } from './ui'
export function SkeletonList({ count = 3 }: { count?: number }) {
  const { colors } = useTheme(); const { t } = useTranslation('mobile')
  return <View accessibilityRole="progressbar" accessibilityLabel={t('loading')} style={{ gap: 12 }}>{Array.from({ length: count }, (_, i) => <Card key={i}><View style={{ height: 22, width: '55%', borderRadius: 6, backgroundColor: colors.accent }} /><View style={{ height: 14, width: '90%', borderRadius: 5, backgroundColor: colors.bgElevated }} /><View style={{ height: 14, width: '70%', borderRadius: 5, backgroundColor: colors.bgElevated }} /></Card>)}</View>
}
