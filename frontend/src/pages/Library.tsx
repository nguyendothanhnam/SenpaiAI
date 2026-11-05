import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  Eye,
  FilePlus2,
  Layers3,
  Library as LibraryIcon,
  Loader2,
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
import { useLanguage } from '../hooks/useLanguage'

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
  return <div className="h-28 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-glass)]" />
}

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number; icon: any; loading: boolean }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-2xl border border-[color:var(--border)]/70 bg-[color:var(--card-glass)] p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--primary)]">{label}</p>
          {loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-[color:var(--accent)]" /> : <p className="mt-2 text-3xl font-bold text-[color:var(--text)]">{value.toLocaleString()}</p>}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]">
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
    violet: 'bg-[color:var(--accent)] text-[color:var(--primary)]',
    gray: 'bg-[color:var(--bg-elevated)] text-[color:var(--text)]',
    amber: 'bg-amber-50 text-amber-700',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>
}

let openLibraryModals = 0
let previousLibraryOverflow = ''

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { t } = useTranslation('common')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (openLibraryModals === 0) previousLibraryOverflow = document.body.style.overflow
    openLibraryModals += 1
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    ;(dialog?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled)') || dialog?.querySelector<HTMLElement>('button'))?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      const modals = document.querySelectorAll('[data-library-modal]')
      if (modals[modals.length - 1] !== dialog) return
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')).filter(element => element.getClientRects().length > 0)
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      openLibraryModals -= 1
      if (openLibraryModals === 0) document.body.style.overflow = previousLibraryOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (openLibraryModals === 0 && previous?.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (!wide && event.target === event.currentTarget) onClose() }}>
      <motion.div data-library-modal ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('library.documentDialog')} initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className={`relative max-h-[92dvh] w-full overflow-auto rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <button type="button" onClick={onClose} aria-label={t('library.close')} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-xl text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]"><X className="h-5 w-5" /></button>
        {children}
      </motion.div>
    </div>, document.body
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
  const [preview, setPreview] = useState(false)
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
    if (saving || fetchUrlMutation.isLoading) return
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
    if (form.content.trim() && !window.confirm(t('library.replaceContentConfirm'))) return
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

  const updateField = (name: keyof DocumentForm, value: string) => {
    setForm(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: undefined }))
  }
  const ready = Boolean(form.title.trim() && form.content.trim())
  const close = () => { if (!saving) onClose() }

  return (
    <Modal wide onClose={close}>
      <form noValidate onSubmit={submit} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.currentTarget.requestSubmit() } }} className="flex max-h-[90dvh] flex-col">
        <header className="shrink-0 border-b border-[color:var(--border)] px-5 py-5 pr-16 sm:px-6 sm:pr-16">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><FilePlus2 className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--primary)]">{initial ? t('library.editDocument') : t('library.addNewDocument')}</p>
              <h2 className="mt-1 text-xl font-bold">{initial ? t('library.editDocument') : t('library.createDocument')}</h2></div>
          </div>
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">{t('library.editorHint')}</p>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[minmax(260px,.85fr)_minmax(0,1.3fr)]">
          <fieldset disabled={saving} className="min-w-0 space-y-4">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">{t('library.documentInformation')}</legend>
            {!initial && <label className="block space-y-1.5">
              <span className="text-sm font-semibold">{t('library.scope.label')}</span>
              <select value={scope} onChange={event => setScope(event.target.value as 'personal' | 'system')} className="input h-11 rounded-xl">
                <option value="personal">{t('library.badge.personal')}</option>
                {allowSystemScope && <option value="system">{t('library.badge.system')}</option>}
              </select>
              <span className="block rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]">{scope === 'personal' ? t('library.privateNote') : t('library.systemScopeNote')}</span>
            </label>}
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">{t('library.fields.title')} <span className="text-[color:var(--primary)]">*</span></span>
              <input autoFocus required value={form.title} onChange={event => updateField('title', event.target.value)} placeholder={t('library.titlePlaceholder')} aria-invalid={Boolean(errors.title)} className="input h-11 rounded-xl" />
              {errors.title && <span role="alert" className="text-xs text-red-600">{errors.title}</span>}
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">{t('library.fields.documentType')} *</span>
              <select value={form.document_type} onChange={event => updateField('document_type', event.target.value)} className="input h-11 rounded-xl">{types.map(type => <option key={type} value={type}>{documentTypeLabel(type, t)}</option>)}</select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-sm font-semibold">{t('library.fields.jlptLevel')}</span>
                <select value={form.jlpt_level} onChange={event => updateField('jlpt_level', event.target.value)} className="input h-11 rounded-xl"><option value="">{t('library.noLevel')}</option>{levels.map(level => <option key={level} value={level}>{level}</option>)}</select>
              </label>
              <label className="block space-y-1.5"><span className="text-sm font-semibold">{t('library.fields.tags')}</span>
                <input value={form.tags} onChange={event => updateField('tags', event.target.value)} placeholder={t('library.tagsPlaceholder')} className="input h-11 rounded-xl" />
              </label>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
              <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-semibold"><ExternalLink className="h-4 w-4 text-[color:var(--primary)]" />{t('library.fields.sourceUrl')}</span>
                <input type="url" value={form.source_url} onChange={event => updateField('source_url', event.target.value)} placeholder="https://…" disabled={fetchUrlMutation.isLoading} aria-invalid={Boolean(errors.source_url)} className="input h-11 rounded-xl" />
              </label>
              <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{t('library.urlImportHint')}</p>
              <button type="button" onClick={fetchFromUrl} disabled={fetchUrlMutation.isLoading || !form.source_url.trim()} className="btn btn-outline mt-3 min-h-10 w-full gap-2 rounded-xl px-3 text-[color:var(--primary)]">{fetchUrlMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{fetchUrlMutation.isLoading ? t('library.fetching') : t('library.fetchFromUrl')}</button>
              {(errors.source_url || fetchError) && <p role="alert" className="mt-2 text-xs text-red-600">{errors.source_url || fetchError}</p>}
            </div>
          </fieldset>

          <section className="flex min-h-[320px] min-w-0 flex-col">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="library-document-content" className="text-sm font-semibold">{t('library.fields.content')} *</label>
              <div className="flex rounded-xl bg-[color:var(--accent)] p-1">
                <button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${!preview ? 'bg-[color:var(--card)] text-[color:var(--primary)] shadow-sm' : 'text-[color:var(--text-muted)]'}`}><Pencil className="h-3.5 w-3.5" />{t('library.writeContent')}</button>
                <button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${preview ? 'bg-[color:var(--card)] text-[color:var(--primary)] shadow-sm' : 'text-[color:var(--text-muted)]'}`}><Eye className="h-3.5 w-3.5" />{t('library.previewContent')}</button>
              </div>
            </div>
            {preview ? <div className="min-h-[280px] flex-1 whitespace-pre-wrap break-words rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 text-sm leading-7">{form.content || <span className="text-[color:var(--text-muted)]">{t('library.previewEmpty')}</span>}</div> :
              <textarea id="library-document-content" required value={form.content} onChange={event => updateField('content', event.target.value)} disabled={saving || fetchUrlMutation.isLoading} aria-invalid={Boolean(errors.content)} placeholder={t('library.contentPlaceholder')} className="input !h-auto min-h-[280px] flex-1 resize-y rounded-2xl p-4 library-text leading-7 lg:min-h-[380px]" />}
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]"><span>{t('library.contentCharacterCount', { count: form.content.length })}</span>{errors.content && <span role="alert" className="text-red-600">{errors.content}</span>}</div>
            {!initial && <button type="button" aria-expanded={showPromptTemplate} onClick={() => setShowPromptTemplate(value => !value)} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--border)] px-3 text-xs font-semibold text-[color:var(--primary)] hover:bg-[color:var(--accent)]"><Copy className="h-3.5 w-3.5" />{t('library.promptTemplate')}</button>}
            {showPromptTemplate && <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3"><p className="text-xs text-[color:var(--text-muted)]">{t('library.promptTemplateHelp')}</p><textarea readOnly value={promptText} rows={6} className="input !h-auto text-xs leading-5" aria-label={t('library.promptTemplate')} /><button type="button" onClick={() => void copyPromptTemplate()} className="btn btn-outline btn-sm gap-1.5"><Copy className="h-3.5 w-3.5" />{t('library.copyPrompt')}</button></div>}
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-5 py-4 sm:px-6">
          <div><p className="text-xs font-semibold text-[color:var(--text-muted)]">{ready ? t('library.readyToSave') : t('library.requiredFieldsHint')}</p><p className="mt-1 hidden text-[10px] text-[color:var(--text-muted)] sm:block">{t('library.saveShortcut')}</p></div>
          <div className="flex gap-2"><button type="button" onClick={close} disabled={saving} className="btn btn-outline min-h-11 rounded-xl px-5">{t('library.cancel')}</button>
            <button type="submit" disabled={saving || fetchUrlMutation.isLoading} className="btn btn-primary min-h-11 gap-2 rounded-xl px-5 font-semibold">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? t('library.saving') : initial ? t('library.saveChanges') : t('library.addDocument')}</button></div>
        </footer>
      </form>
    </Modal>
  )
}

export default function Library() {
  const { t } = useTranslation('common')
  const { language } = useLanguage()
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
  const [grammarResult, setGrammarResult] = useState<{ requested: number; saved: number; rejected: number; limited: boolean; question_ids: number[]; jlpt_level?: string; question_type?: GrammarQuestionType } | null>(null)
  const [listeningDraft, setListeningDraft] = useState<any>(null)
  const [actionError, setActionError] = useState('')
  const offset = (page - 1) * PAGE_SIZE
  const hasSearch = Boolean(searchPayload.query.trim())

  const selectedQuery = useQuery(
    ['libraryDocument', selected?.id, language, selected?.updated_at],
    () => libraryAPI.getDocument(selected!.id, language).then(({ data }) => data as LibraryDocument),
    { enabled: selected !== null, refetchOnWindowFocus: false },
  )
  const selectedView = selectedQuery.data

  const editDocument = async (document: LibraryDocument) => {
    try {
      // Always edit the stored original, so a translated view cannot overwrite it.
      const { data } = await libraryAPI.getDocument(document.id, 'vi')
      setEditing(data)
      setSelected(null)
    } catch {
      toast.error(t('library.documentsLoadError'))
    }
  }

  const statsQuery = useQuery('libraryStats', () => libraryAPI.getStats().then((res) => res.data as LibraryStats), {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  })

  const categoriesQuery = useQuery('libraryCategories', () => libraryAPI.getCategories().then((res) => res.data as Categories), {
    refetchOnWindowFocus: false,
  })

  const documentsQuery = useQuery(
    ['libraryDocuments', filters.document_type, filters.jlpt_level, sort, scope, page, language],
    () =>
      libraryAPI
        .getDocuments({
          document_type: filters.document_type || undefined,
          jlpt_level: filters.jlpt_level || undefined,
          sort,
          scope,
          limit: PAGE_SIZE,
          offset,
          language,
        })
        .then((res) => res.data as DocumentListResponse),
    { enabled: !hasSearch, refetchOnWindowFocus: false }
  )

  const searchQuery = useQuery(
    ['librarySearch', searchPayload.query, searchPayload.document_type, searchPayload.jlpt_level, scope, page, language],
    () =>
      libraryAPI
        .searchDocuments({
          query: searchPayload.query,
          document_type: searchPayload.document_type || null,
          jlpt_level: searchPayload.jlpt_level || null,
          scope,
          limit: PAGE_SIZE,
          offset,
        }, language)
        .then((res) => {
          const data = res.data as SearchResponse
          return { items: data.results, total: data.results.length, limit: PAGE_SIZE, offset } as DocumentListResponse
        }),
    {
      enabled: hasSearch,
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
        setGrammarResult({ ...result, jlpt_level: actionDocument?.jlpt_level || user?.current_jlpt_level || 'N5', question_type: questionType })
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
      queryClient.invalidateQueries('libraryDocument')
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
      queryClient.invalidateQueries('libraryDocument')
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
      queryClient.invalidateQueries('libraryDocument')
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
            <h1 className="text-3xl font-bold text-[color:var(--text)]">{t('library.pageTitle')}</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('library.pageSubtitle')}</p>
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

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px_150px_170px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--primary)]" />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={t('library.searchPlaceholder')} className="input w-full border-[color:var(--border)] bg-[color:var(--accent)] pl-10 focus:ring-[color:var(--primary)]" />
          </div>
          <select value={filters.document_type} onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))} className="input border-[color:var(--border)] bg-[color:var(--accent)]">
            <option value="">{t('library.allTypes')}</option>
            {types.map((type) => <option key={type} value={type}>{documentTypeLabel(type, t)}</option>)}
          </select>
          <select value={filters.jlpt_level} onChange={(event) => setFilters((current) => ({ ...current, jlpt_level: event.target.value }))} className="input border-[color:var(--border)] bg-[color:var(--accent)]">
            <option value="">{t('library.allLevels')}</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="input border-[color:var(--border)] bg-[color:var(--accent)]">
            {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((value) => <option key={value} value={value}>{sortLabel(value, t)}</option>)}
          </select>
          <select aria-label={t('library.scope.label')} value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="input border-[color:var(--border)] bg-[color:var(--accent)]">
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
            className="btn btn-primary rounded-xl px-4 text-[color:var(--primary-contrast)]"
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
            className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)]"
          >
            {t('library.clearSearch')}
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[color:var(--text)]">{hasSearch ? t('library.searchResults') : t('library.documentGrid')}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('library.documentCount', { count: total })}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--card)] px-3 py-2 text-xs font-bold text-[color:var(--text-muted)] shadow-sm">
            <ArrowDownAZ className="h-4 w-4 text-[color:var(--primary)]" />
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
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-10 text-center text-[color:var(--text-muted)] shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-[color:var(--primary)]" />
            <p className="mt-3 font-semibold">{t('library.noDocuments')}</p>
            <p className="mt-1 text-sm">{t('library.emptyHint')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <motion.article key={document.id} whileHover={{ y: -4 }} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm transition hover:shadow-md">
                <button type="button" onClick={() => setSelected(document)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold leading-6 text-[color:var(--text)]">{document.title}</h3>
                    {document.source_url && (
                      <a href={document.source_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]">
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
                  <p className="mt-4 line-clamp-4 library-text text-sm leading-6 text-[color:var(--text)]">{(document as any).content_preview || document.content.slice(0, 150)}{document.content.length > 150 ? '...' : ''}</p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.tags?.slice(0, 4).map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.created_at)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelected(document)} className="btn btn-outline rounded-xl border-[color:var(--border)] px-3 py-2 text-xs font-bold text-[color:var(--primary)]">
                    {t('library.viewDetail')}
                  </button>
                  {canEditDocument(document) && <button type="button" onClick={() => void editDocument(document)} className="btn btn-outline rounded-xl border-[color:var(--border)] px-3 py-2 text-xs font-bold text-[color:var(--primary)]">
                    <Pencil className="mr-1 h-3.5 w-3.5" /> {t('library.edit')}
                  </button>}
                  {canDeleteDocument(document) && <button type="button" onClick={() => setDeleteTarget(document)} className="btn btn-outline rounded-xl border-red-200 px-3 py-2 text-xs font-bold text-red-600">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> {t('library.delete')}
                  </button>}
                </div>
                {canUseDocument(document) && <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={grammarGenerationMutation.isLoading || listeningDraftMutation.isLoading || listeningSaveMutation.isLoading} onClick={() => openGeneration(document, 'grammar')} className="btn btn-outline inline-flex items-center justify-center gap-1.5 rounded-xl border-[color:var(--border)] px-2 py-2 text-xs font-bold text-[color:var(--primary)] disabled:opacity-50">
                    <Brain className="h-3.5 w-3.5 shrink-0" />{t('library.createGrammarQuestions')}
                  </button>
                  <button type="button" disabled={grammarGenerationMutation.isLoading || listeningDraftMutation.isLoading || listeningSaveMutation.isLoading} onClick={() => openGeneration(document, 'listening')} className="btn btn-outline inline-flex items-center justify-center gap-1.5 rounded-xl border-[color:var(--border)] px-2 py-2 text-xs font-bold text-[color:var(--primary)] disabled:opacity-50">
                    <Headphones className="h-3.5 w-3.5 shrink-0" />{t('library.createListeningLesson')}
                  </button>
                </div>}
              </motion.article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)] disabled:opacity-40">{t('library.previous')}</button>
            <span className="text-sm font-bold text-[color:var(--text-muted)]">{t('library.page', { current: page, total: totalPages })}</span>
            <form onSubmit={(event) => { event.preventDefault(); const target = Number(pageInput); if (Number.isInteger(target) && target >= 1 && target <= totalPages) setPage(target) }} className="flex items-center gap-2">
              <label htmlFor="library-page-number" className="sr-only">{t('library.pageInput')}</label>
              <input id="library-page-number" type="number" min="1" max={totalPages} step="1" value={pageInput} onChange={(event) => setPageInput(event.target.value)} aria-label={t('library.pageInput')} className="input w-16 px-2 text-center" />
              <button type="submit" className="btn btn-outline rounded-xl">{t('library.goToPage')}</button>
            </form>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)] disabled:opacity-40">{t('library.next')}</button>
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
                  {grammarResult.saved > 0 && <button type="button" onClick={() => navigate('/grammar/practice', { state: { libraryPractice: { question_ids: grammarResult.question_ids, jlpt_level: grammarResult.jlpt_level, question_type: grammarResult.question_type } } })} className="btn btn-primary mt-3 rounded-xl px-4 py-2 text-sm">{t('library.goToPractice')}</button>}
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
            {selectedQuery.isLoading ? <p role="status" className="p-6">{t('library.loadingDocument')}</p>
              : selectedQuery.isError ? <p role="alert" className="p-6">{t('library.documentsLoadError')}</p>
              : selectedView && <div className="p-6">
              <div className="pr-12">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">{t('library.documentDetail')}</p>
                <h2 className="mt-2 text-2xl font-bold text-[color:var(--text)]">{selectedView.title}</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{documentTypeLabel(selectedView.document_type, t)}</Badge>
                {isSystemDocument(selectedView) !== null && <Badge tone={isSystemDocument(selectedView) ? 'gray' : 'violet'}>{isSystemDocument(selectedView) ? t('library.badge.system') : t('library.badge.personal')}</Badge>}
                {selectedView.jlpt_level && <Badge tone="amber">{selectedView.jlpt_level}</Badge>}
                {selectedView.tags?.map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}
              </div>
              {selectedView.source_url && (
                <a href={selectedView.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--primary)] hover:text-[color:var(--primary)]">
                  <ExternalLink className="h-4 w-4" />
                  {t('library.fields.sourceUrl')}
                </a>
              )}
              <p className="mt-4 text-xs font-semibold text-[color:var(--text-muted)]">{t('library.created', { date: formatDate(selectedView.created_at) })}</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">{selectedView.updated_at ? t('library.updated', { date: formatDate(selectedView.updated_at) }) : t('library.notUpdated')}</p>
              <div className="mt-5 rounded-2xl bg-[color:var(--bg-elevated)] p-4">
                <p className="whitespace-pre-wrap library-text break-words text-sm leading-7 text-[color:var(--text)]">{selectedView.content}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4">
                  {t('library.close')}
                </button>
                {canEditDocument(selectedView) && <button type="button" onClick={() => void editDocument(selectedView)} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4 text-[color:var(--primary)]">
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('library.edit')}
                </button>}
                {canDeleteDocument(selectedView) && <button type="button" onClick={() => setDeleteTarget(selected)} className="btn btn-outline rounded-xl border-red-200 px-4 text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('library.delete')}
                </button>}
              </div>
            </div>}
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
                  <h2 className="text-xl font-bold text-[color:var(--text)]">{t('library.deleteConfirmation.title')}</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{t('library.deleteConfirmation.message', { title: deleteTarget.title })}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-outline rounded-xl border-[color:var(--border)] px-4">{t('library.cancel')}</button>
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
