import assert from 'node:assert/strict'
import test from 'node:test'
import type { LibraryDocument } from '../src/api/types'
import { documentPayload, documentPermissions, emptyDocument, libraryLimitError, nextPageOffset, safeHttpUrl, scopeLabelKey, uniqueDocuments, validateDocument } from '../src/features/library/logic'

const document: LibraryDocument = { id: 1, title: 'Lesson', content: '日本語\nGhi chú', document_type: 'grammar', tags: [], created_at: '2026-11-05T00:00:00Z' }
test('missing or contradictory ownership metadata never grants edit/delete', () => {
  assert.deepEqual(documentPermissions(document), { edit: false, remove: false })
  assert.deepEqual(documentPermissions({ ...document, can_edit: true, can_delete: true }), { edit: false, remove: false })
  assert.deepEqual(documentPermissions({ ...document, is_mine: true, scope: 'system', can_edit: true }), { edit: false, remove: false })
  assert.deepEqual(documentPermissions({ ...document, is_mine: true, can_edit: true, can_delete: true }), { edit: true, remove: true })
  assert.equal(scopeLabelKey(document), 'mobile:phase1.library.unknownScope')
})

test('document validation matches required fields, HTTP URLs, types and JLPT levels', () => {
  assert.ok(validateDocument(emptyDocument).title)
  assert.ok(validateDocument(emptyDocument).content)
  const form = { ...emptyDocument, title: ' Note ', content: '日本語\n\n A note ', tags: 'N5, particles, N5', jlpt_level: 'N5', source_url: 'https://example.com' }
  assert.deepEqual(validateDocument(form), {})
  assert.equal(documentPayload(form).content, '日本語\n\n A note')
  assert.deepEqual(documentPayload(form).tags, ['N5', 'particles'])
  assert.ok(validateDocument({ ...form, jlpt_level: 'N9' }).jlpt_level)
  assert.ok(validateDocument({ ...form, document_type: 'unknown' }).document_type)
  assert.ok(validateDocument({ ...form, source_url: 'javascript:alert(1)' }).source_url)
  assert.equal(safeHttpUrl('https://example.com/page'), true)
  assert.equal(safeHttpUrl('file:///private'), false)
})

test('list pagination supports exact totals and search pages without totals', () => {
  assert.equal(nextPageOffset({ items: [document], offset: 0, limit: 1, total: 1 }), undefined)
  assert.equal(nextPageOffset({ items: [document], offset: 0, limit: 1 }), 1)
  assert.equal(nextPageOffset({ items: [], offset: 12, limit: 12 }), undefined)
  assert.deepEqual(uniqueDocuments([{ items: [document], offset: 0, limit: 1 }, { items: [document, { ...document, id: 2 }], offset: 1, limit: 2 }]).map((item) => item.id), [1, 2])
})

test('server quota errors use the shared library limit message', () => {
  assert.equal(libraryLimitError({ response: { status: 413 } }), true)
  assert.equal(libraryLimitError({ response: { status: 400, data: { detail: 'Maximum documents exceeded' } } }), true)
  assert.equal(libraryLimitError({ response: { status: 422 } }), false)
})
