import { useCallback, useEffect, useRef, useState } from 'react'
import { View, type FlatList } from 'react-native'
import { useLocalSearchParams, router, usePreventRemove } from 'expo-router'
import { useInfiniteQuery, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { KeyboardFlatList, KeyboardLayout, useKeyboardLayout } from '../components/KeyboardLayout'
import { ChatComposer } from '../components/ChatComposer'
import { chatAPI, type ChatEntry } from '../api/phase2'
import { queryClient } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { publicSources, unique } from '../features/phase2/logic'
import { AppText, Badge, Button, Card, ErrorNotice, Muted } from '../components/ui'
import { NameDialog } from '../components/NameDialog'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'

export function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const [id, setId] = useState(params.id === 'new' ? undefined : params.id)
  const { user } = useAuth(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme()
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(); const [uncertain, setUncertain] = useState(false); const [renaming, setRenaming] = useState(false)
  const lock = useRef(false); const list = useRef<FlatList<ChatEntry>>(null)
  const stickToLatest = useRef(true)
  const scrollLatest = useCallback(() => { if (stickToLatest.current) list.current?.scrollToOffset({ offset: 0, animated: false }) }, [])
  const pending = useRef<{ question: string; oldIds: Set<number> } | null>(null)
  const conversation = useQuery(['conversation', user?.id, id], () => chatAPI.conversation(id!), { enabled: !!id })
  const messages = useInfiniteQuery(['chat-messages', user?.id, id], ({ pageParam = 0 }) => chatAPI.messages(id!, pageParam), { enabled: !!id, getNextPageParam: p => p.has_more ? p.offset + p.items.length : undefined })
  const rows = unique(messages.data?.pages.flatMap(p => p.items) || []).sort((a, b) => b.id - a.id)
  const latestId = rows[0]?.id
  useEffect(() => { const frame = requestAnimationFrame(scrollLatest); return () => cancelAnimationFrame(frame) }, [latestId, scrollLatest])
  const voice = conversation.data?.mode === 'voice'
  usePreventRemove(busy, () => undefined)
  async function reconcile(activeId: string) {
    const page = await chatAPI.messages(activeId)
    await queryClient.invalidateQueries(['chat-messages', user?.id, activeId])
    if (pending.current && page.items.some(m => !pending.current!.oldIds.has(m.id) && m.question === pending.current!.question)) { pending.current = null; setUncertain(false); setText(''); setError(undefined) }
    return page
  }
  async function send() {
    if (lock.current || !text.trim() || uncertain || voice) return
    lock.current = true; setBusy(true); setError(undefined)
    let activeId = id
    let startedSend = false
    try {
      // Creating here keeps opening an empty composer free of database records.
      if (!activeId) { const created = await chatAPI.create(); activeId = created.id; setId(activeId) }
      const before = await chatAPI.messages(activeId)
      pending.current = { question: text.trim(), oldIds: new Set(before.items.map(m => m.id)) }
      startedSend = true
      await chatAPI.send(text.trim(), activeId, i18n.resolvedLanguage === 'en' ? 'en' : 'vi', user?.current_jlpt_level)
      pending.current = null; setText(''); setUncertain(false)
      await queryClient.invalidateQueries(['chat-messages', user?.id, activeId]); await queryClient.invalidateQueries(['conversation', user?.id, activeId]); void queryClient.invalidateQueries(['chat-list', user?.id])
      list.current?.scrollToOffset({ offset: 0, animated: true })
    } catch (e) {
      setError(e)
      const status = (e as { response?: { status: number } }).response?.status
      // A timed-out request may still commit on the server. Never blindly resend it.
      if (!activeId || (startedSend && (!status || status >= 500))) setUncertain(true)
      if (activeId && startedSend) { try { await reconcile(activeId) } catch { /* Keep retry locked until a successful server read. */ setUncertain(true) } }
    } finally { lock.current = false; setBusy(false) }
  }
  return <KeyboardLayout style={{ backgroundColor: colors.screen }} onKeyboardLayout={state => { if (state.visible) scrollLatest() }}>
    <View style={{ flexShrink: 1, gap: 8 }}><ConversationHeading><View style={{ padding: 12, gap: 8 }}><Button secondary title={conversation.data?.title || t('phase2.newConversation')} disabled={!id || busy || !conversation.data} onPress={() => setRenaming(true)} />{voice && <Muted>{t('phase2.voiceReadOnly')}</Muted>}</View></ConversationHeading>
      {(!!error || messages.isError || conversation.isError) && <ErrorNotice message={getErrorMessage(error || messages.error || conversation.error, i18n)} retry={() => { if (id) void reconcile(id).catch(setError); void conversation.refetch() }} />}
      {uncertain && <Muted>{t('phase2.uncertainChat')}</Muted>}
    </View>
    <KeyboardFlatList includeBottomInset={false} ref={list} style={{ flex: 1, minHeight: 0 }} inverted data={rows} keyExtractor={m => String(m.id)} maintainVisibleContentPosition={{ minIndexForVisible: 0 }} onLayout={scrollLatest} onContentSizeChange={scrollLatest} onScrollBeginDrag={() => { stickToLatest.current = false }} onScroll={event => { stickToLatest.current = event.nativeEvent.contentOffset.y <= 40 }} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, gap: 20, flexGrow: rows.length ? undefined : 1 }} onEndReachedThreshold={0.3} onEndReached={() => { if (messages.hasNextPage && !messages.isFetching) void messages.fetchNextPage() }}
      ListHeaderComponent={busy ? <AppText accessibilityLiveRegion="polite">{t('phase2.replying')}</AppText> : undefined}
      ListFooterComponent={messages.isFetchingNextPage ? <Muted>{t('loading')}</Muted> : messages.hasNextPage ? <Button secondary title={t('phase2.olderMessages')} onPress={() => void messages.fetchNextPage()} /> : undefined}
      ListEmptyComponent={<View style={{ gap: 12 }}><Muted>{t(messages.isLoading ? 'loading' : 'phase2.emptyConversation')}</Muted>{!id && ['starter1', 'starter2', 'starter3'].map(key => <Button secondary key={key} title={t(`phase2.${key}`)} onPress={() => setText(t(`phase2.${key}`))} />)}</View>}
      renderItem={({ item }) => <View style={{ gap: 12 }}><Card style={{ backgroundColor: colors.accent, marginLeft: 35 }}><AppText selectable>{item.question}</AppText></Card><Card><Badge>SenpaiAI {item.jlpt_level || ''}</Badge><AppText selectable>{item.answer.split('\n').filter(line => !/^(?:\*\*)?(?:Intent|Output|Classification|Task)\s*[:：]/i.test(line.trim())).join('\n')}</AppText>{!!item.translation && <><Muted>{i18n.t('chat.translation', { ns: 'common' })}</Muted><AppText selectable>{item.translation}</AppText></>}{(item.grammar_points || []).map((p, n) => <View key={n}><AppText selectable style={{ fontWeight: '700' }}>{p.pattern}</AppText><AppText selectable>{p.explanation}</AppText>{p.example && <AppText selectable>{p.example}</AppText>}</View>)}{publicSources(item.sources).map((source, n) => source.document_id ? <Button secondary key={n} title={source.title || t('phase2.source')} onPress={() => router.push({ pathname: '/library-document/[id]', params: { id: source.document_id! } })} /> : <AppText selectable key={n}>{source.title || source.url}</AppText>)}</Card></View>} />
    {!voice && <ChatComposer text={text} onChange={setText} busy={busy} uncertain={uncertain} sendDisabled={busy || uncertain || !text.trim() || (!!id && (!conversation.data || messages.isError))} onSend={() => void send()} onFocus={() => { stickToLatest.current = true; requestAnimationFrame(scrollLatest) }} />}
    <NameDialog title={t('phase2.rename')} value={renaming ? conversation.data?.title || '' : null} limit={80} onClose={() => setRenaming(false)} onSave={name => { if (id) void chatAPI.rename(id, name).then(() => { void conversation.refetch(); void queryClient.invalidateQueries(['chat-list', user?.id]) }).catch(setError) }} />
  </KeyboardLayout>
}

function ConversationHeading({ children }: import('react').PropsWithChildren) {
  const { visible } = useKeyboardLayout()
  return visible ? null : children
}
