import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownAZ,
  BookOpen,
  Brain,
  Calendar,
  Copy,
  Database,
  ExternalLink,
  FilePlus2,
  Layers3,
  Library as LibraryIcon,
  Headphones,
  Pencil,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { grammarPracticeAPI, libraryAPI, listeningAPI, type GrammarQuestionType, type JlptLevel } from '../services/api'
import { useAuth } from '../services/auth'
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
  scope?: 'system' | 'personal'
  is_mine?: boolean
  can_edit?: boolean
  can_delete?: boolean
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
const DOCUMENT_TYPE_LABELS = {
  vocabulary: 'library.documentTypes.vocabulary',
  grammar: 'library.documentTypes.grammar',
  lesson: 'library.documentTypes.lesson',
  culture: 'library.documentTypes.culture',
  example: 'library.documentTypes.example',
} as const
const SORT_LABELS = {
  newest: 'library.sortOptions.newest',
  relevance: 'library.sortOptions.relevance',
  alphabetical: 'library.sortOptions.alphabetical',
} as const

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

function validateDocument(form: DocumentForm, t: ReturnType<typeof useTranslation>['t']) {
  const errors: Partial<Record<keyof DocumentForm, string>> = {}
  if (!form.title.trim()) errors.title = t('library.validation.titleRequired')
  if (!form.document_type.trim()) errors.document_type = t('library.validation.typeRequired')
  if (!form.content.trim()) errors.content = t('library.validation.contentRequired')
  if (form.source_url.trim()) {
    try {
      const parsed = new URL(form.source_url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported-protocol')
      }
    } catch {
      errors.source_url = t('library.validation.sourceUrlInvalid')
    }
  }
  return { success: Object.keys(errors).length === 0, errors }
}

function documentTypeLabel(type: string, t: ReturnType<typeof useTranslation>['t']) {
  const key = DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS]
  return key ? t(key) : type
}

function sortLabel(sort: keyof typeof SORT_LABELS, t: ReturnType<typeof useTranslation>['t']) {
  return t(SORT_LABELS[sort])
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

function libraryGenerationErrorKey(error: any, t: ReturnType<typeof useTranslation>['t']) {
  const status = error?.response?.status
  const detail = String(error?.response?.data?.detail || '').toLowerCase()
  if (status === 429 || /rate|limit/.test(detail)) return t('library.generationRateLimit')
  if (status === 413) return t('library.documentTooLong')
  if (status === 422 || /short|content/.test(detail)) return t('library.documentTooShort')
  return t('library.generationError')
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

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'gray' | 'amber' }) {
  const styles = {
    violet: 'bg-violet-50 text-violet-700',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="relative max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-[color:var(--bg-elevated)] text-[color:var(--text)] shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full bg-[color:var(--bg-elevated)] p-2 text-[color:var(--text-muted)] shadow-sm hover:text-[color:var(--text)]">
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
  allowSystemScope,
  t,
}: {
  categories?: Categories
  initial?: LibraryDocument | null
  saving: boolean
  onClose: () => void
  onSubmit: Function
  allowSystemScope: boolean
  t: ReturnType<typeof useTranslation>['t']
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
  const [scope, setScope] = useState<'personal' | 'system'>(initial?.scope === 'system' ? 'system' : 'personal')
  const [fetchError, setFetchError] = useState('')
  const [showPromptTemplate, setShowPromptTemplate] = useState(false)
  const types = categories?.document_types?.length ? categories.document_types : fallbackTypes
  const levels = categories?.jlpt_levels?.length ? categories.jlpt_levels : fallbackJlpt
  const promptOutline = t(`library.promptOutlines.${form.document_type}`, { defaultValue: t('library.promptOutlines.default') })
  const promptText = t('library.promptText', {
    type: documentTypeLabel(form.document_type, t),
    level: form.jlpt_level || t('library.promptAnyLevel'),
    outline: promptOutline,
  })
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
      toast.success(t('library.pageContentFetched'))
    },
    onError: () => {
      const message = t('library.fetchUrlError')
      setFetchError(message)
      toast.error(message)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateDocument(form, t)
    setErrors(result.errors)
    if (!result.success) return
    onSubmit(initial ? buildPayload(form) : { ...buildPayload(form), scope })
  }

  const fetchFromUrl = () => {
    const sourceUrl = form.source_url.trim()
    setFetchError('')
    if (!sourceUrl) {
      setErrors((current) => ({ ...current, source_url: t('library.validation.urlRequired') }))
      return
    }
    try {
      const parsed = new URL(sourceUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported-protocol')
      }
    } catch {
      setErrors((current) => ({ ...current, source_url: t('library.validation.sourceUrlInvalid') }))
      return
    }
    fetchUrlMutation.mutate(sourceUrl)
  }

  const copyPromptTemplate = async () => {
    try {
      await navigator.clipboard.writeText(promptText)
      toast.success(t('library.promptCopied'))
    } catch {
      toast.error(t('library.promptCopyError'))
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="p-6">
        <div className="pr-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{initial ? t('library.editDocument') : t('library.addNewDocument')}</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">{initial ? initial.title : t('library.createDocument')}</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {!initial && (
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-bold text-gray-700">{t('library.scope.label')}</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as 'personal' | 'system')} className="input border-violet-200 focus:ring-violet-200">
                <option value="personal">{t('library.badge.personal')}</option>
                {allowSystemScope && <option value="system">{t('library.badge.system')}</option>}
              </select>
              <span className="block text-xs text-gray-500">{t('library.privateNote')}</span>
            </label>
          )}
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.title')} *</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input border-violet-200 focus:ring-violet-200" />
            {errors.title && <span className="text-xs font-semibold text-red-600">{errors.title}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.documentType')} *</span>
            <select value={form.document_type} onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))} className="input border-violet-200 focus:ring-violet-200">
              {types.map((type) => (
                <option key={type} value={type}>{documentTypeLabel(type, t)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.jlptLevel')}</span>
            <select value={form.jlpt_level} onChange={(event) => setForm((current) => ({ ...current, jlpt_level: event.target.value }))} className="input border-violet-200 focus:ring-violet-200">
              <option value="">{t('library.noLevel')}</option>
              {levels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.tags')}</span>
            <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder={t('library.tagsPlaceholder')} className="input border-violet-200 focus:ring-violet-200" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.sourceUrl')}</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={form.source_url} onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="https://..." className="input min-w-0 flex-1 border-violet-200 focus:ring-violet-200" />
              <button
                type="button"
                onClick={fetchFromUrl}
                disabled={fetchUrlMutation.isLoading}
                className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-60"
              >
                {fetchUrlMutation.isLoading ? t('library.fetching') : t('library.fetchFromUrl')}
              </button>
            </div>
            {errors.source_url && <span className="text-xs font-semibold text-red-600">{errors.source_url}</span>}
            {fetchError && <span className="text-xs font-semibold text-red-600">{fetchError}</span>}
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-gray-700">{t('library.fields.content')} *</span>
            {!initial && <button type="button" aria-expanded={showPromptTemplate} onClick={() => setShowPromptTemplate((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--accent)]"><Copy className="h-3.5 w-3.5" />{t('library.promptTemplate')}</button>}
          </span>
          {showPromptTemplate && <div className="space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3">
            <p className="text-xs text-[color:var(--text-muted)]">{t('library.promptTemplateHelp')}</p>
            <textarea readOnly value={promptText} rows={7} className="input h-auto w-full font-mono text-xs leading-5" aria-label={t('library.promptTemplate')} />
            <button type="button" onClick={() => void copyPromptTemplate()} className="btn btn-outline rounded-lg px-3 py-1.5 text-xs"><Copy className="mr-1.5 h-3.5 w-3.5" />{t('library.copyPrompt')}</button>
          </div>}
          <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} rows={11} placeholder={t('library.contentPlaceholder')} className="input h-auto border-violet-200 font-japanese leading-7 focus:ring-violet-200" />
          {errors.content && <span className="text-xs font-semibold text-red-600">{errors.content}</span>}
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-outline rounded-xl border-gray-200 px-5">{t('library.cancel')}</button>
          <button type="submit" disabled={saving} className="btn btn-primary rounded-xl px-5 text-white disabled:opacity-60">
            {saving ? t('library.saving') : initial ? t('library.saveChanges') : t('library.addDocument')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Library() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ query: '', document_type: '', jlpt_level: '' })
  const [searchPayload, setSearchPayload] = useState({ query: '', document_type: '', jlpt_level: '' })
  const [sort, setSort] = useState<'newest' | 'relevance' | 'alphabetical'>('newest')
  const [scope, setScope] = useState<'all' | 'mine' | 'system'>('all')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [selected, setSelected] = useState<LibraryDocument | null>(null)
  const [editing, setEditing] = useState<LibraryDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LibraryDocument | null>(null)
  const [actionDocument, setActionDocument] = useState<LibraryDocument | null>(null)
  const [actionKind, setActionKind] = useState<'grammar' | 'listening' | null>(null)
  const [questionType, setQuestionType] = useState<GrammarQuestionType>('fill_blank')
  const [questionCount, setQuestionCount] = useState(5)
  const [grammarResult, setGrammarResult] = useState<{ requested: number; saved: number; rejected: number; limited: boolean; question_ids: number[] } | null>(null)
  const [listeningDraft, setListeningDraft] = useState<any>(null)
  const [actionError, setActionError] = useState('')
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
    ['libraryDocuments', filters.document_type, filters.jlpt_level, sort, scope, page],
    () =>
      libraryAPI
        .getDocuments({
          document_type: filters.document_type || undefined,
          jlpt_level: filters.jlpt_level || undefined,
          sort,
          scope,
          limit: PAGE_SIZE,
          offset,
        })
        .then((res) => res.data as DocumentListResponse),
    { enabled: !hasSearch, keepPreviousData: true, refetchOnWindowFocus: false }
  )

  const searchQuery = useQuery(
    ['librarySearch', searchPayload.query, searchPayload.document_type, searchPayload.jlpt_level, scope, page],
    () =>
      libraryAPI
        .searchDocuments({
          query: searchPayload.query,
          document_type: searchPayload.document_type || null,
          jlpt_level: searchPayload.jlpt_level || null,
          scope,
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
      onError: () => toast.error(t('library.searchError')),
    }
  )

  useEffect(() => setPage(1), [searchPayload.query, searchPayload.document_type, searchPayload.jlpt_level, filters.document_type, filters.jlpt_level, sort, scope])

  const canEditDocument = (document: LibraryDocument) => document.can_edit ?? document.is_mine === true
  const canDeleteDocument = (document: LibraryDocument) => document.can_delete ?? document.is_mine === true
  const isSystemDocument = (document: LibraryDocument) =>
    document.scope === 'system' ? true : document.scope === 'personal' || document.is_mine === true ? false : null
  const canUseDocument = (document: LibraryDocument) =>
    isSystemDocument(document) === true || (isSystemDocument(document) === false && canEditDocument(document))

  const grammarGenerationMutation = useMutation(
    (document: LibraryDocument) => grammarPracticeAPI.generateFromLibrary({
      document_id: document.id,
      jlpt_level: (document.jlpt_level || user?.current_jlpt_level || 'N5') as JlptLevel,
      question_type: questionType,
      count: questionCount,
    }).then(({ data }) => data),
    {
      onSuccess: (result) => {
        setGrammarResult(result)
        setActionError(result.limited && result.saved === 0 ? t('library.generationRateLimit') : result.saved === 0 ? t('library.noQuestionsGenerated') : '')
      },
      onError: (error: any) => setActionError(libraryGenerationErrorKey(error, t)),
    },
  )

  const listeningDraftMutation = useMutation(
    (documentId: number) => listeningAPI.createFromLibraryDraft({ document_id: documentId }).then(({ data }) => data),
    {
      onSuccess: (draft) => { setListeningDraft(draft); setActionError('') },
      onError: (error: any) => setActionError(libraryGenerationErrorKey(error, t)),
    },
  )

  const listeningSaveMutation = useMutation(
    (payload: { document_id: number; title: string; description: string; jlpt_level: string; topic: string; segments: Array<{ ja: string; vi: string }> }) =>
      listeningAPI.saveFromLibrary(payload).then(({ data }) => data),
    {
      onSuccess: (lesson) => {
        setActionKind(null)
        setActionDocument(null)
        setListeningDraft(null)
        toast.success(t('library.lessonSaved'))
        navigate(`/listening/${lesson.id}`)
      },
      onError: () => setActionError(t('library.lessonSaveError')),
    },
  )

  const showSaveError = (error: any) => {
    const status = error.response?.status
    const detail = String(error.response?.data?.detail || '').toLowerCase()
    if (status === 413 || (status === 400 && /limit|maximum|too long|exceed/.test(detail))) {
      toast.error(t('library.limitError'))
    } else {
      toast.error(t('library.saveError'))
    }
  }

  const createMutation = useMutation((payload: any) => libraryAPI.createDocument(payload), {
    onSuccess: (response) => {
      queryClient.invalidateQueries('libraryStats')
      queryClient.invalidateQueries('libraryCategories')
      queryClient.invalidateQueries('libraryDocuments')
      queryClient.invalidateQueries('librarySearch')
      setFormOpen(false)
      if (response.data?.indexing_warning) {
        toast(t('library.indexingWarning'))
      } else {
        toast.success(t('library.documentAdded'))
      }
    },
    onError: (error: any) => {
      showSaveError(error)
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
        toast(t('library.indexingWarning'))
      } else {
        toast.success(t('library.documentUpdated'))
      }
    },
    onError: (error: any) => {
      showSaveError(error)
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
      toast.success(t('library.documentDeleted'))
    },
    onError: () => {
      toast.error(t('library.deleteError'))
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
  useEffect(() => setPageInput(String(page)), [page])
  const types = categoriesQuery.data?.document_types?.length ? fallbackTypes.filter((type) => categoriesQuery.data?.document_types.includes(type)) : fallbackTypes
  const levels = categoriesQuery.data?.jlpt_levels?.length ? categoriesQuery.data.jlpt_levels : fallbackJlpt

  const openGeneration = (document: LibraryDocument, kind: 'grammar' | 'listening') => {
    setActionDocument(document)
    setActionKind(kind)
    setGrammarResult(null)
    setListeningDraft(null)
    setActionError('')
    setQuestionType('fill_blank')
    setQuestionCount(5)
    if (kind === 'listening') listeningDraftMutation.mutate(document.id)
  }

  const closeGeneration = () => {
    if (grammarGenerationMutation.isLoading || listeningDraftMutation.isLoading || listeningSaveMutation.isLoading) return
    setActionKind(null)
    setActionDocument(null)
    setGrammarResult(null)
    setListeningDraft(null)
    setActionError('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="theme-brand-mark grid h-12 w-12 place-items-center rounded-2xl">
            <LibraryIcon className="h-6 w-6 text-[color:var(--primary-contrast)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-950">{t('library.pageTitle')}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('library.pageSubtitle')}</p>
          </div>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="btn btn-primary rounded-xl px-5 py-3 shadow-md">
          <FilePlus2 className="mr-2 h-4 w-4" />
          {t('library.addNewDocument')}
        </button>
      </div>

      {statsQuery.isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{t('library.statsError')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('library.stats.totalDocuments')} value={statsQuery.data?.total_documents || 0} icon={BookOpen} loading={statsQuery.isLoading} />
          <StatCard label={t('library.stats.documentTypes')} value={statCount(statsQuery.data?.document_types)} icon={Layers3} loading={statsQuery.isLoading} />
          <StatCard label={t('library.stats.jlptLevels')} value={statCount(statsQuery.data?.jlpt_levels)} icon={Tags} loading={statsQuery.isLoading} />
          <StatCard label={t('library.stats.vectorChunks')} value={statsQuery.data?.vector_chunks || 0} icon={Database} loading={statsQuery.isLoading} />
        </div>
      )}

      <div className="rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px_150px_170px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500" />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={t('library.searchPlaceholder')} className="input w-full border-violet-200 bg-violet-50/60 pl-10 focus:ring-violet-200" />
          </div>
          <select value={filters.document_type} onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))} className="input border-violet-200 bg-violet-50/60">
            <option value="">{t('library.allTypes')}</option>
            {types.map((type) => <option key={type} value={type}>{documentTypeLabel(type, t)}</option>)}
          </select>
          <select value={filters.jlpt_level} onChange={(event) => setFilters((current) => ({ ...current, jlpt_level: event.target.value }))} className="input border-violet-200 bg-violet-50/60">
            <option value="">{t('library.allLevels')}</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="input border-violet-200 bg-violet-50/60">
            {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((value) => <option key={value} value={value}>{sortLabel(value, t)}</option>)}
          </select>
          <select aria-label={t('library.scope.label')} value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="input border-violet-200 bg-violet-50/60">
            <option value="all">{t('library.scope.all')}</option>
            <option value="mine">{t('library.scope.mine')}</option>
            <option value="system">{t('library.scope.system')}</option>
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
                toast.error(t('library.searchRequired'))
              }
            }}
            className="btn btn-primary rounded-xl px-4 text-white"
          >
            <Search className="mr-2 h-4 w-4" />
            {t('library.search')}
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
            {t('library.clearSearch')}
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950">{hasSearch ? t('library.searchResults') : t('library.documentGrid')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('library.documentCount', { count: total })}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm">
            <ArrowDownAZ className="h-4 w-4 text-violet-500" />
            {sortLabel(sort, t)}
          </div>
        </div>

        {errored ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
            <AlertTriangle className="mx-auto h-8 w-8" />
            <p className="mt-3 font-bold">{t('library.documentsLoadError')}</p>
          </div>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-violet-100 bg-white p-10 text-center text-gray-500 shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-violet-300" />
            <p className="mt-3 font-semibold">{t('library.noDocuments')}</p>
            <p className="mt-1 text-sm">{t('library.emptyHint')}</p>
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
                    <Badge>{documentTypeLabel(document.document_type, t)}</Badge>
                    {isSystemDocument(document) !== null && <Badge tone={isSystemDocument(document) ? 'gray' : 'violet'}>{isSystemDocument(document) ? t('library.badge.system') : t('library.badge.personal')}</Badge>}
                    {document.jlpt_level && <Badge tone="amber">{document.jlpt_level}</Badge>}
                    {document.relevance_score !== undefined && document.relevance_score !== null && <Badge tone="gray">{t('library.relevanceScore', { score: Math.round(document.relevance_score * 100) })}</Badge>}
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
                    {t('library.viewDetail')}
                  </button>
                  {canEditDocument(document) && <button type="button" onClick={() => setEditing(document)} className="btn btn-outline rounded-xl border-violet-200 px-3 py-2 text-xs font-bold text-violet-700">
                    <Pencil className="mr-1 h-3.5 w-3.5" /> {t('library.edit')}
                  </button>}
                  {canDeleteDocument(document) && <button type="button" onClick={() => setDeleteTarget(document)} className="btn btn-outline rounded-xl border-red-200 px-3 py-2 text-xs font-bold text-red-600">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> {t('library.delete')}
                  </button>}
                </div>
                {canUseDocument(document) && <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={grammarGenerationMutation.isLoading || listeningDraftMutation.isLoading || listeningSaveMutation.isLoading} onClick={() => openGeneration(document, 'grammar')} className="btn btn-outline inline-flex items-center justify-center gap-1.5 rounded-xl border-violet-200 px-2 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">
                    <Brain className="h-3.5 w-3.5 shrink-0" />{t('library.createGrammarQuestions')}
                  </button>
                  <button type="button" disabled={grammarGenerationMutation.isLoading || listeningDraftMutation.isLoading || listeningSaveMutation.isLoading} onClick={() => openGeneration(document, 'listening')} className="btn btn-outline inline-flex items-center justify-center gap-1.5 rounded-xl border-violet-200 px-2 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">
                    <Headphones className="h-3.5 w-3.5 shrink-0" />{t('library.createListeningLesson')}
                  </button>
                </div>}
              </motion.article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-40">{t('library.previous')}</button>
            <span className="text-sm font-bold text-gray-600">{t('library.page', { current: page, total: totalPages })}</span>
            <form onSubmit={(event) => { event.preventDefault(); const target = Number(pageInput); if (Number.isInteger(target) && target >= 1 && target <= totalPages) setPage(target) }} className="flex items-center gap-2">
              <label htmlFor="library-page-number" className="sr-only">{t('library.pageInput')}</label>
              <input id="library-page-number" type="number" min="1" max={totalPages} step="1" value={pageInput} onChange={(event) => setPageInput(event.target.value)} aria-label={t('library.pageInput')} className="input w-16 px-2 text-center" />
              <button type="submit" className="btn btn-outline rounded-xl">{t('library.goToPage')}</button>
            </form>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700 disabled:opacity-40">{t('library.next')}</button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {formOpen && (
          <DocumentFormModal
            categories={categoriesQuery.data}
            saving={createMutation.isLoading}
            allowSystemScope={user?.is_library_admin === true}
            t={t}
            onClose={() => setFormOpen(false)}
            onSubmit={(payload: any) => createMutation.mutate(payload)}
          />
        )}
        {editing && (
          <DocumentFormModal
            initial={editing}
            categories={categoriesQuery.data}
            saving={updateMutation.isLoading}
            allowSystemScope={user?.is_library_admin === true}
            t={t}
            onClose={() => setEditing(null)}
            onSubmit={(payload: any) => updateMutation.mutate({ id: editing.id, payload })}
          />
        )}
        {actionKind && actionDocument && (
          <Modal onClose={closeGeneration}>
            <div className="space-y-5 p-6">
              <div className="pr-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">{actionKind === 'grammar' ? t('library.grammarDialogTitle') : t('library.listeningDialogTitle')}</p>
                <h2 className="mt-2 text-2xl font-bold">{actionDocument.title}</h2>
              </div>

              {actionKind === 'grammar' ? <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-semibold">{t('library.questionType')}
                    <select value={questionType} onChange={(event) => setQuestionType(event.target.value as GrammarQuestionType)} className="input w-full">
                      <option value="fill_blank">{t('library.types.fill_blank')}</option>
                      <option value="reorder">{t('library.types.reorder')}</option>
                      <option value="true_false">{t('library.types.true_false')}</option>
                      <option value="conjugation">{t('library.types.conjugation')}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold">{t('library.questionCount')}
                    <select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="input w-full">
                      {[1, 3, 5, 10, 15, 20].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                </div>
                {grammarResult && <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 text-sm">
                  <p className="font-bold">{t('library.generationResult', { saved: grammarResult.saved, rejected: grammarResult.rejected })}</p>
                  {grammarResult.saved > 0 && <button type="button" onClick={() => navigate('/grammar/practice')} className="btn btn-primary mt-3 rounded-xl px-4 py-2 text-sm">{t('library.goToPractice')}</button>}
                </div>}
                {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={closeGeneration} disabled={grammarGenerationMutation.isLoading} className="btn btn-outline rounded-xl px-4">{t('library.close')}</button>
                  <button type="button" disabled={grammarGenerationMutation.isLoading} onClick={() => { setActionError(''); setGrammarResult(null); grammarGenerationMutation.mutate(actionDocument) }} className="btn btn-primary rounded-xl px-4 disabled:opacity-60">
                    {grammarGenerationMutation.isLoading ? t('library.generatingQuestions') : t('library.generateQuestions')}
                  </button>
                </div>
              </> : <>
                <p className="text-sm text-[color:var(--text-muted)]">{t('library.listeningDraftHelp')}</p>
                {listeningDraftMutation.isLoading && <p className="rounded-xl bg-[color:var(--accent)] p-4 text-sm font-semibold">{t('library.generatingDraft')}</p>}
                {listeningDraft && <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1 text-sm font-semibold">{t('library.lessonTitle')}<input value={listeningDraft.title} onChange={(event) => setListeningDraft({ ...listeningDraft, title: event.target.value })} className="input w-full" /></label>
                    <label className="space-y-1 text-sm font-semibold">{t('library.lessonTopic')}<input value={listeningDraft.topic} onChange={(event) => setListeningDraft({ ...listeningDraft, topic: event.target.value })} className="input w-full" /></label>
                  </div>
                  <div className="max-h-[38vh] space-y-3 overflow-y-auto pr-1">
                    {listeningDraft.segments.map((segment: { ja: string; vi: string }, index: number) => <div key={index} className="grid gap-3 rounded-xl border border-[color:var(--border)] p-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm font-semibold">{t('library.japaneseLine', { number: index + 1 })}<textarea value={segment.ja} onChange={(event) => setListeningDraft({ ...listeningDraft, segments: listeningDraft.segments.map((line: { ja: string; vi: string }, lineIndex: number) => lineIndex === index ? { ...line, ja: event.target.value } : line) })} rows={2} className="input h-auto w-full" /></label>
                      <label className="space-y-1 text-sm font-semibold">{t('library.vietnameseLine', { number: index + 1 })}<textarea value={segment.vi} onChange={(event) => setListeningDraft({ ...listeningDraft, segments: listeningDraft.segments.map((line: { ja: string; vi: string }, lineIndex: number) => lineIndex === index ? { ...line, vi: event.target.value } : line) })} rows={2} className="input h-auto w-full" /></label>
                    </div>)}
                  </div>
                </div>}
                {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={closeGeneration} disabled={listeningDraftMutation.isLoading || listeningSaveMutation.isLoading} className="btn btn-outline rounded-xl px-4">{t('library.close')}</button>
                  {listeningDraft && <button type="button" disabled={listeningSaveMutation.isLoading} onClick={() => {
                    setActionError('')
                    listeningSaveMutation.mutate({
                      document_id: actionDocument.id,
                      title: listeningDraft.title,
                      description: listeningDraft.description || '',
                      jlpt_level: listeningDraft.jlpt_level,
                      topic: listeningDraft.topic,
                      segments: listeningDraft.segments.map((line: { ja: string; vi: string }) => ({ ja: line.ja, vi: line.vi })),
                    })
                  }} className="btn btn-primary rounded-xl px-4 disabled:opacity-60">
                    {listeningSaveMutation.isLoading ? t('library.savingLesson') : t('library.saveLesson')}
                  </button>}
                </div>
              </>}
            </div>
          </Modal>
        )}
        {selected && (
          <Modal onClose={() => setSelected(null)}>
            <div className="p-6">
              <div className="pr-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{t('library.documentDetail')}</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-950">{selected.title}</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{documentTypeLabel(selected.document_type, t)}</Badge>
                {isSystemDocument(selected) !== null && <Badge tone={isSystemDocument(selected) ? 'gray' : 'violet'}>{isSystemDocument(selected) ? t('library.badge.system') : t('library.badge.personal')}</Badge>}
                {selected.jlpt_level && <Badge tone="amber">{selected.jlpt_level}</Badge>}
                {selected.tags?.map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}
              </div>
              {selected.source_url && (
                <a href={selected.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:text-violet-900">
                  <ExternalLink className="h-4 w-4" />
                  {t('library.fields.sourceUrl')}
                </a>
              )}
              <p className="mt-4 text-xs font-semibold text-gray-500">{t('library.created', { date: formatDate(selected.created_at) })}</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">{selected.updated_at ? t('library.updated', { date: formatDate(selected.updated_at) }) : t('library.notUpdated')}</p>
              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="whitespace-pre-wrap font-japanese text-sm leading-7 text-gray-800">{selected.content}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="btn btn-outline rounded-xl border-gray-200 px-4">
                  {t('library.close')}
                </button>
                {canEditDocument(selected) && <button type="button" onClick={() => setEditing(selected)} className="btn btn-outline rounded-xl border-violet-200 px-4 text-violet-700">
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('library.edit')}
                </button>}
                {canDeleteDocument(selected) && <button type="button" onClick={() => setDeleteTarget(selected)} className="btn btn-outline rounded-xl border-red-200 px-4 text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('library.delete')}
                </button>}
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
                  <h2 className="text-xl font-bold text-gray-950">{t('library.deleteConfirmation.title')}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{t('library.deleteConfirmation.message', { title: deleteTarget.title })}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-outline rounded-xl border-gray-200 px-4">{t('library.cancel')}</button>
                <button type="button" disabled={deleteMutation.isLoading} onClick={() => deleteMutation.mutate(deleteTarget.id)} className="btn rounded-xl bg-red-600 px-4 text-white hover:bg-red-700 disabled:opacity-60">
                  {t('library.delete')}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
