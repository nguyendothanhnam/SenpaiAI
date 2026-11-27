import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../services/api'
import { useAuth } from '../services/auth'
import GrammarTabs from '../components/layout/GrammarTabs'
import { KanjiText } from '../components/kanji/KanjiText'

type Status = 'not_started' | 'studied' | 'mastered'
interface Item { id: number; grammar_rule_id: number; title: string; pattern: string; jlpt_level: string; status: Status }
interface Example { ja: string; vi: string; tokens: { text: string; reading: string }[] }
interface Detail extends Item { formation: string; meaning: string; usage_notes: string; examples: Example[]; common_errors: string[]; comparisons: string[]; quick_questions: { id: number; prompt: string; question_type: string }[] }

export default function GrammarLessons() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const { lessonId } = useParams()
  const id = Number(lessonId)
  const [level, setLevel] = useState(user?.current_jlpt_level || 'N5')
  const [status, setStatus] = useState('')
  const cache = useQueryClient()
  const list = useQuery(['grammarLessons', user?.id, level, status], () => api.get<{items: Item[]}>('/grammar-lessons', {params: { level, ...(status ? {status} : {}) }}).then(r => r.data.items), {enabled: !lessonId})
  const detail = useQuery(['grammarLesson', user?.id, id], () => api.get<Detail>(`/grammar-lessons/${id}`).then(r => r.data), {enabled: !!lessonId && Number.isInteger(id) && id > 0})
  const next = useQuery(['grammarLessonNext', user?.id, detail.data?.jlpt_level], () => api.get<{lesson: Item | null}>('/grammar-lessons/next', {params:{level: detail.data!.jlpt_level}}).then(r => r.data.lesson), {enabled: !!detail.data})
  const save = useMutation((value: 'studied' | 'mastered') => api.put(`/grammar-lessons/${id}/progress`, {status:value}), {onSuccess: () => { void cache.invalidateQueries(['grammarLesson']); void cache.invalidateQueries(['grammarLessons']); void cache.invalidateQueries(['grammarLessonNext']) }})
  const item = detail.data
  return <main className="space-y-5"><GrammarTabs /><h1 className="text-2xl font-bold text-[color:var(--text)]">{t('grammarLessons.title')}</h1>
    {!lessonId ? <><div className="flex flex-wrap gap-3"><label>{t('grammarLessons.level')} <select className="input" value={level} onChange={e=>setLevel(e.target.value)}>{['N5','N4','N3','N2','N1'].map(v=><option key={v}>{v}</option>)}</select></label><label>{t('grammarLessons.progress')} <select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t('grammarLessons.all')}</option>{(['not_started','studied','mastered'] as const).map(v=><option key={v} value={v}>{t(`grammarLessons.${v}`)}</option>)}</select></label></div>
      {list.isLoading && <p role="status">{t('grammarLessons.loading')}</p>}{list.isError && <p role="alert">{t('grammarLessons.error')} <button className="underline" onClick={()=>void list.refetch()}>{t('grammarLessons.retry')}</button></p>}
      {!list.isLoading && !list.isError && !list.data?.length && <p>{t('grammarLessons.empty')}</p>}
      <div className="grid gap-3">{list.data?.map(row=><Link key={row.id} to={`/grammar/lessons/${row.id}`} className="theme-card rounded-2xl p-4"><strong><KanjiText text={row.pattern} /></strong><span className="ml-3">{row.title}</span><span className="block text-sm text-[color:var(--text-muted)]">{t(`grammarLessons.${row.status}`)}</span></Link>)}</div></> : <>
      {detail.isLoading && <p role="status">{t('grammarLessons.loading')}</p>}{(detail.isError || !Number.isInteger(id) || id <= 0) && <p role="alert">{t('grammarLessons.error')} <Link className="underline" to="/grammar/lessons">{t('grammarLessons.back')}</Link></p>}
      {item && <article className="theme-card space-y-5 rounded-2xl p-5 text-[color:var(--text)]"><Link className="underline" to="/grammar/lessons">{t('grammarLessons.back')}</Link><h2 className="text-2xl font-bold"><KanjiText text={item.pattern} /></h2><p>{item.title} · {item.jlpt_level} · {t(`grammarLessons.${item.status}`)}</p>
        {([['formation',item.formation],['meaning',item.meaning],['usage',item.usage_notes]] as const).map(([key,value])=>value && <section key={key}><h3 className="font-bold">{t(`grammarLessons.${key}`)}</h3><p className="whitespace-pre-wrap break-words"><KanjiText text={value} /></p></section>)}
        <section><h3 className="font-bold">{t('grammarLessons.examples')}</h3>{item.examples.length ? item.examples.map((example,index)=><div key={index} className="my-2 rounded-xl bg-[color:var(--bg-elevated)] p-3"><p lang="ja">{example.tokens?.length ? example.tokens.map((token,n)=>token.reading ? <ruby key={n}><KanjiText text={token.text}/><rt>{token.reading}</rt></ruby> : <KanjiText key={n} text={token.text}/>) : <KanjiText text={example.ja}/>}</p><p>{example.vi}</p></div>) : <p>{t('grammarLessons.noContent')}</p>}</section>
        {([['errors',item.common_errors],['comparisons',item.comparisons]] as const).map(([key,values])=><section key={key}><h3 className="font-bold">{t(`grammarLessons.${key}`)}</h3>{values.length ? <ul className="list-disc pl-5">{values.map((value,n)=><li key={n}><KanjiText text={value}/></li>)}</ul> : <p>{t('grammarLessons.noContent')}</p>}</section>)}
        <section><h3 className="font-bold">{t('grammarLessons.quick')}</h3>{item.quick_questions.length ? <><ul className="list-disc pl-5">{item.quick_questions.map(q=><li key={q.id}><KanjiText text={q.prompt}/></li>)}</ul><Link className="btn btn-outline mt-3" to="/grammar/practice" state={{lessonPractice:{jlpt_level:item.jlpt_level,grammar_rule_id:item.grammar_rule_id,question_ids:item.quick_questions.map(q=>q.id),question_types:[...new Set(item.quick_questions.map(q=>q.question_type))]}}}>{t('grammarLessons.startQuick')}</Link></> : <p>{t('grammarLessons.noQuestions')}</p>}</section>
        <div className="flex flex-wrap gap-3"><Link className="btn btn-primary" to={`/grammar/practice?level=${encodeURIComponent(item.jlpt_level)}&rule=${item.grammar_rule_id}`}>{t('grammarLessons.practice')}</Link><button className="btn btn-outline" disabled={save.isLoading} onClick={()=>save.mutate('studied')}>{t('grammarLessons.markStudied')}</button><button className="btn btn-outline" disabled={save.isLoading} onClick={()=>save.mutate('mastered')}>{t('grammarLessons.markMastered')}</button></div>{save.isError && <p role="alert">{t('grammarLessons.error')}</p>}{next.data && next.data.id !== item.id && <Link className="inline-block underline" to={`/grammar/lessons/${next.data.id}`}>{t('grammarLessons.next')}: {next.data.pattern}</Link>}
      </article>}</>}
  </main>
}
