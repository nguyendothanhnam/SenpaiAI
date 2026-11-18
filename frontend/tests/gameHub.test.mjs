import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', ssr: { noExternal: ['axios'] }, resolve: { alias: [{ find: /^axios$/, replacement: fileURLToPath(new URL('../node_modules/axios/dist/esm/axios.js', import.meta.url)) }] } })
try {
  const { default: i18n } = await server.ssrLoadModule('/src/i18n/index.ts')
  const catalog = await server.ssrLoadModule('/src/features/gameHub/catalog.ts')
  const { default: GameCard } = await server.ssrLoadModule('/src/components/gameHub/GameCard.tsx')
  const { default: GameHub } = await server.ssrLoadModule('/src/pages/GameHub.jsx')
  const { default: GameFrame } = await server.ssrLoadModule('/src/components/minigames/GameFrame.tsx')
  const { AuthProvider } = await server.ssrLoadModule('/src/services/auth.tsx')
  const engine = await server.ssrLoadModule(fileURLToPath(new URL('../../shared-games/index.ts', import.meta.url)))
  const { GAMES_DATA, filterGames, gameRecord, supportedLevels, gameDestination, readLevel } = catalog
  assert.equal(GAMES_DATA.length, 11)
  assert.equal(new Set(GAMES_DATA.map(game => game.id)).size, 11)
  for (const game of engine.GAMES) assert.ok(GAMES_DATA.some(entry => entry.engine === game), game)
  assert.ok(!GAMES_DATA.some(game => game.id === 'listening' || game.to === '/listening'), 'Listening belongs only in listening practice')
  for (const id of ['quiz', 'flashcard']) {
    const game = GAMES_DATA.find(game => game.id === id)
    assert.equal(game.engine, undefined)
    assert.equal(gameDestination(game, 'N3'), game.to, 'Study shortcuts bypass the hub level picker')
  }
  assert.ok(!GAMES_DATA.some(game => game.id === 'kanji' || game.to === '/games/kanji'), 'Study belongs in Kanji practice')
  assert.ok(!GAMES_DATA.some(game => game.id === 'grammar' || game.to === '/grammar/practice'), 'Grammar practice is not a separate racing game')
  const shiritori = GAMES_DATA.find(game => game.id === 'shiritori')
  assert.deepEqual(supportedLevels(shiritori), ['N3'])
  assert.equal(gameDestination(shiritori, 'N3'), '/games/shiritori?level=N3')
  assert.equal(readLevel('?level=N3'), 'N3')
  assert.equal(readLevel('?level=unsupported'), undefined)
  const record = gameRecord(shiritori, { 'shiritori:N3:normal:': { ...engine.EMPTY_STATS, highScore: 1250, completed: 1 }, 'falling:N5:easy:reading': { ...engine.EMPTY_STATS, highScore: 9999 } })
  assert.deepEqual(record, { high: 1250, completed: 1, total: 1 })
  assert.equal(gameRecord(shiritori, {}).high, 0)
  for (const language of ['vi', 'en']) {
    await i18n.changeLanguage(language)
    const t = key => i18n.t(key)
    for (const game of GAMES_DATA) {
      for (const key of [game.title, game.description, `gameGuides.${game.id}.goal`, `gameGuides.${game.id}.tip`]) assert.ok(i18n.exists(key), key)
      const steps = [1, 2, 3].map(step => { const key = `gameGuides.${game.id}.steps.${step}`; assert.ok(i18n.exists(key), key); return i18n.t(key) })
      assert.ok(Array.isArray(steps) && steps.length === 3 && steps.every(step => typeof step === 'string' && step.trim()), `Guide steps: ${game.id}/${language}`)
    }
    assert.deepEqual(filterGames(GAMES_DATA, 'ranked', '', t), [])
    assert.equal(filterGames(GAMES_DATA, 'all', 'not-a-real-game-912', t).length, 0)
    assert.deepEqual(filterGames(GAMES_DATA, 'grammar', '', t), [])
    if (language === 'vi') assert.equal(filterGames(GAMES_DATA, 'reflex', 'noi tu', t)[0].id, 'shiritori')
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AuthProvider, null, React.createElement(GameHub))))
    assert.equal((html.match(/<article/g) || []).length, 11)
    assert.ok(html.includes(t('arcade.heroTitle')))
    assert.ok(html.includes(t('arcade.rewardNotice')))
    assert.ok(!html.includes('arcade.'))
    for (const game of GAMES_DATA) assert.ok(html.includes(`href="${game.to}"`), game.to)
    const card = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(GameCard, { game: shiritori, record, onSelect: () => undefined })))
    assert.ok(card.includes('aria-valuenow="1"'))
    const setup = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/games/falling?level=N3'] }, React.createElement(GameFrame, { game: 'falling', account: 1 })))
    assert.ok(/value="N3" selected/.test(setup), 'Hub-selected level reaches game setup')
  }
  console.log('Game Hub catalog, filters, accent-insensitive search, records, vi/en cards, legacy routes and JLPT handoff passed.')
} finally { await server.close() }
