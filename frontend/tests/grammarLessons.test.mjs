import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import ts from 'typescript'

function render(language, data, id) {
  const translations = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}/common.json`, import.meta.url), 'utf8'))
  const i18n = createInstance(); i18n.init({lng:language, resources:{[language]:{common:translations}}, defaultNS:'common', initImmediate:false})
  const modules = {
    react:{useState:value=>[value,()=>{}]}, 'react/jsx-runtime':jsx,
    'react-router-dom':{Link:({to,children})=>React.createElement('a',{href:to},children),useParams:()=>({lessonId:id})},
    'react-query':{useQuery:key=>key[0]==='grammarLesson'?{data}:key[0]==='grammarLessonNext'?{data:null}:{data:data ? [data] : []},useMutation:()=>({mutate(){}}),useQueryClient:()=>({invalidateQueries(){}})},
    'react-i18next':{useTranslation:()=>({i18n,t:(key, options)=>{assert.ok(i18n.exists(key),key);return i18n.t(key,options)}})},
    '../services/api':{api:{}}, '../services/auth':{useAuth:()=>({user:{id:1,current_jlpt_level:'N5'}})},
    '../components/layout/GrammarTabs':{default:()=>null}, '../components/kanji/KanjiText':{KanjiText:({text})=>text},
  }
  const source=readFileSync(new URL('../src/pages/GrammarLessons.tsx',import.meta.url),'utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name]}})
  return renderToStaticMarkup(React.createElement(exports.default))
}

test('empty lesson catalog has localized empty state',()=>{
  for(const lang of ['vi','en']) assert.match(render(lang,null,undefined),lang==='vi'?/Chưa có bài học/:/No lessons match/)
})

test('lesson displays supplied ruby, missing fields and filtered practice link',()=>{
  const lesson={id:7,grammar_rule_id:4,title:'Example',pattern:'日本',jlpt_level:'N5',status:'not_started',formation:'A は B',meaning:'Meaning',usage_notes:'',examples:[{ja:'日本',vi:'Japan',tokens:[{text:'日本',reading:'にほん'}]}],common_errors:[],comparisons:[],quick_questions:[{id:3,prompt:'Question',question_type:'fill_blank'}]}
  for(const lang of ['vi','en']){
    const html=render(lang,lesson,'7')
    assert.match(html,/<ruby>日本<rt>にほん<\/rt><\/ruby>/)
    assert.match(html,/rule=4/)
    assert.match(html,lang==='vi'?/Chưa có nội dung/:/No content available/)
    assert.match(html,lang==='vi'?/Bắt đầu kiểm tra nhanh/:/Start quick check/)
  }
})

test('source lessons retain English examples, romanization and license links in both UI languages',()=>{
  const lesson={id:8,grammar_rule_id:5,title:'〜ことだ',pattern:'〜ことだ',jlpt_level:'N3',status:'not_started',formation:'Verb + ことだ',meaning:'should',usage_notes:'Original English notes',examples:[{ja:'毎日復習することだ。',en:'You should review every day.',romaji:'Mainichi fukushuu suru koto da.'}],common_errors:[],comparisons:[],quick_questions:[],content_language:'en',sources:[{name:'OpenJLPT v0.2.0',url:'https://github.com/evanclan/OpenJLPT/releases/tag/v0.2.0',license:'CC BY-SA 4.0',license_url:'https://creativecommons.org/licenses/by-sa/4.0/',notice_url:'https://github.com/evanclan/OpenJLPT/blob/v0.2.0/NOTICE.md'}]}
  for(const lang of ['vi','en']){
    const html=render(lang,lesson,'8')
    assert.match(html,/You should review every day\./)
    assert.match(html,/Mainichi fukushuu suru koto da\./)
    assert.match(html,/https:\/\/creativecommons.org\/licenses\/by-sa\/4.0\//)
    assert.match(html,/NOTICE.md/)
    assert.match(html,lang==='vi'?/giải thích và bản dịch ví dụ tiếng Anh/:/English explanations/)
  }
  const translated={...lesson,examples:[{ja:'毎日復習することだ。',vi:'Nên ôn tập hằng ngày.',en:'You should review every day.'}]}
  assert.match(render('vi',translated,'8'),/Nên ôn tập hằng ngày\./)
  assert.match(render('en',translated,'8'),/You should review every day\./)
})
