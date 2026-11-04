import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, MoreHorizontal, Folder, FolderPlus,
  Loader2, MessageCircle, MessageSquarePlus, Pin, Plus, Search, Trash2, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatRelativeTime } from '../../utils/helpers'
import type { ChatConversation, ChatFolder } from '../../services/api'

interface Props {
  searchInputRef: React.RefObject<HTMLInputElement>
  conversations: ChatConversation[]
  folders: ChatFolder[]
  activeId: string | null
  selectedFolderId: string | null
  creatingConversation: boolean
  loading: boolean
  search: string
  onSearch: (value: string) => void
  onCreateText: (folderId?: string | null) => void
  onSelectFolder: (folderId: string | null) => void
  onCreateFolder: () => void
  onSelect: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onPinConversation: (conversation: ChatConversation) => void
  onMoveConversation: (conversation: ChatConversation) => void
  onDropConversation: (conversationId: string, folderId: string) => void
  onDeleteConversation: (conversation: ChatConversation) => void
  onRenameFolder: (folder: ChatFolder) => void
  onDeleteFolder: (folder: ChatFolder, deleteConversations: boolean) => void
  onReorderFolders: (folderIds: string[]) => void
}

function groupForDate(value: string, now: Date) {
  const date = new Date(value)
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const daysAgo = Math.floor((startToday - startDate) / 86_400_000)
  if (daysAgo <= 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  if (daysAgo < 7) return 'lastSevenDays'
  if (daysAgo < 30) return 'lastThirtyDays'
  return 'older'
}

export default function ChatConversationSidebar(props: Props) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [editingConversation, setEditingConversation] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const folderId = props.selectedFolderId
    if (folderId) setExpandedFolders(current => new Set([...current, folderId]))
  }, [props.selectedFolderId])

  const sortedFolders = useMemo(() => [...props.folders].sort((a, b) => a.sort_order - b.sort_order), [props.folders])
  const pinned = props.conversations.filter((conversation) => conversation.is_pinned)
  const unpinned = props.conversations.filter((conversation) => !conversation.is_pinned && !conversation.folder_id)
  const searchActive = Boolean(props.search.trim())
  const dateGroups = useMemo(() => {
    const now = new Date()
    const order = ['today', 'yesterday', 'lastSevenDays', 'lastThirtyDays', 'older']
    return order.map((key) => ({
      key,
      items: unpinned.filter((conversation) => groupForDate(conversation.last_activity_at, now) === key),
    })).filter((group) => group.items.length > 0)
  }, [unpinned])

  const renameSubmit = (event: FormEvent, conversation: ChatConversation) => {
    event.preventDefault()
    const title = editingTitle.trim()
    if (title && title !== conversation.title) props.onRenameConversation(conversation.id, title)
    setEditingConversation(null)
  }

  const toggleFolder = (id: string) => setExpandedFolders((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const deleteFolder = (folder: ChatFolder) => {
    if (!window.confirm(t('chat.confirmDeleteFolder', { name: folder.name }))) return
    const deleteConversations = window.confirm(t('chat.confirmDeleteFolderConversations'))
    props.onDeleteFolder(folder, deleteConversations)
  }

  const renderConversation = (conversation: ChatConversation) => (
    <div key={conversation.id} draggable onDragStart={(event) => {
      event.dataTransfer.setData('text/chat-conversation-id', conversation.id)
      event.dataTransfer.effectAllowed = 'move'
    }} className={`group relative rounded-xl transition ${props.activeId === conversation.id ? 'bg-[color:var(--accent)] ring-1 ring-[color:var(--primary)]' : 'hover:bg-[color:var(--accent)]'}`}>
      {editingConversation === conversation.id ? (
        <form onSubmit={(event) => renameSubmit(event, conversation)} className="flex items-center gap-1 p-2">
          <input autoFocus value={editingTitle} maxLength={80} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setEditingConversation(null)} className="input min-w-0 flex-1 px-2 py-1 text-sm" aria-label={t('chat.renameConversation')} />
          <button type="submit" aria-label={t('chat.save')} className="rounded-lg p-2 text-[color:var(--primary)] hover:bg-[color:var(--card-glass)]"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={() => setEditingConversation(null)} aria-label={t('chat.cancel')} className="rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--card-glass)]"><X className="h-4 w-4" /></button>
        </form>
      ) : (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button type="button" onClick={() => props.onSelect(conversation.id)} className="min-w-0 flex-1 text-left" aria-current={props.activeId === conversation.id ? 'page' : undefined}>
            <span className="flex min-w-0 items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
              <span className="truncate text-sm font-medium text-[color:var(--text)]">{conversation.title}</span>
              {conversation.is_pinned && <Pin className="h-3 w-3 shrink-0 text-[color:var(--primary)]" />}
            </span>
            <span className="mt-0.5 block truncate pl-5 text-[11px] text-[color:var(--text-muted)]">
              {conversation.snippet || formatRelativeTime(conversation.last_activity_at, language)}
            </span>
          </button>
          <button type="button" onClick={() => props.onDeleteConversation(conversation)} aria-label={t('chat.deleteConversation')} title={t('chat.deleteConversation')} className="shrink-0 rounded-lg p-2 text-[color:var(--text-muted)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setOpenMenu(openMenu === `conversation:${conversation.id}` ? null : `conversation:${conversation.id}`)} aria-label={t('chat.conversationActions')} aria-expanded={openMenu === `conversation:${conversation.id}`} className="rounded-lg p-2 text-[color:var(--text-muted)] opacity-70 hover:bg-[color:var(--card-glass)] hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
            {openMenu === `conversation:${conversation.id}` && <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-xl">
              <button type="button" onClick={() => { setEditingConversation(conversation.id); setEditingTitle(conversation.title); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)]">{t('chat.rename')}</button>
              <button type="button" onClick={() => { props.onPinConversation(conversation); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)]">{conversation.is_pinned ? t('chat.unpin') : t('chat.pin')}</button>
              <button type="button" onClick={() => { props.onMoveConversation(conversation); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)]">{t('chat.moveToFolder')}</button>
              <button type="button" onClick={() => { props.onDeleteConversation(conversation); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-[color:var(--accent)]">{t('chat.deleteConversation')}</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-[color:var(--border)] bg-[color:var(--card-glass)]">
      <div className="space-y-3 border-b border-[color:var(--border)] p-4">
        <div className="relative">
          <button type="button" onClick={() => props.onCreateText()} disabled={props.creatingConversation} className="btn btn-primary flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 shadow-sm">
            {props.creatingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}{t('chat.newConversation')}
          </button>
        </div>
        {sortedFolders.length > 0 && <label className="block space-y-1.5 text-xs font-medium text-[color:var(--text-muted)]">
          <span>{t('chat.newConversationDestination')}</span>
          <select aria-label={t('chat.newConversationDestination')} value={props.selectedFolderId || ''} onChange={event => props.onSelectFolder(event.target.value || null)} className="input h-9 rounded-lg text-xs" disabled={props.creatingConversation}>
            <option value="">{t('chat.unfiled')}</option>
            {sortedFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input ref={props.searchInputRef} value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder={t('chat.searchConversations')} className="input h-11 w-full rounded-xl border-[color:var(--border)] bg-[color:var(--card-glass)] pl-10 pr-3 text-sm text-[color:var(--text)]" aria-label={t('chat.searchConversations')} />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-3" aria-label={t('chat.conversationList')}>
        {props.loading ? <div className="space-y-2 p-2" aria-live="polite">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-[color:var(--accent)]" />)}</div> : searchActive ? (
            <section><h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{t('chat.searchResults')}</h2>{props.conversations.length ? <div className="space-y-1">{props.conversations.map(renderConversation)}</div> : <p className="px-2 py-5 text-center text-sm text-[color:var(--text-muted)]">{t('chat.noSearchResults')}</p>}</section>
        ) : <>
          {pinned.length > 0 && <section><h2 className="section-label flex items-center gap-2"><Pin className="h-3 w-3" />{t('chat.pinned')}</h2><div className="space-y-1">{pinned.map(renderConversation)}</div></section>}

          <section>
            <div className="mb-2 flex items-center justify-between px-2"><h2 className="mb-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{t('chat.folders')}</h2><button type="button" onClick={props.onCreateFolder} aria-label={t('chat.createFolder')} title={t('chat.createFolder')} className="rounded-lg p-1.5 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"><FolderPlus className="h-4 w-4" /></button></div>
            {sortedFolders.length === 0 ? <button type="button" onClick={props.onCreateFolder} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--accent)]"><FolderPlus className="h-4 w-4" />{t('chat.createFirstFolder')}</button> : <div className="space-y-1">
              {sortedFolders.map((folder, index) => {
                const folderConversations = props.conversations.filter((conversation) => conversation.folder_id === folder.id)
                const expanded = expandedFolders.has(folder.id)
                return <div key={folder.id} draggable onDragStart={(event) => {
                  event.dataTransfer.setData('text/chat-folder-id', folder.id)
                  event.dataTransfer.effectAllowed = 'move'
                }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault()
                  const id = event.dataTransfer.getData('text/chat-conversation-id')
                  if (id) {
                    props.onDropConversation(id, folder.id)
                    return
                  }
                  const sourceFolderId = event.dataTransfer.getData('text/chat-folder-id')
                  if (sourceFolderId && sourceFolderId !== folder.id) {
                    const ids = sortedFolders.map((item) => item.id)
                    const from = ids.indexOf(sourceFolderId)
                    const to = ids.indexOf(folder.id)
                    if (from >= 0 && to >= 0) { ids.splice(from, 1); ids.splice(to, 0, sourceFolderId); props.onReorderFolders(ids) }
                  }
                }} onDragEnter={(event) => event.preventDefault()} className="rounded-xl">
                  <div className={`group flex items-center gap-1 rounded-xl hover:bg-[color:var(--accent)] ${props.selectedFolderId === folder.id ? 'bg-[color:var(--accent)]' : ''}`}>
                    <button type="button" onClick={() => { props.onSelectFolder(folder.id); toggleFolder(folder.id) }} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm text-[color:var(--text)]">
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}<Folder className="h-4 w-4 shrink-0 text-[color:var(--primary)]" /><span className="truncate">{folder.name}</span><span className="ml-auto text-xs text-[color:var(--text-muted)]">{folder.conversation_count}</span>
                    </button>
                    <button type="button" onClick={() => { props.onSelectFolder(folder.id); setExpandedFolders(current => new Set([...current, folder.id])); props.onCreateText(folder.id) }} disabled={props.creatingConversation} aria-label={t('chat.newConversationInFolder', { name: folder.name })} title={t('chat.newConversationInFolder', { name: folder.name })} className="shrink-0 rounded-lg p-2 text-[color:var(--primary)] transition hover:bg-[color:var(--card)] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                    <div className="relative">
                      <button type="button" onClick={() => setOpenMenu(openMenu === `folder:${folder.id}` ? null : `folder:${folder.id}`)} aria-label={t('chat.folderActions')} aria-expanded={openMenu === `folder:${folder.id}`} className="rounded-lg p-2 text-[color:var(--text-muted)] opacity-70 hover:bg-[color:var(--card-glass)] hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
                      {openMenu === `folder:${folder.id}` && <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-xl">
                        <button type="button" onClick={() => { props.onRenameFolder(folder); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)]">{t('chat.renameFolder')}</button>
                        <button type="button" disabled={index === 0} onClick={() => { const ids = sortedFolders.map((item) => item.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; props.onReorderFolders(ids); setOpenMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)] disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" />{t('chat.moveFolderUp')}</button>
                        <button type="button" disabled={index === sortedFolders.length - 1} onClick={() => { const ids = sortedFolders.map((item) => item.id); [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]]; props.onReorderFolders(ids); setOpenMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--accent)] disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" />{t('chat.moveFolderDown')}</button>
                        <button type="button" onClick={() => { deleteFolder(folder); setOpenMenu(null) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-[color:var(--accent)]">{t('chat.deleteFolder')}</button>
                      </div>}
                    </div>
                  </div>
                  {expanded && <div className="ml-4 mt-1 space-y-1 border-l border-[color:var(--border)] pl-2">{folderConversations.length ? folderConversations.map(renderConversation) : <p className="px-2 py-2 text-xs text-[color:var(--text-muted)]">{t('chat.emptyFolder')}</p>}</div>}
                </div>
              })}
            </div>}
          </section>

          {dateGroups.map((group) => <section key={group.key}><h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{t(`chat.groups.${group.key}`)}</h2><div className="space-y-1">{group.items.map(renderConversation)}</div></section>)}
          {pinned.length === 0 && sortedFolders.length === 0 && unpinned.length === 0 && <div className="px-4 py-12 text-center text-[color:var(--text-muted)]"><MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-60" /><p className="text-sm font-semibold">{t('chat.noConversations')}</p><p className="mt-1 text-xs">{t('chat.noConversationsHelp')}</p></div>}
          {props.conversations.length === 0 && <button type="button" onClick={props.onCreateFolder} className="sr-only"><Plus />{t('chat.createFolder')}</button>}
        </>}
      </div>
      <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--text-muted)]">{t('chat.dragTip')}</div>
    </aside>
  )
}
