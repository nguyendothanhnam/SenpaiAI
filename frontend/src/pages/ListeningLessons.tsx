import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, ChevronDown, ChevronUp, FileText, Headphones, Loader2, Plus, Search, Sparkles, Youtube } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { libraryAPI, listeningAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { placementDefault } from '../utils/placementDefaults'
import VideoLessonCreator from '../components/listening/VideoLessonCreator'
import ListeningLessonCard from '../components/listening/ListeningLessonCard'
import { documentWordCount } from '../utils/listeningPresentation'
import '../components/listening/listening.css'

export default function ListeningLessons() {
  const { t } = useTranslation('common')
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [level, setLevel] = useState(() => placementDefault(params.toString(), user?.current_jlpt_level, ['N5', 'N4', 'N3', 'N2', 'N1'], ''))
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageInput, setPageInput] = useState('1')
  const [source, setSource] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createTab, setCreateTab] = useState<'video' | 'library'>('video')
  const [documentSearch, setDocumentSearch] = useState('')
  const [documentId, setDocumentId] = useState<number | ''>('')
  const [draft, setDraft] = useState<any>(null)
  const queryClient = useQueryClient()
  const query = useQuery(['listening-lessons', user?.id ?? null, level, topic, search, source, page], () => listeningAPI.getLessons({ jlpt_level: level || undefined, topic: topic || undefined, search: search.trim() || undefined, source: source || undefined, limit: 12, offset: page * 12 }).then(({ data }) => data), { retry: 1 })
  const documentsQuery = useQuery(['listening-library-documents', documentSearch, level], () => libraryAPI.getDocuments({ jlpt_level: level || undefined, sort: 'alphabetical', limit: 50 }).then(({ data }) => data), { enabled: createOpen })
  const documents = (documentsQuery.data?.items || []).filter((document: any) => !documentSearch.trim() || document.title.toLocaleLowerCase().includes(documentSearch.trim().toLocaleLowerCase()))
  const selectedDocument = (documentsQuery.data?.items || []).find((document: any) => document.id === Number(documentId))
  const wordCounts = useMemo(() => new Map<number, number>((documentsQuery.data?.items || []).map((document: any) => [document.id, documentWordCount(document.content || '')])), [documentsQuery.data])
  const draftMutation = useMutation(() => listeningAPI.createFromLibraryDraft({ document_id: Number(documentId), topic: topic || undefined }).then(({ data }) => data), {
    onSuccess: (data) => setDraft(data), onError: () => { toast.error(t('listening.libraryGenerateError')) },
  })
  const saveMutation = useMutation(() => listeningAPI.saveFromLibrary({ document_id: Number(documentId), title: draft.title, description: draft.description || '', jlpt_level: draft.jlpt_level, topic: draft.topic, segments: draft.segments }).then(({ data }) => data), {
    onSuccess: () => { toast.success(t('listening.librarySaved')); setCreateOpen(false); setDraft(null); setDocumentId(''); setPage(0); void queryClient.invalidateQueries('listening-lessons') },
    onError: () => { toast.error(t('listening.librarySaveError')) },
  })
  const lessons = query.data?.items ?? []
  const totalPages = Math.ceil((query.data?.total ?? 0) / 12)
  useEffect(() => setPageInput(String(page + 1)), [page])

  return <section className="listening-module mx-auto max-w-5xl space-y-5 px-4 py-6">
    <header className="listening-glass flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--listening-accent-text)]"><Headphones className="h-6 w-6" aria-hidden="true" /></span><div className="min-w-0"><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('listening.title')}</h1><p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{t('listening.subtitle')}</p></div></div>
      <button type="button" onClick={() => { setCreateOpen((value) => !value); setDraft(null) }} className={createOpen ? 'listening-secondary w-full sm:w-auto' : 'listening-action w-full sm:w-auto'} aria-expanded={createOpen} aria-controls="listening-create-panel">{createOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{t(createOpen ? 'listening.ui.collapseCreate' : 'listening.ui.createLesson')}</button>
    </header>

    <section id="listening-create-panel" hidden={!createOpen} className="listening-glass overflow-hidden" aria-label={t('listening.ui.createLesson')}>
      <div className="border-b border-[color:var(--border)] p-3 sm:p-4"><div className="flex gap-1 rounded-xl bg-[color:var(--bg-elevated)] p-1" role="tablist" aria-label={t('listening.ui.chooseSource')} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'video' : event.key === 'End' ? 'library' : createTab === 'video' ? 'library' : 'video'
        setCreateTab(next); document.getElementById(`listening-tab-${next}`)?.focus()
      }}>
        <button id="listening-tab-video" type="button" role="tab" aria-selected={createTab === 'video'} tabIndex={createTab === 'video' ? 0 : -1} aria-controls="listening-panel-video" className={`listening-tab ${createTab === 'video' ? 'is-active' : ''}`} onClick={() => setCreateTab('video')}><Youtube className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('listening.ui.fromVideo')}</span></button>
        <button id="listening-tab-library" type="button" role="tab" aria-selected={createTab === 'library'} tabIndex={createTab === 'library' ? 0 : -1} aria-controls="listening-panel-library" className={`listening-tab ${createTab === 'library' ? 'is-active' : ''}`} onClick={() => setCreateTab('library')}><BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t('listening.ui.fromLibrary')}</span></button>
      </div></div>
      <div className="p-4 sm:p-6">
        <div id="listening-panel-video" role="tabpanel" aria-labelledby="listening-tab-video" hidden={createTab !== 'video'}><VideoLessonCreator embedded /></div>
        <div id="listening-panel-library" role="tabpanel" aria-labelledby="listening-tab-library" hidden={createTab !== 'library'} className="space-y-5">
          <div><h2 className="text-base font-bold">{t('listening.createFromLibrary')}</h2><p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{t('listening.ui.libraryHint')}</p></div>
          <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold"><span>{t('listening.documentSearch')}</span><span className="relative block"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" /><input className="listening-input w-full pl-10" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={t('listening.documentSearchPlaceholder')} /></span></label><label className="space-y-2 text-sm font-semibold">{t('listening.document')}<select className="listening-input w-full" value={documentId} onChange={(event) => { setDocumentId(event.target.value ? Number(event.target.value) : ''); setDraft(null) }}><option value="">{t('listening.chooseDocument')}</option>{documents.map((document: any) => <option key={document.id} value={document.id}>{document.title} · {document.jlpt_level || '—'} · {t('listening.ui.wordCount', { count: wordCounts.get(document.id) || 0 })}</option>)}</select></label></div>
          {documentsQuery.isLoading && <p role="status" className="text-sm text-[color:var(--text-muted)]">{t('listening.ui.loadingDocuments')}</p>}
          {documentsQuery.isError && <div className="listening-notice" role="alert"><p>{t('listening.ui.documentError')}</p><button type="button" className="listening-secondary mt-2" onClick={() => void documentsQuery.refetch()}>{t('listening.retry')}</button></div>}
          {!documentsQuery.isLoading && !documentsQuery.isError && !documents.length && <p className="listening-notice">{t('listening.ui.noDocuments')}</p>}
          {selectedDocument && <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--listening-accent-text)]" aria-hidden="true" /><div className="min-w-0"><p className="break-words text-sm font-semibold">{selectedDocument.title}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="listening-badge">{selectedDocument.jlpt_level || '—'}</span><span className="text-xs text-[color:var(--text-muted)]">{t('listening.ui.wordCount', { count: wordCounts.get(selectedDocument.id) || 0 })}</span></div></div></div><p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-7 text-[color:var(--text-muted)]">{selectedDocument.content}</p></div>}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--border)] pt-4">{draftMutation.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('listening.libraryGenerateError')}</p>}<button type="button" disabled={!documentId || draftMutation.isLoading} onClick={() => draftMutation.mutate()} className="listening-action w-full sm:w-auto">{draftMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}{draftMutation.isLoading ? t('listening.generatingDraft') : t('listening.generateDraft')}</button></div>
          {draft && <div className="space-y-4 border-t border-[color:var(--border)] pt-5"><p className="listening-notice">{t('listening.reviewDraft')}</p><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold">{t('listening.draftTitle')}<input className="listening-input w-full" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="space-y-2 text-sm font-semibold">{t('listening.topic')}<input className="listening-input w-full" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label></div>
            <div className="space-y-3">{draft.segments.map((segment: any, index: number) => <div key={index} className="grid gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 sm:grid-cols-2"><label className="space-y-2 text-xs font-semibold">{t('listening.japanese')}<textarea className="listening-input listening-japanese min-h-20 w-full" value={segment.ja} onChange={(event) => setDraft({ ...draft, segments: draft.segments.map((item: any, i: number) => i === index ? { ...item, ja: event.target.value } : item) })} /></label><label className="space-y-2 text-xs font-semibold">{t('listening.vietnamese')}<textarea className="listening-input min-h-20 w-full" value={segment.vi} onChange={(event) => setDraft({ ...draft, segments: draft.segments.map((item: any, i: number) => i === index ? { ...item, vi: event.target.value } : item) })} /></label></div>)}</div>
            <div className="flex justify-end"><button type="button" disabled={saveMutation.isLoading} onClick={() => saveMutation.mutate()} className="listening-action"><Check className="h-4 w-4" aria-hidden="true" />{saveMutation.isLoading ? t('listening.savingDraft') : t('listening.saveDraft')}</button></div>
          </div>}
        </div>
      </div>
    </section>

    <section className="listening-glass space-y-4 p-4 sm:p-5" aria-labelledby="listening-library-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Headphones className="h-5 w-5 text-[color:var(--listening-accent-text)]" aria-hidden="true" /><h2 id="listening-library-heading" className="text-base font-bold">{t('listening.allLessons')}</h2></div><select aria-label={t('listening.source')} value={source} onChange={(event) => { setSource(event.target.value); setPage(0) }} className="listening-input max-w-full sm:max-w-56"><option value="">{t('listening.allLessons')}</option><option value="library">{t('listening.myLibraryLessons')}</option></select></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5" role="group" aria-label={t('listening.jlpt')}>{['', 'N5', 'N4', 'N3', 'N2', 'N1'].map(item => <button type="button" key={item} aria-pressed={level === item} className={`listening-level !px-3.5 ${level === item ? 'is-active' : ''}`} onClick={() => { setLevel(item); setPage(0) }}>{item || t('listening.ui.allLevels')}</button>)}</div><form className="w-full sm:w-auto sm:flex-1 sm:max-w-72" onSubmit={event => { event.preventDefault(); setPage(0) }}><label className="relative block"><span className="sr-only">{t('listening.search')}</span><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder={t('listening.search')} className="listening-input w-full pl-10" /></label></form></div>
      <details className="text-sm"><summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-medium text-[color:var(--text-muted)]">{t('listening.ui.topicFilter')}<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></summary><form onSubmit={event => { event.preventDefault(); setPage(0) }} className="mt-2 flex flex-wrap gap-2"><input aria-label={t('listening.topic')} value={topic} onChange={event => { setTopic(event.target.value); setPage(0) }} placeholder={t('listening.topic')} className="listening-input min-w-0 flex-1" /><button type="submit" className="listening-secondary">{t('listening.searchButton')}</button></form></details>
    </section>
    {query.isLoading ? <div role="status" className="listening-glass flex items-center justify-center gap-3 p-10 text-center text-[color:var(--text-muted)]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{t('listening.loading')}</div> : query.isError ? <div role="alert" className="listening-glass space-y-3 p-8 text-center"><p>{t('listening.loadError')}</p><button type="button" onClick={() => void query.refetch()} className="listening-secondary">{t('listening.retry')}</button></div> : lessons.length === 0 ? <div className="listening-glass space-y-3 p-10 text-center text-[color:var(--text-muted)]"><Headphones className="mx-auto h-8 w-8" aria-hidden="true" /><p>{t('listening.empty')}</p></div> : <div className="grid gap-4 md:grid-cols-2">{lessons.map(lesson => <ListeningLessonCard key={lesson.id} lesson={lesson} userId={user?.id} />)}</div>}
    {query.data && query.data.total > 12 && <div className="listening-glass flex flex-wrap items-center justify-center gap-3 p-4"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="listening-secondary">{t('listening.previous')}</button><span className="text-sm text-[color:var(--text-muted)]">{t('listening.page', { current: page + 1, total: totalPages })}</span><form onSubmit={(event) => { event.preventDefault(); const target = Number(pageInput); if (Number.isInteger(target) && target >= 1 && target <= totalPages) setPage(target - 1) }} className="flex items-center gap-2"><label htmlFor="listening-page-number" className="sr-only">{t('listening.pageInput')}</label><input id="listening-page-number" type="number" min="1" max={totalPages} step="1" value={pageInput} onChange={(event) => setPageInput(event.target.value)} aria-label={t('listening.pageInput')} className="listening-input w-16 px-2 text-center" /><button type="submit" className="listening-secondary">{t('listening.goToPage')}</button></form><button type="button" disabled={(page + 1) * 12 >= query.data.total} onClick={() => setPage((value) => value + 1)} className="listening-secondary">{t('listening.next')}</button></div>}
  </section>
}
