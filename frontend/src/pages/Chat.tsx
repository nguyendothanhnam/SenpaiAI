import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from 'react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, MessageCircle, MoreVertical, Pin, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ChatComposer from '../components/chat/ChatComposer'
import ChatConversationSidebar from '../components/chat/ChatConversationSidebar'
import ChatFolderDialog from '../components/chat/ChatFolderDialog'
import ChatMessageList from '../components/chat/ChatMessageList'
import { chatAPI, type ChatConversation, type ChatConversationPage, type ChatFolder } from '../services/api'
import { useAuth } from '../services/auth'
import { getErrorMessage } from '../utils/getErrorMessage'
import { downloadChatHistory, serializeChatHistory } from '../utils/chatExport'

type FolderDialogState = { mode: 'create' | 'rename' | 'move'; folder?: ChatFolder; conversation?: ChatConversation } | null

const pageSize = 30

function updateConversationPages(queryClient: ReturnType<typeof useQueryClient>, id: string, update: Partial<ChatConversation>) {
  ;(queryClient as any).setQueriesData(['chatConversations'], (page: ChatConversationPage | undefined) => page && ({
    ...page,
    items: page.items.map((item) => item.id === id ? { ...item, ...update } : item),
  }))
  ;(queryClient as any).setQueryData(['chatConversation', id], (current: ChatConversation | undefined) => current ? { ...current, ...update } : current)
}

export default function Chat() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const { conversationId } = useParams<{ conversationId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined)
  const params = new URLSearchParams(location.search)
  const newConversationState = params.has('new')
  const listState = params.has('list')
  const showMobileChat = Boolean(conversationId || newConversationState)

  const conversationsQuery = useQuery(
    ['chatConversations', debouncedSearch],
    () => chatAPI.listConversations({ search: debouncedSearch || undefined, limit: 100 }).then((response) => response.data),
    { keepPreviousData: true, refetchOnWindowFocus: false },
  )
  const foldersQuery = useQuery(['chatFolders'], () => chatAPI.listFolders().then((response) => response.data), { refetchOnWindowFocus: false })
  const conversationQuery = useQuery(
    ['chatConversation', conversationId],
    () => chatAPI.getConversation(conversationId!).then((response) => response.data),
    { enabled: Boolean(conversationId), refetchOnWindowFocus: false },
  )
  const messagesQuery = useInfiniteQuery(
    ['chatMessages', conversationId],
    ({ pageParam = 0 }) => chatAPI.getConversationMessages(conversationId!, pageSize, pageParam).then((response) => response.data),
    {
      enabled: Boolean(conversationId),
      getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.offset + lastPage.items.length : undefined,
      refetchOnWindowFocus: false,
    },
  )

  const conversations = conversationsQuery.data?.items || []
  const folders = foldersQuery.data || []
  const activeConversation = conversationQuery.data || conversations.find((item) => item.id === conversationId) || null
  const targetFolderId = selectedFolderId === undefined ? activeConversation?.folder_id || null : selectedFolderId
  const messages = useMemo(() => messagesQuery.data?.pages.flatMap((page) => page.items).reverse() || [], [messagesQuery.data])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 260)
    return () => window.clearTimeout(timer)
  }, [search])


  useEffect(() => {
    if (conversationId || newConversationState || listState || conversationsQuery.isLoading || conversationsQuery.isError) return
    const mostRecent = [...conversations].sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0]
    if (mostRecent) navigate(`/chat/${mostRecent.id}`, { replace: true })
  }, [conversationId, newConversationState, listState, conversations, conversationsQuery.isLoading, conversationsQuery.isError, navigate])

  useEffect(() => {
    if (conversationQuery.isError) {
      toast.error(getErrorMessage(conversationQuery.error))
      navigate('/chat?list=1', { replace: true })
    }
  }, [conversationQuery.isError, conversationQuery.error, navigate])

  useEffect(() => {
    if (activeConversation) setTitleDraft(activeConversation.title)
  }, [activeConversation?.id, activeConversation?.title])

  const refreshChat = (id?: string) => {
    void queryClient.invalidateQueries(['chatConversations'])
    void queryClient.invalidateQueries(['chatFolders'])
    if (id) {
      void queryClient.invalidateQueries(['chatConversation', id])
      void queryClient.invalidateQueries(['chatMessages', id])
    }
  }

  const sendMessageMutation = useMutation(
    ({ text, id }: { text: string; id?: string }) => chatAPI.sendMessage(text, undefined, user?.current_jlpt_level, id, language).then((response) => response.data),
    { onSuccess: (data) => refreshChat(data.conversation_id) },
  )

  const createConversationMutation = useMutation(
    (folderId: string | null) => chatAPI.createConversation({ folder_id: folderId }).then(({ data }) => data),
    {
      onSuccess: (conversation) => {
        queryClient.setQueryData(['chatConversation', conversation.id], conversation)
        setSelectedFolderId(undefined)
        setSearch('')
        refreshChat(conversation.id)
        navigate(`/chat/${conversation.id}`)
      },
      onError: (error) => { toast.error(getErrorMessage(error)) },
    },
  )
  const { mutate: createConversation, isLoading: creatingConversation } = createConversationMutation
  const startNewConversation = useCallback((folderId?: string | null) => {
    if (!creatingConversation) createConversation(folderId === undefined ? targetFolderId : folderId)
  }, [createConversation, creatingConversation, targetFolderId])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        startNewConversation()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [startNewConversation])

  const renameConversationMutation = useMutation(
    ({ id, title }: { id: string; title: string }) => chatAPI.renameConversation(id, title),
    {
      onMutate: async ({ id, title }) => {
        await queryClient.cancelQueries(['chatConversations'])
        const previous = queryClient.getQueriesData<ChatConversationPage>(['chatConversations'])
        updateConversationPages(queryClient, id, { title })
        return { previous }
      },
      onError: (error, _variables, context) => {
        context?.previous.forEach(([key, page]) => queryClient.setQueryData(key, page))
        toast.error(getErrorMessage(error))
      },
      onSettled: (_data, _error, variables) => refreshChat(variables.id),
    },
  )
  const pinConversationMutation = useMutation(
    ({ conversation, is_pinned }: { conversation: ChatConversation; is_pinned: boolean }) => chatAPI.setConversationPinned(conversation.id, is_pinned),
    {
      onMutate: async ({ conversation, is_pinned }) => {
        await queryClient.cancelQueries(['chatConversations'])
        const previous = queryClient.getQueriesData<ChatConversationPage>(['chatConversations'])
        updateConversationPages(queryClient, conversation.id, { is_pinned })
        return { previous }
      },
      onError: (error, _variables, context) => {
        context?.previous.forEach(([key, page]) => queryClient.setQueryData(key, page))
        toast.error(getErrorMessage(error))
      },
      onSettled: (_data, _error, variables) => refreshChat(variables.conversation.id),
    },
  )
  const moveConversationMutation = useMutation(
    ({ conversation, folder_id }: { conversation: ChatConversation; folder_id: string | null }) => chatAPI.moveConversation(conversation.id, folder_id),
    {
      onMutate: async ({ conversation, folder_id }) => {
        await queryClient.cancelQueries(['chatConversations'])
        const previous = queryClient.getQueriesData<ChatConversationPage>(['chatConversations'])
        const folder_name = folders.find((folder) => folder.id === folder_id)?.name || null
        updateConversationPages(queryClient, conversation.id, { folder_id, folder_name })
        return { previous }
      },
      onError: (error, _variables, context) => {
        context?.previous.forEach(([key, page]) => queryClient.setQueryData(key, page))
        toast.error(getErrorMessage(error))
      },
      onSettled: (_data, _error, variables) => refreshChat(variables.conversation.id),
    },
  )

  const createFolderMutation = useMutation((name: string) => chatAPI.createFolder(name), {
    onSuccess: ({ data }) => { setSelectedFolderId(data.id); setFolderDialog(null); refreshChat(); toast.success(t('chat.folderCreated')) },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })
  const renameFolderMutation = useMutation(({ id, name }: { id: string; name: string }) => chatAPI.renameFolder(id, name), {
    onSuccess: () => { setFolderDialog(null); refreshChat(); toast.success(t('chat.folderRenamed')) },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })
  const deleteFolderMutation = useMutation(({ folder, deleteConversations }: { folder: ChatFolder; deleteConversations: boolean }) => chatAPI.deleteFolder(folder.id, deleteConversations), {
    onSuccess: (_data, { folder }) => { if (targetFolderId === folder.id) setSelectedFolderId(null); refreshChat(conversationId); toast.success(t('chat.folderDeleted')) },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })
  const reorderFoldersMutation = useMutation((folderIds: string[]) => chatAPI.reorderFolders(folderIds), {
    onMutate: async (folderIds) => {
      await queryClient.cancelQueries(['chatFolders'])
      const previous = queryClient.getQueryData<ChatFolder[]>(['chatFolders'])
      ;(queryClient as any).setQueryData(['chatFolders'], (current: ChatFolder[] | undefined) => current?.map((folder) => ({ ...folder, sort_order: folderIds.indexOf(folder.id) })).sort((a, b) => a.sort_order - b.sort_order))
      return { previous }
    },
    onError: (error, _variables, context) => { queryClient.setQueryData(['chatFolders'], context?.previous); toast.error(getErrorMessage(error)) },
    onSettled: () => { void queryClient.invalidateQueries(['chatFolders']) },
  })
  const deleteConversationMutation = useMutation((id: string) => chatAPI.deleteConversation(id), {
    onSuccess: (_data, id) => { refreshChat(id); if (conversationId === id) navigate('/chat?list=1'); toast.success(t('chat.conversationDeleted')) },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })
  const deleteMessageMutation = useMutation(
    ({ id }: { id: number; conversationId: string }) => chatAPI.deleteEntry(id),
    {
      onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries(['chatMessages', variables.conversationId])
        refreshChat(variables.conversationId)
        toast.success(t('chat.messageDeleted'))
      },
      onError: (error) => { toast.error(getErrorMessage(error)) },
    },
  )
  const clearHistoryMutation = useMutation(() => chatAPI.clearHistory(), {
    onSuccess: () => {
      void (queryClient as any).setQueriesData(['chatConversations'], (page: ChatConversationPage | undefined) => page ? { ...page, items: [], total: 0 } : page)
      refreshChat(conversationId)
      navigate('/chat?new=1')
      toast.success(t('chat.historyCleared'))
    },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })

  const sendMessage = async (text: string): Promise<boolean> => {
    try {
      const result = await sendMessageMutation.mutateAsync({ text, id: conversationId })
      if (!conversationId && result.conversation_id) navigate(`/chat/${result.conversation_id}`, { replace: true })
      return true
    } catch (error) {
      toast.error(getErrorMessage(error))
      return false
    }
  }


  const submitFolderDialog = (value: string | null) => {
    if (!folderDialog) return
    if (folderDialog.mode === 'create' && value) createFolderMutation.mutate(value)
    if (folderDialog.mode === 'rename' && folderDialog.folder && value) renameFolderMutation.mutate({ id: folderDialog.folder.id, name: value })
    if (folderDialog.mode === 'move' && folderDialog.conversation) moveConversationMutation.mutate({ conversation: folderDialog.conversation, folder_id: value })
  }

  const exportConversation = async () => {
    if (!conversationId || !activeConversation || exporting) return
    setExporting(true)
    try {
      const allMessages = [] as Awaited<ReturnType<typeof chatAPI.getConversationMessages>>['data']['items']
      let offset = 0
      while (true) {
        const { data } = await chatAPI.getConversationMessages(conversationId, 100, offset)
        allMessages.push(...data.items)
        if (!data.has_more) break
        offset += data.items.length
      }
      allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const content = serializeChatHistory(allMessages.map((message) => ({ ...message, jlpt_level: message.jlpt_level || undefined })), {
        question: t('chat.exportQuestion'), answer: t('chat.exportAnswer'), level: t('chat.exportLevel'),
        translation: t('chat.translation'), grammar: t('chat.grammarPoints'), sources: t('chat.sources'),
      }, language === 'en' ? 'en-US' : 'vi-VN')
      downloadChatHistory(content, `senpaiai-${activeConversation.title}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const returnToList = () => navigate('/chat?list=1')
  const showConversationLoading = Boolean(conversationId && (conversationQuery.isLoading || messagesQuery.isLoading))
  const displayTitle = editingTitle ? titleDraft : (activeConversation?.title || t('chat.newConversation'))

  return <div className="h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] shadow-[var(--shadow-card)]">
    <div className="grid h-full grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)] lg:grid-cols-[290px_minmax(0,1fr)]">
      <div className={`${showMobileChat ? 'hidden' : 'flex'} min-h-0 md:flex`}>
        <ChatConversationSidebar
          conversations={conversations}
          folders={folders}
          activeId={conversationId || null}
          selectedFolderId={targetFolderId}
          creatingConversation={creatingConversation}
          loading={conversationsQuery.isLoading || foldersQuery.isLoading}
          search={search}
          searchInputRef={searchRef}
          onSearch={setSearch}
          onCreateText={startNewConversation}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={() => setFolderDialog({ mode: 'create' })}
          onSelect={(id) => { setSelectedFolderId(undefined); navigate(`/chat/${id}`) }}
          onRenameConversation={(id, title) => renameConversationMutation.mutate({ id, title })}
          onPinConversation={(conversation) => pinConversationMutation.mutate({ conversation, is_pinned: !conversation.is_pinned })}
          onMoveConversation={(conversation) => setFolderDialog({ mode: 'move', conversation })}
          onDropConversation={(id, folderId) => {
            const conversation = conversations.find((item) => item.id === id)
            if (conversation) moveConversationMutation.mutate({ conversation, folder_id: folderId })
          }}
          onDeleteConversation={(conversation) => {
            if (window.confirm(t('chat.confirmDeleteConversation', { title: conversation.title }))) deleteConversationMutation.mutate(conversation.id)
          }}
          onRenameFolder={(folder) => setFolderDialog({ mode: 'rename', folder })}
          onDeleteFolder={(folder, deleteConversations) => deleteFolderMutation.mutate({ folder, deleteConversations })}
          onReorderFolders={(folderIds) => reorderFoldersMutation.mutate(folderIds)}
        />
      </div>

      <main className={`${showMobileChat ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col md:flex`}>
        <header className="flex min-h-[76px] shrink-0 items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--card-glass)] px-4 py-4 sm:px-6">
          <button type="button" onClick={returnToList} className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] md:hidden" aria-label={t('chat.backToList')}><ArrowLeft className="h-5 w-5" /></button>
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)] text-[color:var(--primary)] sm:flex"><MessageCircle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            {editingTitle && activeConversation ? <form onSubmit={(event) => { event.preventDefault(); const title = titleDraft.trim(); if (title && title !== activeConversation.title) renameConversationMutation.mutate({ id: activeConversation.id, title }); setEditingTitle(false) }} className="flex items-center gap-2">
              <input autoFocus maxLength={80} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setEditingTitle(false)} className="input h-9 max-w-lg flex-1 px-3 text-sm" aria-label={t('chat.renameConversation')} />
              <button type="submit" className="btn btn-primary btn-sm">{t('chat.save')}</button>
            </form> : <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-heading text-base font-bold text-[color:var(--text)] sm:text-lg">{displayTitle}</h1>
              {activeConversation && <button type="button" onClick={() => { setTitleDraft(activeConversation.title); setEditingTitle(true) }} className="rounded-md px-1.5 py-1 text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]">{t('chat.rename')}</button>}
            </div>}
            <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{activeConversation?.folder_name || (activeConversation ? t('chat.unfiled') : newConversationState ? t('chat.newConversationHelp') : t('chat.selectConversationHelp'))}</p>
          </div>
          {activeConversation?.is_pinned && <Pin className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />}

          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={t('chat.moreActions')} aria-expanded={menuOpen} className="rounded-xl p-2.5 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]"><MoreVertical className="h-5 w-5" /></button>
            {menuOpen && <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-xl">
              {conversationId && <button type="button" onClick={() => { void exportConversation(); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)]"><Download className="h-4 w-4" />{t('chat.downloadConversation')}</button>}
              <button type="button" onClick={() => { setMenuOpen(false); if (window.confirm(t('chat.confirmClearHistory'))) clearHistoryMutation.mutate() }} disabled={clearHistoryMutation.isLoading} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-[color:var(--accent)]"><Trash2 className="h-4 w-4" />{t('chat.clearAllConversations')}</button>
            </div>}
          </div>
        </header>

        {conversationId && conversationQuery.isError ? <div className="flex flex-1 items-center justify-center p-8 text-sm text-[color:var(--text-muted)]">{t('chat.conversationNotFound')}</div> : <>
          <ChatMessageList
            onDelete={(id) => { if (conversationId && !deleteMessageMutation.isLoading) deleteMessageMutation.mutate({ id, conversationId }) }}
            deletingId={deleteMessageMutation.isLoading ? deleteMessageMutation.variables?.id : undefined}
            pendingText={sendMessageMutation.isLoading ? sendMessageMutation.variables?.text : undefined}
            messages={messages}
            loading={showConversationLoading}
            loadingOlder={messagesQuery.isFetchingNextPage}
            hasMore={Boolean(messagesQuery.hasNextPage)}
            searchTerm={search}
            showSuggestions={newConversationState || Boolean(activeConversation?.mode === 'text' && !messages.length)}
            emptyTitle={!conversationId && !newConversationState ? t('chat.selectConversation') : undefined}
            emptyDescription={!conversationId && !newConversationState ? t('chat.selectConversationHelp') : undefined}
            onLoadOlder={() => { void messagesQuery.fetchNextPage() }}
            onStartSuggestion={(value) => { void sendMessage(value) }}
          />
          {(!activeConversation || activeConversation.mode === 'text') && <div className="shrink-0 px-4 pb-4 pt-2 sm:px-7 sm:pb-5"><div className="mx-auto max-w-3xl">
            <ChatComposer sending={sendMessageMutation.isLoading} onSend={sendMessage} />
          </div></div>}
        </>}
      </main>
    </div>

    {folderDialog && <ChatFolderDialog
      open
      mode={folderDialog.mode}
      folder={folderDialog.folder}
      folders={folders}
      currentFolderId={folderDialog.conversation?.folder_id}
      onClose={() => setFolderDialog(null)}
      onSubmit={submitFolderDialog}
    />}
  </div>
}
