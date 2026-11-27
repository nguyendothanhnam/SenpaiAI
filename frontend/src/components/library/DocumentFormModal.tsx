import { confirmDialog } from '../../features/dialogs/queue'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from 'react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Copy, ExternalLink, Eye, FilePlus2, Loader2, Pencil, UploadCloud, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { libraryAPI } from '../../services/api'
import { getErrorMessage } from '../../utils/getErrorMessage'
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

interface Categories {
  document_types: string[]
  jlpt_levels: string[]
}

const fallbackTypes = ['vocabulary', 'kanji', 'grammar', 'conversation', 'lesson', 'culture', 'example']
const fallbackJlpt = ['N5', 'N4', 'N3', 'N2', 'N1']
const DOCUMENT_TYPE_LABELS = {
  vocabulary: 'library.documentTypes.vocabulary',
  kanji: 'library.documentTypes.kanji',
  grammar: 'library.documentTypes.grammar',
  conversation: 'library.documentTypes.conversation',
  lesson: 'library.documentTypes.lesson',
  culture: 'library.documentTypes.culture',
  example: 'library.documentTypes.example',
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
    const raw = form.source_url.trim()
    if (/^(javascript|vbscript|data):/i.test(raw)) {
      errors.source_url = t('library.validation.sourceUrlInvalid')
    } else if (raw.includes('://') && !['http:', 'https:'].includes(raw.split('://')[0].toLowerCase() + ':')) {
      errors.source_url = t('library.validation.sourceUrlInvalid')
    }
  }
  return { success: Object.keys(errors).length === 0, errors }
}

function documentTypeLabel(type: string, t: ReturnType<typeof useTranslation>['t']) {
  const key = DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS]
  return key ? t(key) : type
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

export default function DocumentFormModal({
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
  const characters = Array.from(form.content).filter(char => /\p{L}/u.test(char))
  const japanese = characters.filter(char => /[\u3040-\u30ff\u3400-\u9fff]/u.test(char)).length
  const vietnamese = characters.filter(char => /[a-zA-ZÀ-ỹĐđ]/u.test(char)).length
  const levelHint = form.content.match(/\bN[1-5]\b/i)?.[0]?.toUpperCase()
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
    onError: (error: unknown) => {
      const message = getErrorMessage(error)
      setFetchError(message)
      toast.error(message)
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsingFile, setParsingFile] = useState(false)
  const parseFileMutation = useMutation((file: File) => libraryAPI.parseFile(file), {
    onMutate: () => setParsingFile(true),
    onSuccess: (response) => {
      setParsingFile(false)
      const data = response.data as { title: string; content: string; file_name: string }
      setForm((current) => ({
        ...current,
        title: current.title.trim() ? current.title : data.title,
        content: data.content,
        source_url: current.source_url.trim() ? current.source_url : data.file_name,
      }))
      setErrors((current) => ({ ...current, content: undefined, title: undefined, source_url: undefined }))
      setFetchError('')
      toast.success(t('library.fileParsedSuccess', { defaultValue: 'Trích xuất file thành công!' }))
    },
    onError: (err: any) => {
      setParsingFile(false)
      toast.error(getErrorMessage(err))
    },
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (form.content.trim() && !await confirmDialog(t('library.replaceContentConfirm'), { tone: 'warning' })) {
      e.target.value = ''
      return
    }
    parseFileMutation.mutate(file)
    e.target.value = ''
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (saving || fetchUrlMutation.isLoading || parseFileMutation.isLoading) return
    const result = validateDocument(form, t)
    setErrors(result.errors)
    if (!result.success) {
      const firstError = Object.values(result.errors)[0]
      if (firstError) toast.error(firstError)
      return
    }
    onSubmit(initial ? buildPayload(form) : { ...buildPayload(form), scope })
  }

  const fetchFromUrl = async () => {
    const sourceUrl = form.source_url.trim()
    setFetchError('')
    if (!sourceUrl) {
      setErrors((current) => ({ ...current, source_url: t('library.validation.urlRequired') }))
      return
    }
    if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
      setErrors((current) => ({ ...current, source_url: t('library.validation.sourceUrlInvalid') }))
      return
    }
    if (form.content.trim() && !await confirmDialog(t('library.replaceContentConfirm'), { tone: 'warning' })) return
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
    if (name === 'source_url') setFetchError('')
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                className="hidden"
                onChange={handleFileUpload}
              />
              <span className="flex items-center gap-2 text-sm font-semibold">
                <UploadCloud className="h-4 w-4 text-[color:var(--primary)]" />
                {t('library.fields.uploadFile', { defaultValue: 'Tải file tài liệu (PDF / Word / TXT)' })}
              </span>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                {t('library.uploadFileHint', { defaultValue: 'Hỗ trợ .pdf, .docx, .doc, .txt, .md. Trích xuất tự động văn bản.' })}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile || saving}
                className="btn btn-outline mt-3 min-h-10 w-full gap-2 rounded-xl px-3 text-[color:var(--primary)]"
              >
                {parsingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {parsingFile ? 'Đang trích xuất văn bản...' : 'Chọn file từ máy tính'}
              </button>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
              <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-semibold"><ExternalLink className="h-4 w-4 text-[color:var(--primary)]" />{t('library.fields.sourceUrl')}</span>
                <input type="text" value={form.source_url} onChange={event => updateField('source_url', event.target.value)} placeholder="https://… hoặc tên file tài liệu" disabled={fetchUrlMutation.isLoading} aria-invalid={Boolean(errors.source_url)} className="input h-11 rounded-xl" />
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
            {preview ? <div className="h-[320px] overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 text-sm leading-7">{form.content || <span className="text-[color:var(--text-muted)]">{t('library.previewEmpty')}</span>}</div> :
              <textarea id="library-document-content" maxLength={50000} required value={form.content} onChange={event => updateField('content', event.target.value)} disabled={saving || fetchUrlMutation.isLoading} aria-invalid={Boolean(errors.content)} placeholder={t('library.contentPlaceholder')} className="input !h-[320px] max-h-[320px] w-full min-w-0 overflow-auto resize-none rounded-2xl p-4 library-text leading-7" />}
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]"><span>{t('library.contentLimitCount', { count: form.content.length, limit: 50000 })}</span>{errors.content && <span role="alert" className="text-red-600">{errors.content}</span>}</div>
            {!initial && <button type="button" aria-expanded={showPromptTemplate} onClick={() => setShowPromptTemplate(value => !value)} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--border)] px-3 text-xs font-semibold text-[color:var(--primary)] hover:bg-[color:var(--accent)]"><Copy className="h-3.5 w-3.5" />{t('library.promptTemplate')}</button>}
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('library.languageEstimate', { japanese: characters.length ? Math.round(japanese * 100 / characters.length) : 0, vietnamese: characters.length ? Math.round(vietnamese * 100 / characters.length) : 0 })}</p>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('library.suggestion', { type: documentTypeLabel(japanese ? 'vocabulary' : 'lesson', t), level: levelHint || t('library.noLevel') })}</p>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('library.copyrightNotice')}</p>
            {showPromptTemplate && <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3"><p className="text-xs text-[color:var(--text-muted)]">{t('library.promptTemplateHelp')}</p><textarea readOnly value={promptText} rows={6} className="input !h-auto text-xs leading-5" aria-label={t('library.promptTemplate')} /><button type="button" onClick={() => void copyPromptTemplate()} className="btn btn-outline btn-sm gap-1.5"><Copy className="h-3.5 w-3.5" />{t('library.copyPrompt')}</button></div>}
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-5 py-4 sm:px-6">
          <div><p className="text-xs font-semibold text-[color:var(--text-muted)]">{ready ? t('library.readyToSave') : t('library.requiredFieldsHint')}</p><p className="mt-1 hidden text-[10px] text-[color:var(--text-muted)] sm:block">{t('library.saveShortcut')}</p></div>
          <div className="flex gap-2"><button type="button" onClick={close} disabled={saving} className="btn btn-outline min-h-11 rounded-xl px-5">{t('library.cancel')}</button>
            <button type="submit" disabled={saving || fetchUrlMutation.isLoading || parsingFile} className="btn btn-primary min-h-11 gap-2 rounded-xl px-5 font-semibold">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? t('library.saving') : initial ? t('library.saveChanges') : t('library.addDocument')}</button></div>
        </footer>
      </form>
    </Modal>
  )
}
