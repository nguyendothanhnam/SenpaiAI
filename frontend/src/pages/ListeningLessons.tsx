import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Headphones, Search } from 'lucide-react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { listeningAPI } from '../services/api'

export default function ListeningLessons() {
  const { t } = useTranslation('common')
  const [level, setLevel] = useState('')
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const query = useQuery(['listening-lessons', level, topic, search, page], () => listeningAPI.getLessons({ jlpt_level: level || undefined, topic: topic || undefined, search: search.trim() || undefined, limit: 12, offset: page * 12 }).then(({ data }) => data), { keepPreviousData: true, retry: 1 })
  const lessons = query.data?.items ?? []

  return <section className="space-y-6 text-[color:var(--text)]">
    <header className="flex flex-wrap items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]"><Headphones className="h-7 w-7" /></span><div><h1 className="text-3xl font-bold">{t('listening.title')}</h1><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('listening.subtitle')}</p></div></header>
    <form onSubmit={(event) => { event.preventDefault(); setPage(0) }} className="theme-card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder={t('listening.search')} className="input w-full pl-9" /></label><select aria-label={t('listening.jlpt')} value={level} onChange={(event) => { setLevel(event.target.value); setPage(0) }} className="input"><option value="">{t('listening.jlpt')}</option>{['N5', 'N4', 'N3', 'N2', 'N1'].map((item) => <option key={item}>{item}</option>)}</select><input aria-label={t('listening.topic')} value={topic} onChange={(event) => { setTopic(event.target.value); setPage(0) }} placeholder={t('listening.topic')} className="input" /><button type="submit" className="btn btn-primary">{t('listening.searchButton')}</button></form>
    {query.isLoading ? <div className="theme-card p-8 text-center text-[color:var(--text-muted)]">{t('listening.loading')}</div> : query.isError ? <div className="theme-card p-8 text-center"><p>{t('listening.loadError')}</p><button type="button" onClick={() => void query.refetch()} className="btn btn-outline mt-3">{t('listening.retry')}</button></div> : lessons.length === 0 ? <div className="theme-card p-10 text-center text-[color:var(--text-muted)]">{t('listening.empty')}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lessons.map((lesson) => <Link key={lesson.id} to={`/listening/${lesson.id}`} className="theme-card group flex min-h-48 flex-col p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"><span className="flex items-center justify-between"><span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{lesson.jlpt_level}</span><span className="text-xs text-[color:var(--text-muted)]">{lesson.topic}</span></span><h2 className="mt-4 text-lg font-semibold group-hover:text-[color:var(--primary)]">{lesson.title}</h2><p className="mt-2 line-clamp-3 flex-1 text-sm text-[color:var(--text-muted)]">{lesson.description}</p><span className="mt-4 flex items-center justify-between text-xs text-[color:var(--text-muted)]"><span>{lesson.duration_ms ? `${Math.ceil(lesson.duration_ms / 60000)} ${t('listening.minutes')}` : t('listening.lesson')}</span><span>{lesson.source === 'seed' ? t('listening.created') : 'SenpaiAI'}</span></span></Link>)}</div>}
    {query.data && query.data.total > 12 && <div className="flex items-center justify-center gap-3"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="btn btn-outline">{t('listening.previous')}</button><span className="text-sm text-[color:var(--text-muted)]">{t('listening.page', { current: page + 1, total: Math.ceil(query.data.total / 12) })}</span><button type="button" disabled={(page + 1) * 12 >= query.data.total} onClick={() => setPage((value) => value + 1)} className="btn btn-outline">{t('listening.next')}</button></div>}
  </section>
}
