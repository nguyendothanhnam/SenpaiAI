import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { createServer } from 'vite'
import ts from 'typescript'

test('Kanji recall reveals on demand, conceals quiz answers and counts only confirmed or correct reviews', async () => {
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const dataset=await server.ssrLoadModule('/src/data/kanjiDataset.ts')
    const study=await server.ssrLoadModule('/src/features/kanji/study.ts')
    const rows=JSON.parse(readFileSync(new URL('../../backend/app/data/kanji_dictionary.json',import.meta.url),'utf8')).map(dataset.normalizeKanjiItem).filter(row=>row.jlpt_level==='N5').slice(0,12)
    const code=ts.transpileModule(readFileSync(new URL('../src/components/kanji/KanjiStudy.jsx',import.meta.url),'utf8'),{fileName:'KanjiStudy.jsx',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
    for(const language of ['vi','en']){
      const i18n=createInstance();i18n.init({lng:language,resources:{[language]:{common:JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`,import.meta.url),'utf8'))}},defaultNS:'common',initImmediate:false})
      const slots=[],effects=[],queued=[];let cursor=0,tree
      const hooks={useMemo:fn=>fn(),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useEffect(fn,deps){const i=cursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i][j])){effects[i]=deps;queued.push(fn)}}}
      const modules={'react':hooks,'react/jsx-runtime':jsx,'react-query':{useQuery:()=>({data:rows})},'react-i18next':{useTranslation:()=>({t:(key,options)=>{assert.ok(i18n.exists(key),key);return i18n.t(key,options)},i18n})},'react-router-dom':{useSearchParams:()=>[new URLSearchParams()]},'lucide-react':new Proxy({},{get:()=>()=>null}),'../../services/api':{},'../../data/kanjiDataset':dataset,'../../constants/jlptLevels':{KANJI_DICTIONARY_LEVELS:['N5','N4','N3']},'../../features/kanji/study':study,'../../services/auth':{useAuth:()=>({user:{current_jlpt_level:'N5'}})},'../../utils/placementDefaults':{placementDefault:()=> 'N5'},'./kanjiStudy.css':{}}
      const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]}})
      const render=()=>{cursor=0;tree=exports.default();return renderToStaticMarkup(tree)}
      const flush=()=>{while(queued.length)queued.shift()()}
      const nodes=()=>{const found=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}found.push(n);walk(n.props?.children)};walk(tree);return found}
      const text=n=>Array.isArray(n)?n.map(text).join(''):typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?text(n.props?.children):''
      const click=key=>{const node=nodes().find(n=>n.type==='button'&&text(n.props.children)===i18n.t(key));assert.ok(node,key);node.props.onClick();render();flush();return render()}
      let html=render();flush();html=render()
      assert.match(html,/study-locked/)
      html=click('kanjiStudy.revealDetails');assert.ok(html.includes(language==='vi'?rows[0].meaning_vi:rows[0].meaning_en))
      assert.ok(html.includes(i18n.t('kanjiStudy.reviewed',{count:0,total:12})), 'reveal does not mark reviewed')
      click('kanjiStudy.meaningQuiz')
      const reveal=nodes().find(n=>n.type==='button'&&n.props['aria-expanded']===false)
      assert.equal(reveal.props.disabled,true)
      const question=study.makeStudyQuestion(rows,rows[0],'meaning',language)
      const options=nodes().filter(n=>n.type==='button'&&n.props.className==='study-option')
      assert.equal(options.length,4)
      options.find(n=>n.props.children===question.correct).props.onClick();render();flush();html=render()
      assert.ok(html.includes(i18n.t('kanjiStudy.reviewed',{count:1,total:12})))
      assert.match(html,/role="status"/)
      html=click('kanjiStudy.next')
      assert.ok(html.includes(i18n.t('kanjiStudy.reviewed',{count:1,total:12})), 'same character cannot count twice')
      assert.match(html,/study-locked/)
      click('kanjiStudy.meaningQuiz')
      const nextQuestion=study.makeStudyQuestion(rows,rows[1],'meaning',language)
      nodes().find(n=>n.type==='button'&&n.props.className==='study-option'&&n.props.children!==nextQuestion.correct).props.onClick()
      html=render();flush();html=render()
      assert.ok(html.includes(i18n.t('kanjiStudy.reviewed',{count:1,total:12})), 'wrong answer does not mark reviewed')
      assert.match(html,/data-correct="false"/)
      assert.doesNotMatch(html,/kanjiStudy\.|NaN|undefined/)
    }
  } finally {await server.close()}
})
