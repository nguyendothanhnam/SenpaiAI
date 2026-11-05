import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useInfiniteQuery, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { libraryAPI } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { useLanguage } from '../i18n/LanguageProvider'
import { useTheme } from '../theme/ThemeProvider'
import { DOCUMENT_TYPES, JLPT_LEVELS, nextPageOffset, uniqueDocuments } from '../features/library/logic'
import type { DocumentScope, LibraryPage } from '../api/types'
import { getErrorMessage } from '../utils/getErrorMessage'
import { AppText, Badge, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { DocumentCard } from '../components/library/DocumentCard'

export function LibraryScreen() {
  const { user } = useAuth()
  const { language } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [level, setLevel] = useState('')
  const [scope, setScope] = useState<DocumentScope>('all')
  const [picker, setPicker] = useState<'type' | 'level' | 'scope' | null>(null)
  useEffect(() => { const timer = setTimeout(() => setQuery(text.trim()), 350); return () => clearTimeout(timer) }, [text])
  const filters = { query, document_type: type, jlpt_level: level, scope, language }
  const documents = useInfiniteQuery(['library', user?.id, 'documents', filters], ({ pageParam = 0 }) => libraryAPI.list(filters, Number(pageParam)), { enabled: !!user, getNextPageParam: (page: LibraryPage) => nextPageOffset(page) })
  const stats = useQuery(['library', user?.id, 'stats'], libraryAPI.stats, { enabled: !!user })
  const categories = useQuery(['library', user?.id, 'categories'], libraryAPI.categories, { enabled: !!user })
  const items = uniqueDocuments(documents.data?.pages ?? [])
  const hasScope = items.length > 0 && items.every((item) => item.scope === 'system' || item.scope === 'personal')
  const refresh = () => { void documents.refetch(); void stats.refetch(); void categories.refetch() }
  const typeOptions = [{ value: '', label: t('library.allTypes') }, ...(categories.data?.document_types ?? DOCUMENT_TYPES).map((value) => ({ value, label: t(`library.documentTypes.${value}`, { defaultValue: value }) }))]
  const levelOptions = [{ value: '', label: t('library.allLevels') }, ...(categories.data?.jlpt_levels ?? JLPT_LEVELS).map((value) => ({ value, label: value }))]
  const scopeOptions = (['all', 'mine', 'system'] as const).map((value) => ({ value, label: t(`library.scope.${value}`), disabled: value !== 'all' && !hasScope }))
  const pickerTitle = t(picker === 'type' ? 'library.fields.documentType' : picker === 'level' ? 'library.fields.jlptLevel' : 'library.scope.label')
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <FlatList
      data={items} keyExtractor={(item) => String(item.id)} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, maxWidth: 720, width: '100%', alignSelf: 'center', flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={documents.isRefetching || stats.isRefetching} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 18 }}>
        <Title>{t('library.pageTitle')}</Title><Muted>{t('library.pageSubtitle')}</Muted>
        <View style={styles.row}>{stats.data && <><Badge>{t('library.stats.totalDocuments')}: {stats.data.total_documents}</Badge><Badge>{t('library.stats.vectorChunks')}: {stats.data.vector_chunks}</Badge></>}</View>
        {stats.isError && <ErrorNotice message={getErrorMessage(stats.error, i18n)} retry={() => void stats.refetch()} />}
        <Button title={t('library.addNewDocument')} onPress={() => router.push('/library-editor')} />
        <TextInput accessibilityLabel={t('library.search')} placeholder={t('library.searchPlaceholder')} placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} returnKeyType="search" autoCorrect={false} style={[styles.field, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
        <View style={styles.row}><Button secondary title={type ? t(`library.documentTypes.${type}`, { defaultValue: type }) : t('library.allTypes')} onPress={() => setPicker('type')} /><Button secondary title={level || t('library.allLevels')} onPress={() => setPicker('level')} /><Button secondary title={t(`library.scope.${scope}`)} onPress={() => setPicker('scope')} /></View>
        {(text || type || level || scope !== 'all') && <Button secondary title={mobile('phase1.library.clearFilters')} onPress={() => { setText(''); setQuery(''); setType(''); setLevel(''); setScope('all') }} />}
        {!hasScope && !documents.isLoading && <Muted>{mobile('phase1.library.scopeUnavailable')}</Muted>}
        {categories.isError && <ErrorNotice message={getErrorMessage(categories.error, i18n)} retry={() => void categories.refetch()} />}
        {documents.isError && <ErrorNotice message={getErrorMessage(documents.error, i18n)} retry={() => void documents.refetch()} />}
      </View>}
      renderItem={({ item }) => <DocumentCard document={item} onOpen={() => router.push({ pathname: '/library-document/[id]', params: { id: String(item.id) } })} />}
      ListEmptyComponent={<Card><AppText>{t(documents.isLoading ? 'library.fetching' : 'library.noDocuments')}</AppText>{!documents.isLoading && <Muted>{t('library.emptyHint')}</Muted>}</Card>}
      ListFooterComponent={items.length ? <View style={{ gap: 12, paddingVertical: 16 }}>
        {documents.isError && <ErrorNotice message={getErrorMessage(documents.error, i18n)} />}
        {documents.hasNextPage ? <Button secondary disabled={documents.isFetching} title={mobile(documents.isFetchingNextPage ? 'phase1.library.loadingMore' : 'phase1.library.loadMore')} onPress={() => void documents.fetchNextPage()} /> : <Muted>{mobile('phase1.library.endOfList')}</Muted>}
      </View> : undefined}
      onEndReachedThreshold={0.3} onEndReached={() => { if (documents.hasNextPage && !documents.isFetching) void documents.fetchNextPage() }}
    />
    <ChoiceSheet title={pickerTitle} visible={picker !== null} value={picker === 'type' ? type : picker === 'level' ? level : scope} options={picker === 'type' ? typeOptions : picker === 'level' ? levelOptions : scopeOptions} onClose={() => setPicker(null)} onSelect={(value) => { if (picker === 'type') setType(value); else if (picker === 'level') setLevel(value); else if (['all', 'mine', 'system'].includes(value)) setScope(value as DocumentScope) }} />
  </View>
}
