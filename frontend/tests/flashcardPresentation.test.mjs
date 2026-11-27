import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createServer } from 'vite'

test('shared flashcard navigation translates all six modes and preserves their existing URLs', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { default: i18n } = await server.ssrLoadModule('/src/i18n/index.ts')
    const { default: Shell } = await server.ssrLoadModule('/src/features/flashcards/FlashcardShell.tsx')
    const paths = ['/flashcard/7', '/flashcard/play?set=7', '/flashcard/learn?set=7', '/flashcard/test?set=7', '/flashcard/stats?set=7', '/flashcard/manual?set=7']
    for (const language of ['vi', 'en']) {
      await i18n.changeLanguage(language)
      for (const current of paths) {
        const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [current] }, React.createElement(Routes, null,
          ...['/flashcard/:deckId', '/flashcard/play', '/flashcard/learn', '/flashcard/test', '/flashcard/stats', '/flashcard/manual'].map(path => React.createElement(Route, { key: path, path, element: React.createElement(Shell, { deckTitle: 'N5 practice' }, React.createElement('p', null, 'content')) })))))
        for (const href of paths) assert.ok(html.includes(`href="${href}"`), href)
        assert.equal((html.match(/aria-current="page"/g) || []).length, 2, 'one breadcrumb and one active mode')
        assert.ok(html.includes(`aria-label="${i18n.t('flashcardsManager.studyModes')}"`))
        assert.ok(html.includes('N5 practice'))
        assert.doesNotMatch(html, /flashcardsManager\./)
      }
    }
  } finally { await server.close() }
})
