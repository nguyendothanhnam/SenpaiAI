import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownAZ,
  BookOpen,
  Calendar,
  Database,
  ExternalLink,
  FilePlus2,
  Layers3,
  Library as LibraryIcon,
  Pencil,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { libraryAPI } from '../services/api'
import { formatDate } from '../utils/helpers'

interface LibraryDocument {
  id: number
  title: string
  content: string
  document_type: string
  jlpt_level?: string | null
  tags: string[]
  source_url?: string | null
  created_at: string
  updated_at?: string | null
  embedding_id?: string | null
  chunk_index?: number | null
  relevance_score?: number | null
  indexing_warning?: string | null
}

interface DocumentListResponse {
  items: LibraryDocument[]
  total: number
  limit: number
  offset: number
}

interface SearchResponse {
  results: LibraryDocument[]
}

interface LibraryStats {
  total_documents: number
  document_types: Record<string, number> | number
  jlpt_levels: Record<string, number> | number
  vector_chunks: number
}

interface Categories {
  document_types: string[]
  jlpt_levels: string[]
}

const PAGE_SIZE = 12
const fallbackTypes = ['vocabulary', 'grammar', 'lesson', 'culture', 'example']
const fallbackJlpt = ['N5', 'N4', 'N3', 'N2', 'N1']

const emptyForm = {
  title: '',
  document_type: 'grammar',
  jlpt_level: '',
  tags: '',
  source_url: '',
  content: '',
}

type DocumentForm = typeof emptyForm

function parseTags(tags: string) {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function validateDocument(form: DocumentForm) {
  const errors: Partial<Record<keyof DocumentForm, string>> = {}
  if (!form.title.trim()) errors.title = 'Title is required'
  if (!form.document_type.trim()) errors.document_type = 'Document type is required'
  if (!form.content.trim()) errors.content = 'Content is required'
  if (form.source_url.trim()) {
    try {
      const parsed = new URL(form.source_url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Unsupported protocol')
      }
    } catch {
      errors.source_url = 'Source URL must start with http:// or https://'
    }
  }
  return { success: Object.keys(errors).length === 0, errors }
}

function buildPayload(form: DocumentForm) {
  return {
    title: form.title.trim(),
    document_type: form.document_type.trim(),
    jlpt_level: form.jlpt_level || null,
    tags: parseTags(form.tags),
    source_url: form.source_url.trim() || null,
    content: form.content.trim(),
  }
}

function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl border border-violet-100 bg-white/70" />
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: any; loading: boolean }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{label}</p>
          {loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-violet-100" /> : <p className="mt-2 text-3xl font-bold text-gray-950">{value.toLocaleString()}</p>}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}

function statCount(value: Record<string, number> | number | undefined) {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'gray' | 'amber' }) {
  const styles = {
    violet: 'bg-violet-50 text-violet-700',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full bg-white/90 p-2 text-gray-500 shadow-sm hover:text-gray-900">
          <X className="h-5 w-5" />
        </button>
        {children}
      </motion.div>
    </div>
  )
}

function DocumentFormModal({
  categories,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  categories?: Categories
  initial?: LibraryDocument | null
  saving: boolean
  onClose: () => void
  onSubmit: (payload: any) => void
}) {
  const [form, setForm] = useState<DocumentForm>(
    initial
      ? {
          title: initial.title,
          document_type: initial.document_type,
          jlpt_level: initial.jlpt_level || '',
          tags: initial.tags?.join(', ') || '',
          source_url: initial.source_url || '',
          content: initial.content,
        }
      : emptyForm
  )
  const [errors, setErrors] = useState<Partial<Record<keyof DocumentForm, string>>>({})
  const [fetchError, setFetchError] = useState('')
  const types = categories?.document_types?.length ? categories.document_types : fallbackTypes
  const levels = categories?.jlpt_levels?.length ? categories.jlpt_levels : fallbackJlpt
  const fetchUrlMutation = useMutation((url: string) => libraryAPI.fetchUrl(url), {
    onSuccess: (response) => {
      const data = response.data as { title: string; content: string; source_url: string }
      setForm((current) => ({
        ...current,
        title: current.title.trim() ? current.title : data.title,
        content: data.content,
      }))
      setErrors((current) => ({ ...current, source_url: undefined, content: undefined, title: undefined }))
      setFetchError('')
      toast.success('Page content fetched.')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail || 'Could not read that URL. Check the address and try again.'
      setFetchError(detail)
      toast.error(detail)
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = validateDocument(form)
    setErrors(result.errors)
    if (!result.success) return
    onSubmit(buildPayload(form))
  }

  const fetchFromUrl = () => {
    const sourceUrl = form.source_url.trim()
    setFetchError('')
    if (!sourceUrl) {
      setErrors((current) => ({ ...current, source_url: 'Enter a URL before fetching' }))
      return
    }
    try {
      const parsed = new URL(sourceUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Unsupported protocol')
      }
    } catch {
      setErrors((current) => ({ ...current, source_url: 'Source URL must start with http:// or https://' }))
      return
    }
    fetchUrlMutation.mutate(sourceUrl)
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <div className="pr-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{initial ? 'Edit document' : 'Add new document'}</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">{initial ? initial.title : 'Create library document'}</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">Title *</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input border-violet-200 focus:ring-violet-200" />
            {errors.title && <span className="text-xs font-semibold text-red-600">{errors.title}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">Document Type *</span>
            <select value={form.document_type} onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))} className="input border-violet-200 focus:ring-violet-200">
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">JLPT Level</span>
            <select value={form.jlpt_level} onChange={(event) => setForm((current) => ({ ...current, jlpt_level: event.target.value }))} className="input border-violet-200 focus:ring-violet-200">
              <option value="">No level</option>
              {levels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">Tags</span>
            <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="grammar, particles, n5" className="input border-violet-200 focus:ring-violet-200" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-bold text-gray-700">Source URL</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={form.source_url} onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="https://..." className="input min-w-0 flex-1 border-violet-200 focus:ring-violet-200" />
              <button
                type="button"
                onClick={fetchFromUrl}
                disabled={fetchUrlMutation.isLoading}
                className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-60"
              >
                {fetchUrlMutation.isLoading ? 'Fetching...' : 'Fetch from URL'}
              </button>
            </div>
            {errors.source_url && <span className="text-xs font-semibold text-red-600">{errors.source_url}</span>}
            {fetchError && <span className="text-xs font-semibold text-red-600">{fetchError}</span>}
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-bold text-gray-700">Content *</span>
          <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} rows={11} placeholder="Paste grammar notes, vocabulary explanations, examples, or lesson content..." className="input h-auto border-violet-200 font-japanese leading-7 focus:ring-violet-200" />
          {errors.content && <span className="text-xs font-semibold text-red-600">{errors.content}</span>}
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-outline rounded-xl border-gray-200 px-5">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary rounded-xl px-5 text-white disabled:opacity-60">
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Document'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Library() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ query: '', document_type: '', jlpt_level: '' })
  const [searchPayload, setSearchPayload] = useState({ query: '', document_type: '', jlpt_level: '' })
  const [sort, setSort] = useState<'newest' | 'relevance' | 'alphabetical'>('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<LibraryDocument | null>(null)
  const [editing, setEditing] = useState<LibraryDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LibraryDocument | null>(null)
  const offset = (page - 1) * PAGE_SIZE
  const hasSearch = Boolean(searchPayload.query.trim())

  const statsQuery = useQuery('libraryStats', () => libraryAPI.getStats().then((res) => res.data as LibraryStats), {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  })

  const categoriesQuery = useQuery('libraryCategories', () => libraryAPI.getCategories().then((res) => res.data as Categories), {
    refetchOnWindowFocus: false,
  })

  const documentsQuery = useQuery(
    ['libraryDocuments', filters.document_type, filters.jlpt_level, sort, page],
    () =>
      libraryAPI
        .getDocuments({
          document_type: filters.document_type || undefined,
          jlpt_level: filters.jlpt_level || undefined,
          sort,
          limit: PAGE_SIZE,
          offset,
        })
        .then((res) => res.data as DocumentListResponse),
    { enabled: !hasSearch, keepPreviousData: true, refetchOnWindowFocus: false }
  )

  const searchQuery = useQuery(
    ['librarySearch', searchPayload.query, searchPayload.document_type, searchPayload.jlpt_level, page],
    () =>
      libraryAPI
        .searchDocuments({
          query: searchPayload.query,
          document_type: searchPayload.document_type || null,
          jlpt_level: searchPayload.jlpt_level || null,
          limit: PAGE_SIZE,
          offset,
        })
        .then((res) => {
          const data = res.data as SearchResponse
          return { items: data.results, total: data.results.length, limit: PAGE_SIZE, offset } as DocumentListResponse
        }),
    {
      enabled: hasSearch,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      onError: () => toast.error('Failed to search documents'),
    }
  )

  useEffect(() => setPage(1), [searchPayload.query, searchPayload.document_type, searchPayload.jlpt_level, filters.document_type, filters.jlpt_level, sort])

  const createMutation = useMutation((payload: any) => libraryAPI.createDocument(payload), {
    onSuccess: (response) => {
      queryClient.invalidateQueries('libraryStats')
      queryClient.invalidateQueries('libraryCategories')
      queryClient.invalidateQueries('libraryDocuments')
      queryClient.invalidateQueries('librarySearch')
      setFormOpen(false)
      if (response.data?.indexing_warning) {
        toast(response.data.indexing_warning)
      } else {
        toast.success('Document added successfully.')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save document')
    },
  })

  const updateMutation = useMutation(({ id, payload }: { id: number; payload: any }) => libraryAPI.updateDocument(id, payload), {
    onSuccess: (response) => {
      queryClient.invalidateQueries('libraryStats')
      queryClient.invalidateQueries('libraryCategories')
      queryClient.invalidateQueries('libraryDocuments')
      queryClient.invalidateQueries('librarySearch')
      setSelected(response.data)
      setEditing(null)
      if (response.data?.indexing_warning) {
        toast(response.data.indexing_warning)
      } else {
        toast.success('Document updated successfully')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save document')
    },
  })

  const deleteMutation = useMutation((id: number) => libraryAPI.deleteDocument(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('libraryStats')
      queryClient.invalidateQueries('libraryCategories')
      queryClient.invalidateQueries('libraryDocuments')
      queryClient.invalidateQueries('librarySearch')
      setSelected(null)
      setDeleteTarget(null)
      toast.success('Document deleted')
    },
    onError: () => {
      toast.error('Failed to delete document')
    },
  })

  const activeData = hasSearch ? searchQuery.data : documentsQuery.data
  const loading = hasSearch ? searchQuery.isLoading || searchQuery.isFetching : documentsQuery.isLoading || documentsQuery.isFetching
  const errored = hasSearch ? searchQuery.isError : documentsQuery.isError
  const documents = useMemo(() => {
    const items = activeData?.items || []
    if (sort !== 'relevance' || !hasSearch) return items
    return [...items].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
  }, [activeData?.items, hasSearch, sort])
  const total = activeData?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const types = categoriesQuery.data?.document_types?.length ? fallbackTypes.filter((type) => categoriesQuery.data?.document_types.includes(type)) : fallbackTypes
  const levels = categoriesQuery.data?.jlpt_levels?.length ? categoriesQuery.data.jlpt_levels : fallbackJlpt

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-violet-200">
            <LibraryIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-950">JLPT Document Library</h1>
            <p className="mt-1 text-sm text-gray-600">Search, manage, and index Japanese learning material with semantic retrieval.</p>
          </div>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="btn btn-primary rounded-xl px-5 py-3 text-white shadow-md shadow-violet-200">
          <FilePlus2 className="mr-2 h-4 w-4" />
          Add New Document
        </button>
      </div>

      {statsQuery.isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">Unable to load library statistics.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Documents" value={statsQuery.data?.total_documents || 0} icon={BookOpen} loading={statsQuery.isLoading} />
          <StatCard label="Document Types" value={statCount(statsQuery.data?.document_types)} icon={Layers3} loading={statsQuery.isLoading} />
          <StatCard label="JLPT Levels" value={statCount(statsQuery.data?.jlpt_levels)} icon={Tags} loading={statsQuery.isLoading} />
          <StatCard label="Vector Chunks" value={statsQuery.data?.vector_chunks || 0} icon={Database} loading={statsQuery.isLoading} />
        </div>
      )}

      <div className="rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px_150px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500" />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search documents by meaning or keyword..." className="input w-full border-violet-200 bg-violet-50/60 pl-10 focus:ring-violet-200" />
          </div>
          <select value={filters.document_type} onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))} className="input border-violet-200 bg-violet-50/60">
            <option value="">All Types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={filters.jlpt_level} onChange={(event) => setFilters((current) => ({ ...current, jlpt_level: event.target.value }))} className="input border-violet-200 bg-violet-50/60">
            <option value="">All Levels</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="input border-violet-200 bg-violet-50/60">
            <option value="newest">newest</option>
            <option value="relevance">relevance</option>
            <option value="alphabetical">alphabetical</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (filters.query.trim()) {
                setSearchPayload({
                  query: filters.query.trim(),
                  document_type: filters.document_type,
                  jlpt_level: filters.jlpt_level,
                })
              } else {
                toast.error('Enter a query before searching')
              }
            }}
            className="btn btn-primary rounded-xl px-4 text-white"
          >
            <Search className="mr-2 h-4 w-4" />
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({ query: '', document_type: '', jlpt_level: '' })
              setSearchPayload({ query: '', document_type: '', jlpt_level: '' })
              setPage(1)
            }}
            className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700"
          >
            Clear Search
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950">{hasSearch ? 'Semantic Search Results' : 'Document Grid'}</h2>
            <p className="mt-1 text-sm text-gray-500">{total} document{total === 1 ? '' : 's'} found</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm">
            <ArrowDownAZ className="h-4 w-4 text-violet-500" />
            {sort}
          </div>
        </div>

        {errored ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
            <AlertTriangle className="mx-auto h-8 w-8" />
            <p className="mt-3 font-bold">Unable to load documents</p>
          </div>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-violet-100 bg-white p-10 text-center text-gray-500 shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-violet-300" />
            <p className="mt-3 font-semibold">No documents found</p>
            <p className="mt-1 text-sm">Add a document or adjust your search filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <motion.article key={document.id} whileHover={{ y: -4 }} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                <button type="button" onClick={() => setSelected(document)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold leading-6 text-gray-950">{document.title}</h3>
                    {document.source_url && (
                      <a href={document.source_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-violet-50 hover:text-violet-700">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{document.document_type}</Badge>
                    {document.jlpt_level && <Badge tone="amber">{document.jlpt_level}</Badge>}
                    {document.relevance_score !== undefined && document.relevance_score !== null && <Badge tone="gray">{Math.round(document.relevance_score * 100)}% relevant</Badge>}
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-700">{(document as any).content_preview || document.content.slice(0, 150)}{document.content.length > 150 ? '...' : ''}</p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.tags?.slice(0, 4).map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.created_at)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelected(document)} className="btn btn-outline rounded-xl border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">
                    View Detail
                  </button>
                  <button type="button" onClick={() => setEditing(document)} className="btn btn-outline rounded-xl border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(document)} className="btn btn-outline rounded-xl border-red-200 px-3 py-2 text-xs font-bold text-red-600">
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-40">Previous</button>
            <span className="text-sm font-bold text-gray-600">Page {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-40">Next</button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {formOpen && (
          <DocumentFormModal
            categories={categoriesQuery.data}
            saving={createMutation.isLoading}
            onClose={() => setFormOpen(false)}
            onSubmit={(payload) => createMutation.mutate(payload)}
          />
        )}
        {editing && (
          <DocumentFormModal
            initial={editing}
            categories={categoriesQuery.data}
            saving={updateMutation.isLoading}
            onClose={() => setEditing(null)}
            onSubmit={(payload) => updateMutation.mutate({ id: editing.id, payload })}
          />
        )}
        {selected && (
          <Modal onClose={() => setSelected(null)}>
            <div className="p-6">
              <div className="pr-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Document detail</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-950">{selected.title}</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{selected.document_type}</Badge>
                {selected.jlpt_level && <Badge tone="amber">{selected.jlpt_level}</Badge>}
                {selected.tags?.map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}
              </div>
              {selected.source_url && (
                <a href={selected.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:text-violet-900">
                  <ExternalLink className="h-4 w-4" />
                  Source URL
                </a>
              )}
              <p className="mt-4 text-xs font-semibold text-gray-500">Created {formatDate(selected.created_at)}</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">Updated {selected.updated_at ? formatDate(selected.updated_at) : 'Not updated yet'}</p>
              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="whitespace-pre-wrap font-japanese text-sm leading-7 text-gray-800">{selected.content}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="btn btn-outline rounded-xl border-gray-200 px-4">
                  Close
                </button>
                <button type="button" onClick={() => setEditing(selected)} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteTarget(selected)} className="btn btn-outline rounded-xl border-red-200 px-4 text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
        {deleteTarget && (
          <Modal onClose={() => setDeleteTarget(null)}>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="pr-10">
                  <h2 className="text-xl font-bold text-gray-950">Delete document?</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">This removes the PostgreSQL record and all ChromaDB vector chunks for "{deleteTarget.title}".</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-outline rounded-xl border-gray-200 px-4">Cancel</button>
                <button type="button" disabled={deleteMutation.isLoading} onClick={() => deleteMutation.mutate(deleteTarget.id)} className="btn rounded-xl bg-red-600 px-4 text-white hover:bg-red-700 disabled:opacity-60">
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
