import { KeyboardInput as TextInput, KeyboardFlatList as FlatList, KeyboardLayout } from '../components/KeyboardLayout'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { useInfiniteQuery, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { kanjiAPI } from '../api/phase3'
import { unique } from '../features/phase2/logic'
import { kanjiNextPage } from '../features/kanji/logic'
import { AppText, Badge, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { SkeletonList } from '../components/SkeletonList'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
export function KanjiScreen() {
  const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme();
  const [level, setLevel] = useState('N5'); const [text, setText] = useState(''); const [search, setSearch] = useState('')
  useEffect(() => { const timer = setTimeout(() => setSearch(text.trim()), 300); return () => clearTimeout(timer) }, [text])
  const levels = useQuery('kanji-levels', kanjiAPI.levels)
  const actual = levels.data?.find(l => l.level === level)?.level || levels.data?.[0]?.level
  const query = useInfiniteQuery(['kanji-list', actual, search], ({ pageParam = 0 }) => kanjiAPI.list(actual!, search, pageParam), { enabled: !!actual, getNextPageParam: kanjiNextPage })
  const items = unique((query.data?.pages.flatMap(p => p.items) || []).map(k => ({ ...k, id: k.kanji })))
  return <KeyboardLayout><FlatList style={{ backgroundColor: colors.screen }} contentContainerStyle={[styles.screen, { paddingBottom: 24 }]} data={items} keyExtractor={k => k.kanji} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { if (actual) void query.refetch(); void levels.refetch() }} onEndReachedThreshold={0.35} onEndReached={() => { if (query.hasNextPage && !query.isFetching) void query.fetchNextPage() }} ListHeaderComponent={<View style={{ gap: 14, marginBottom: 16 }}><Title>{t('phase3.kanji')}</Title><Button title={t('writing.recognize')} onPress={() => router.push('/kanji-write')} /><View style={styles.row}>{levels.data?.map(l => <Button key={l.level} title={`${l.level} · ${l.total}`} secondary={actual !== l.level} onPress={() => setLevel(l.level)} />)}</View><TextInput value={text} onChangeText={setText} placeholder={t('phase3.searchKanji')} accessibilityLabel={t('phase3.searchKanji')} placeholderTextColor={colors.textMuted} style={[styles.field, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} /><Button title={t('phase3.kanjiQuiz')} disabled={!actual} onPress={() => router.push({ pathname: '/kanji-quiz', params: { level: actual } })} /><Muted>{t('phase3.vietnameseMeanings')}</Muted>{(query.isError || levels.isError) && <ErrorNotice message={getErrorMessage(query.error || levels.error, i18n)} retry={() => { void levels.refetch(); if (actual) void query.refetch() }} />}</View>} ListEmptyComponent={levels.isLoading || (!!actual && query.isLoading) ? <SkeletonList /> : <Muted>{t('phase3.emptyKanji')}</Muted>} ListFooterComponent={query.isFetchingNextPage ? <SkeletonList count={1} /> : query.hasNextPage ? <Button secondary title={t('phase2.loadMore')} onPress={() => void query.fetchNextPage()} /> : undefined} renderItem={({ item }) => <Card style={{ marginBottom: 12 }}><AppText selectable style={{ fontSize: 54, lineHeight: 68, color: colors.primary, textAlign: 'center' }}>{item.kanji}</AppText><Badge>{item.jlpt}</Badge><AppText>{item.meaning_vi || item.meaning}</AppText><Muted>{t('phase3.strokeCount', { count: item.stroke_count || item.strokes })}</Muted><Button secondary title={t('phase3.details')} onPress={() => router.push({ pathname: '/kanji/[character]', params: { character: item.kanji } })} /></Card>} /></KeyboardLayout>
}
