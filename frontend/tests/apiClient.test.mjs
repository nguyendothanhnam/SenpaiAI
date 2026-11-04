import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from 'react-query'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// Exercise Vite's runtime resolution; TypeScript can resolve api.ts while the
// browser loads api.js for the same extensionless import.
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  ssr: { noExternal: ['axios'] },
  resolve: {
    // Match the browser's Axios build instead of loading Node's HTTP adapter.
    alias: [{ find: /^axios$/, replacement: fileURLToPath(new URL('../node_modules/axios/dist/esm/axios.js', import.meta.url)) }],
  },
})
globalThis.localStorage = { getItem: () => null }
try {
  const resolved = await server.pluginContainer.resolveId('./src/services/api')
  assert.ok(resolved?.id.endsWith('/services/api.js'))
  const runtime = await server.ssrLoadModule(resolved.id)
  const typed = await server.ssrLoadModule('/src/services/api.ts')
  for (const name of Object.keys(typed)) assert.equal(runtime[name], typed[name], name)
  assert.equal(runtime.default, typed.api)

  const requests = []
  runtime.api.defaults.adapter = async config => {
    requests.push(config)
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  await runtime.chatAPI.listConversations({ search: 'hello', limit: 100 })
  await runtime.chatAPI.listFolders()
  await runtime.chatAPI.sendMessage('hello', undefined, 'N5', 'conversation-id', 'en')
  await runtime.listeningAPI.createFromLibraryDraft({ document_id: 1 })
  await runtime.listeningAPI.saveFromLibrary({ document_id: 1, segments: [] })
  await runtime.getQuiz()
  await runtime.chatAPI.createConversation({ folder_id: 'folder-id' })
  await runtime.analysisAPI.analyzeGrammar('今日は何をしましたか。', 'vi')
  await runtime.analysisAPI.analyzeGrammar('今日は何をしましたか。', 'en')
  await runtime.listeningAPI.getExercises(17)
  await runtime.listeningAPI.submitAttempt(17, { mode: 'dictation', revision: 'test-revision', answers: [{ question_id: 'dictation-0', answer: '日本語を勉強します。' }], duration_ms: 5000 })
  await runtime.listeningAPI.getAttempts(17)
  assert.deepEqual(requests.map(({ method, url }) => [method, url]), [
    ['get', '/chat/conversations'],
    ['get', '/chat/folders'],
    ['post', '/chat/message'],
    ['post', '/listening/lessons/from-library'],
    ['post', '/listening/lessons/from-library/save'],
    ['get', '/game/quiz'],
    ['post', '/chat/conversations'],
    ['post', '/analysis/grammar'],
    ['post', '/analysis/grammar'],
    ['get', '/listening/lessons/17/exercises'],
    ['post', '/listening/lessons/17/attempts'],
    ['get', '/listening/lessons/17/attempts'],
  ])
  assert.deepEqual(requests[0].params, { search: 'hello', limit: 100 })
  assert.equal(JSON.parse(requests[2].data).conversation_id, 'conversation-id')
  assert.equal(JSON.parse(requests[2].data).response_language, 'en')
  assert.equal(JSON.parse(requests[6].data).folder_id, 'folder-id')
  assert.deepEqual(JSON.parse(requests[7].data), { text: '今日は何をしましたか。', response_language: 'vi' })
  assert.equal(JSON.parse(requests[8].data).response_language, 'en')
  assert.equal(JSON.parse(requests[10].data).answers[0].answer, '日本語を勉強します。')
  assert.ok(!Object.hasOwn(JSON.parse(requests[10].data), 'score'))
  assert.equal(runtime.voiceAPI, undefined)
  const { default: ChatAnswer } = await server.ssrLoadModule('/src/components/chat/ChatAnswer.tsx')
  const html = renderToStaticMarkup(React.createElement(ChatAnswer, { text: '**Intent:** GRAMMAR_EXPLANATION\n\n**は**: chủ đề.\n\n- `が`: chủ ngữ.\n- <script>alert(1)</script>' }))
  assert.ok(html.includes('<strong'))
  assert.ok(html.includes('<ul'))
  assert.ok(html.includes('<code'))
  assert.ok(!html.includes('GRAMMAR_EXPLANATION'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
  const { default: appI18n } = await server.ssrLoadModule('/src/i18n/index.ts')
  const { kanjiText } = await server.ssrLoadModule('/src/utils/kanjiLocale.js')
  const { default: KanjiInfoPanel } = await server.ssrLoadModule('/src/components/kanji/KanjiInfoPanel.jsx')
  const { default: PredictionResult } = await server.ssrLoadModule('/src/components/kanji/PredictionResult.jsx')
  await appI18n.changeLanguage('vi')
  assert.equal(kanjiText('Writing canvas'), 'Vùng viết Kanji')
  assert.equal(kanjiText('2 strokes captured'), 'Đã ghi 2 nét')
  assert.equal(kanjiText('CNN match 92%'), 'Mức khớp nhận dạng 92%')
  assert.equal(kanjiText('strokes'), 'nét')
  assert.equal(kanjiText('Kunyomi:'), 'Âm Kun:')
  const guidanceVi = renderToStaticMarkup(React.createElement(KanjiInfoPanel))
  assert.ok(guidanceVi.includes('Hướng dẫn sử dụng'))
  assert.ok(!guidanceVi.includes('How to use'))
  const resultsVi = renderToStaticMarkup(React.createElement(PredictionResult, { status: 'success', predictions: [{ kanji: '猫', meaning: 'cat', confidence: .92, reason: 'CNN match 92%', strokes: 11 }] }))
  assert.ok(resultsVi.includes('Kết quả nhận dạng'))
  assert.ok(resultsVi.includes('mèo'))
  assert.ok(!resultsVi.includes('Unknown meaning'))
  const { default: KanjiPage } = await server.ssrLoadModule('/src/pages/Kanji.jsx')
  const kanjiClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const kanjiPageVi = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: kanjiClient }, React.createElement(MemoryRouter, null, React.createElement(KanjiPage))))
  assert.ok(kanjiPageVi.includes('Luyện viết Kanji'))
  assert.ok(kanjiPageVi.includes('Vùng viết Kanji'))
  assert.ok(!/Writing canvas|Kanji Canvas|Ready to recognize|Prediction results/.test(kanjiPageVi))
  kanjiClient.clear()
  const { default: ListeningExercises } = await server.ssrLoadModule('/src/components/listening/ListeningExercises.tsx')
  const exerciseClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  exerciseClient.setQueryData(['listening-exercises', 17], { lesson_id: 17, revision: 'test-revision', questions: [
    { id: 'dictation-0', mode: 'dictation', segment_index: 0, accepts_kana: true },
    { id: 'cloze-0', mode: 'cloze', segment_index: 0, prefix: '日本語を', suffix: '。' },
    { id: 'comprehension-0', mode: 'comprehension', segment_index: 0, options: [{ id: 'a', text: '日本語を勉強します。' }, { id: 'b', text: '学校へ行きます。' }] },
  ] })
  exerciseClient.setQueryData(['listening-attempts', 17], { items: [] })
  const exercisesVi = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: exerciseClient }, React.createElement(ListeningExercises, { lessonId: 17, audioReady: true, onPlaySegment: () => {} })))
  assert.ok(exercisesVi.includes('Nghe và gõ lại'))
  assert.ok(exercisesVi.includes('Điền chỗ trống'))
  assert.ok(exercisesVi.includes('Chọn đáp án đúng'))
  assert.ok(exercisesVi.includes('Nghe câu này'))
  assert.ok(!exercisesVi.includes('日本語を勉強します。'), 'Dictation must not render the transcript or other mode options before submission')
  exerciseClient.clear()
  await appI18n.changeLanguage('en')
  assert.equal(kanjiText('Writing canvas'), 'Writing canvas')
  const guidanceEn = renderToStaticMarkup(React.createElement(KanjiInfoPanel))
  assert.ok(guidanceEn.includes('How to use'))
  const { themes } = await server.ssrLoadModule('/src/themes/themes.ts')
  for (const theme of Object.values(themes)) {
    for (const palette of Object.values(theme.palettes)) {
      assert.match(palette.primaryGradient, /^(?:linear|radial|conic)-gradient\(/, 'Gradient text requires a CSS image, not a solid color')
    }
  }
  console.log('Vite API resolution and request checks passed.')
} finally {
  delete globalThis.localStorage
  await server.close()
}
