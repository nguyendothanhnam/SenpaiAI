import type { DocumentPayload, DocumentType, LibraryDocument, LibraryPage } from '../../api/types'

export const DOCUMENT_TYPES: DocumentType[] = ['vocabulary', 'grammar', 'lesson', 'culture', 'example']
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
export interface DocumentForm { title: string; content: string; document_type: string; jlpt_level: string; tags: string; source_url: string }
export const emptyDocument: DocumentForm = { title: '', content: '', document_type: 'grammar', jlpt_level: '', tags: '', source_url: '' }
export function safeHttpUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname } catch { return false }
}
export function validateDocument(form: DocumentForm) {
  const errors: Partial<Record<keyof DocumentForm, string>> = {}
  if (!form.title.trim()) errors.title = 'common:library.validation.titleRequired'
  if (!DOCUMENT_TYPES.includes(form.document_type as DocumentType)) errors.document_type = 'common:library.validation.typeRequired'
  if (!form.content.trim()) errors.content = 'common:library.validation.contentRequired'
  if (form.source_url.trim() && !safeHttpUrl(form.source_url.trim())) errors.source_url = 'common:library.validation.sourceUrlInvalid'
  if (form.jlpt_level && !JLPT_LEVELS.includes(form.jlpt_level)) errors.jlpt_level = 'mobile:phase1.library.invalidLevel'
  return errors
}
export function documentPayload(form: DocumentForm): DocumentPayload {
  return { title: form.title.trim(), content: form.content.trim(), document_type: form.document_type, jlpt_level: form.jlpt_level || null, tags: [...new Set(form.tags.split(',').map((value) => value.trim()).filter(Boolean))], source_url: form.source_url.trim() || null }
}
export function documentPermissions(document: LibraryDocument) {
  const mine = document.is_mine === true && document.scope !== 'system'
  return { edit: mine && document.can_edit === true, remove: mine && document.can_delete === true }
}
export function scopeLabelKey(document: LibraryDocument) {
  if (document.scope === 'system') return 'common:library.badge.system'
  if (document.is_mine === true) return 'common:library.badge.personal'
  return 'mobile:phase1.library.unknownScope'
}
export function nextPageOffset(page: LibraryPage) {
  const next = page.offset + page.items.length
  return page.items.length < page.limit || (page.total !== undefined && next >= page.total) ? undefined : next
}
export function uniqueDocuments(pages: LibraryPage[]) {
  return [...new Map(pages.flatMap((page) => page.items).map((document) => [document.id, document])).values()]
}
export function libraryLimitError(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response
  return response?.status === 413 || (response?.status === 400 && /limit|maximum|too long|exceed/i.test(String(response.data?.detail ?? '')))
}
