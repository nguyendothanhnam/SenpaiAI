import { KeyboardInput as TextInput, KeyboardFlatList as FlatList, KeyboardLayout } from '../components/KeyboardLayout'
import { useEffect, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useInfiniteQuery, useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { chatAPI, type Conversation } from '../api/phase2'
import { queryClient } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { groupConversations, relativeTime, unique } from '../features/phase2/logic'
import { AppText, Badge, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { ChoiceSheet } from '../components/ChoiceSheet'
import { NameDialog } from '../components/NameDialog'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
import { SkeletonList } from '../components/SkeletonList'
import { Ionicons } from '@expo/vector-icons'
import { answerLines, inlineParts } from '../features/phase2/messageFormatting'

export function ChatListScreen() {
  const { user } = useAuth(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme()
  const [input, setInput] = useState(''); const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Conversation>(); const [rename, setRename] = useState<Conversation>(); const [moving, setMoving] = useState<Conversation>()
  const [collapsed, setCollapsed] = useState<string[]>([])
  useEffect(() => { const timer = setTimeout(() => setSearch(input.trim()), 350); return () => clearTimeout(timer) }, [input])
  const query = useInfiniteQuery(['chat-list', user?.id, search], ({ pageParam = 0 }) => chatAPI.list(search, pageParam), { getNextPageParam: p => p.offset + p.items.length < p.total ? p.offset + p.items.length : undefined })
  const folders = useQuery(['chat-folders', user?.id], chatAPI.folders)
  const action = useMutation((work: () => Promise<unknown>) => work(), { onSuccess: () => { void queryClient.invalidateQueries(['chat-list', user?.id]); void queryClient.invalidateQueries(['chat-folders', user?.id]) } })
  const conversations = groupConversations(unique(query.data?.pages.flatMap(p => p.items) || []))
  const groups = ['pinned', ...(folders.data || []).map(f => `folder:${f.id}`), 'today', 'yesterday', 'week', 'month', 'older']
  const rows: ({ kind: 'heading'; id: string; label: string } | { kind: 'conversation'; id: string; item: Conversation })[] = []
  for (const group of groups) {
    const children = conversations.filter(c => c.group === group)
    if (!children.length && !group.startsWith('folder:')) continue
    rows.push({ kind: 'heading', id: group, label: group.startsWith('folder:') ? folders.data?.find(f => `folder:${f.id}` === group)?.name || '' : t(`phase2.${group}`) })
    if (!collapsed.includes(group)) children.forEach(item => rows.push({ kind: 'conversation', id: item.id, item }))
  }
  // Preserve conversations whose folder metadata has not loaded yet.
  conversations.filter(c => !groups.includes(c.group)).forEach(item => rows.push({ kind: 'conversation', id: item.id, item }))
  function remove(item: Conversation) { Alert.alert(t('phase2.delete'), t('phase2.deleteConversation'), [{ text: t('phase2.cancel'), style: 'cancel' }, { text: t('phase2.delete'), style: 'destructive', onPress: () => action.mutate(() => chatAPI.remove(item.id)) }]) }
  return <KeyboardLayout style={{ backgroundColor: colors.screen }}><FlatList data={rows} keyExtractor={r => r.id} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); void folders.refetch() }} onEndReachedThreshold={0.4} onEndReached={() => { if (query.hasNextPage && !query.isFetching) void query.fetchNextPage() }} ListHeaderComponent={<View style={{ gap: 12 }}><Title>{i18n.t('chat', { ns: 'nav' })}</Title><Button title={t('phase2.newConversation')} onPress={() => router.push('/conversation/new')} /><Button secondary title={t('phase2.manageFolders')} onPress={() => router.push('/chat-folders')} /><TextInput value={input} onChangeText={setInput} accessibilityLabel={t('phase2.searchChats')} placeholder={t('phase2.searchChats')} placeholderTextColor={colors.textMuted} style={[styles.field, { color: colors.text, borderColor: colors.border }]} />{(query.isError || action.isError || folders.isError) && <ErrorNotice message={getErrorMessage(query.error || action.error || folders.error, i18n)} retry={() => { void query.refetch(); void folders.refetch() }} />}<Muted>{t('phase2.longPress')}</Muted></View>}
    ListEmptyComponent={query.isLoading ? <SkeletonList /> : <Muted>{t('phase2.emptyChats')}</Muted>} ListFooterComponent={query.isFetchingNextPage ? <Muted>{t('loading')}</Muted> : query.hasNextPage ? <Button secondary title={t('phase2.loadMore')} onPress={() => void query.fetchNextPage()} /> : undefined}
    renderItem={({ item: row }) => row.kind === 'heading' ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: !collapsed.includes(row.id) }} onPress={() => setCollapsed(v => v.includes(row.id) ? v.filter(x => x !== row.id) : [...v, row.id])} style={{ minHeight: 48, justifyContent: 'center' }}><AppText style={{ fontWeight: '700' }}>{collapsed.includes(row.id) ? '▸' : '▾'} {row.label}</AppText></Pressable> : <Card style={{ marginBottom: 10, padding: 0, flexDirection: 'row', alignItems: 'center', gap: 0 }}><Pressable accessibilityRole="button" accessibilityLabel={row.item.title} disabled={action.isLoading} onLongPress={() => setSelected(row.item)} onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: row.item.id } })} style={{ flex: 1, gap: 6, padding: 16 }}><AppText numberOfLines={1} style={{ fontWeight: '700' }}>{row.item.title}</AppText>{row.item.mode === 'voice' && <Badge>{t('phase2.voice')}</Badge>}{!!row.item.snippet && <AppText numberOfLines={2} style={{ color: colors.textMuted }}>{answerLines(row.item.snippet).map(line => inlineParts(line.text).map(part => part.text).join('')).join(' ')}</AppText>}<Muted>{relativeTime(row.item.last_activity_at, (key, values) => t(key, values))}</Muted></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('phase2.chatActions', { title: row.item.title })} disabled={action.isLoading} onPress={() => setSelected(row.item)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} /></Pressable></Card>} />
    <ChoiceSheet visible={!!selected} title={selected?.title || ''} value="" options={[{ value: 'rename', label: t('phase2.rename') }, { value: 'pin', label: t(selected?.is_pinned ? 'phase2.unpin' : 'phase2.pin') }, { value: 'move', label: t('phase2.move') }, { value: 'delete', label: t('phase2.delete') }]} onClose={() => setSelected(undefined)} onSelect={value => { const item = selected!; if (value === 'rename') setRename(item); if (value === 'move') setMoving(item); if (value === 'pin') action.mutate(() => chatAPI.pin(item.id, !item.is_pinned)); if (value === 'delete') remove(item) }} />
    <NameDialog title={t('phase2.rename')} value={rename?.title ?? null} limit={80} onClose={() => setRename(undefined)} onSave={name => { if (rename) action.mutate(() => chatAPI.rename(rename.id, name)) }} />
    <ChoiceSheet visible={!!moving} title={t('phase2.move')} value={moving?.folder_id || ''} options={[{ value: '', label: t('phase2.unfiled') }, ...(folders.data || []).map(f => ({ value: f.id, label: f.name }))]} onClose={() => setMoving(undefined)} onSelect={id => { if (moving) action.mutate(() => chatAPI.move(moving.id, id || null)) }} />
  </KeyboardLayout>
}
