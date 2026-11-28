import { FlatList, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { kanjiAPI } from '../api/phase3'
import { SkeletonList } from '../components/SkeletonList'
import { AppText, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
export function KanjiDetailScreen() {
  const { character } = useLocalSearchParams<{ character: string }>(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme(); const insets = useSafeAreaInsets()
  const detail = useQuery(['kanji-detail', character], () => kanjiAPI.detail(character))
  const current = detail.data
  return <FlatList style={{ backgroundColor: colors.screen }} contentContainerStyle={[styles.screen, { paddingBottom: insets.bottom + 24 }]} data={current?.examples || []} keyExtractor={(e, n) => `${n}:${e.word}`} ListHeaderComponent={<View style={{ gap: 18 }}>
    {detail.isLoading && <SkeletonList />}{detail.isError && <ErrorNotice message={getErrorMessage(detail.error, i18n)} retry={() => void detail.refetch()} />}
    {current && <Card><AppText selectable style={{ fontSize: 84, lineHeight: 100, textAlign: 'center', color: colors.primary }}>{current.kanji}</AppText><Title>{current.meaning_vi || current.meaning}</Title><Muted>{current.jlpt} · {t('phase3.strokeCount', { count: current.stroke_count || current.strokes })}</Muted><AppText selectable>{t('phase3.onReading')}: {current.onyomi.join('、')}</AppText><AppText selectable>{t('phase3.kunReading')}: {current.kunyomi.join('、')}</AppText></Card>}
    <Button title={t('writing.practice')} onPress={() => router.push({ pathname: '/kanji-write', params: { character } })} /><Title>{t('phase3.examples')}</Title>
  </View>} renderItem={({ item }) => <Card style={{ marginTop: 10 }}><AppText selectable>{item.word}</AppText><AppText selectable>{item.reading}</AppText><Muted>{item.meaning}</Muted></Card>} />
}
