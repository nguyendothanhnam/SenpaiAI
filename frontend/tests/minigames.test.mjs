import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const server = await createServer({ server:{middlewareMode:true,hmr:false}, appType:'custom', ssr:{noExternal:['axios']}, resolve:{alias:[{find:/^axios$/,replacement:fileURLToPath(new URL('../node_modules/axios/dist/esm/axios.js',import.meta.url))}]} })
try {
  const {default:i18n}=await server.ssrLoadModule('/src/i18n/index.ts')
  const engine=await server.ssrLoadModule(fileURLToPath(new URL('../../shared-games/index.ts',import.meta.url)))
  const {default:GameFrame}=await server.ssrLoadModule('/src/components/minigames/GameFrame.tsx')
  const {default:GameHub}=await server.ssrLoadModule('/src/pages/GameHub.jsx')
  const {AuthProvider}=await server.ssrLoadModule('/src/services/auth.tsx')
  const render=node=>renderToStaticMarkup(React.createElement(MemoryRouter,null,node))
  for(const language of ['vi','en']) {
    await i18n.changeLanguage(language)
    for(const game of engine.GAMES) {
      const setup=render(React.createElement(GameFrame,{game,account:7}))
      assert.ok(setup.includes(i18n.t(`minigames.games.${game}.name`)))
      assert.ok(!/minigames2?\./.test(setup))
      if(game==='missing' || game==='falling') assert.ok(setup.includes('<option value="N4">'))
      else assert.match(setup,/<option value="N4" disabled=""/)
      const filenames={falling:'FallingGame',shiritori:'ShiritoriGame',cipher:'CipherGame',memory:'MemoryGame',battle:'BattleGame',workshop:'WorkshopGame',wordsearch:'WordSearchGame',ninja:'NinjaGame',missing:'MissingStrokeGame'}
      const {default:Component}=await server.ssrLoadModule(`/src/components/minigames/${filenames[game]}.tsx`)
      const round=engine.createRound(game,'N3','normal',17)
      const html=render(React.createElement(Component,{round,onAction:()=>{}}))
      assert.ok(html.length>300)
      assert.ok(!/minigames2?\./.test(html))
      if(game==='falling') assert.equal((html.match(/class="mg-btn mg-option"/g)||[]).length,4)
      if(game==='shiritori') assert.equal((html.match(/class="mg-btn mg-option"/g)||[]).length,4)
      if(game==='cipher') { assert.ok(html.includes('<form')); assert.ok(html.includes(i18n.t('minigames.cipherTable'))) }
      if(game==='memory') assert.equal((html.match(/mg-kana-cell/g)||[]).length,9)
      if(game==='battle'){assert.equal((html.match(/mg-match /g)||[]).length+ (html.match(/class="mg-btn mg-match"/g)||[]).length,round.battle.pairs.length*2)}
      if(game==='workshop'){assert.equal((html.match(/class="mg-btn mg-kanji-card"/g)||[]).length,round.workshop.cards.length)}
      if(game==='wordsearch')assert.equal((html.match(/class="mg-word-cell /g)||[]).length,round.wordsearch.size**2)
      if(game==='ninja') {
        assert.equal((html.match(/class="mg-flying-word"/g)||[]).length,round.ninja.entities.length)
        assert.ok(!html.includes('<text'), 'Word text stays outside the stretched SVG slash overlay')
        assert.ok(html.includes(i18n.t('minigames2.ninjaScoring')), 'Explain points and life penalties before slashing')
        assert.ok(html.includes('aria-valuemax="'+round.ninja.goal+'"'), 'Expose the actual completion goal')
      }
      if(game==='missing'){
        const main=html.match(/<svg[^>]*class="mg-missing-glyph"[^>]*>(.*?)<\/svg>/s)?.[1]
        assert.ok(main)
        assert.equal((main.match(/stroke="var\(--text\)"/g)||[]).length,round.missing.glyph.paths.length-1)
        assert.ok(!main.includes(`d="${round.missing.glyph.paths[round.missing.hidden]}"`))
        assert.equal((html.match(/class="mg-btn mg-stroke-choice"/g)||[]).length,4)
      }
    }
    const hub=render(React.createElement(AuthProvider,null,React.createElement(GameHub)))
    for(const path of ['/quiz','/flashcard',...engine.GAMES.map(game=>`/games/${game}`)]) assert.ok(hub.includes(`href="${path}"`),path)
    assert.ok(!/minigames2?\./.test(hub))
  }
  console.log('Minigame Vite imports, vi/en rendering, eligibility and legacy hub routes passed.')
} finally { await server.close() }
