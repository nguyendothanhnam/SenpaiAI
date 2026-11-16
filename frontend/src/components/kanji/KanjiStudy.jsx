import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Shuffle, Volume2 } from 'lucide-react'
import { kanjiDataAPI } from '../../services/api'
import { normalizeKanjiItem, kanaToBasicRomaji } from '../../data/kanjiDataset'
import { KANJI_DICTIONARY_LEVELS } from '../../constants/jlptLevels'
import { makeStudyQuestion } from '../../features/kanji/study'

function Speak({ text }) {
  const { t } = useTranslation('common')
  const supported = typeof window !== 'undefined' && Boolean(window.speechSynthesis)
  return <button type="button" disabled={!text || !supported} aria-label={t('kanjiStudy.listen')} title={!supported ? t('kanjiStudy.voiceUnavailable') : undefined} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--primary)] disabled:opacity-40" onClick={() => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'; utterance.rate = .9
    window.speechSynthesis.speak(utterance)
  }}><Volume2 size={18} aria-hidden="true" /></button>
}

export default function KanjiStudy() {
  const { t, i18n } = useTranslation('common')
  const [params] = useSearchParams()
  const [level, setLevel] = useState(() => KANJI_DICTIONARY_LEVELS.includes(params.get('level')) ? params.get('level') : 'N5')
  const [search, setSearch] = useState(''), [index, setIndex] = useState(0)
  const [quiz, setQuiz] = useState(null), [answer, setAnswer] = useState(null), [reviewed, setReviewed] = useState([])
  const query = useQuery(['kanjiStudy', level], () => kanjiDataAPI.list({ jlpt: level, limit: 500 }).then(({ data }) => data.items), { staleTime: 60000, retry: 1 })
  const items = useMemo(() => (query.data || []).map(normalizeKanjiItem).filter(Boolean), [query.data])
  const language = i18n.language.startsWith('en') ? 'en' : 'vi'
  const meaning = item => language === 'en' ? item.meaning_en || item.meaning_vi : item.meaning_vi || item.meaning_en
  const visible = items.filter(item => `${item.kanji} ${item.meaning_vi} ${item.meaning_en} ${item.onyomi.join(' ')} ${item.kunyomi.join(' ')} ${item.romaji.join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const item = visible[index % Math.max(1, visible.length)]
  const question = useMemo(() => item && quiz ? makeStudyQuestion(items, item, quiz, language) : null, [items, item, quiz, language])
  useEffect(() => { setIndex(0); setQuiz(null); setAnswer(null) }, [level, search])
  useEffect(() => { setQuiz(null); setAnswer(null) }, [item?.kanji, language])
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])
  const move = offset => setIndex(value => (value + offset + visible.length) % visible.length)
  const read = () => setReviewed(previous => [...new Set([...previous, item.kanji])])
  const completed = items.filter(entry => reviewed.includes(entry.kanji)).length
  return <section className="space-y-4" aria-labelledby="kanji-study-title">
    <div className="theme-card flex flex-wrap items-end justify-between gap-4 p-5"><div><h2 id="kanji-study-title" className="text-xl font-bold">{t('kanjiStudy.title')}</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.description')}</p></div><label className="text-sm font-semibold">{t('minigames.level')}<select value={level} onChange={event => setLevel(event.target.value)} className="ml-3 min-h-[44px] rounded-xl border px-3">{KANJI_DICTIONARY_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label><input aria-label={t('kanjiStudy.search')} placeholder={t('kanjiStudy.search')} value={search} onChange={event => setSearch(event.target.value)} className="input min-h-[44px] w-full" /></div>
    {query.isLoading ? <p role="status">{t('kanjiStudy.loading')}</p> : query.isError ? <div role="alert" className="theme-card p-5"><p>{t('kanjiStudy.loadError')}</p><button type="button" className="btn btn-primary mt-3 px-4 py-3" onClick={() => query.refetch()}>{t('kanjiStudy.retry')}</button></div> : !item ? <p className="theme-card p-5">{t('kanjiStudy.empty')}</p> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4"><div className="theme-card p-5"><div className="mb-4 flex justify-between gap-3"><p className="font-semibold text-[color:var(--primary)]">{t('kanjiStudy.position', { current: index % visible.length + 1, total: visible.length })}</p><span className="jlpt-badge bg-[color:var(--accent)]">{level}</span></div><div className="grid gap-5 sm:grid-cols-[190px_minmax(0,1fr)]"><div className="flex items-center justify-center rounded-2xl bg-[color:var(--accent)] p-6 text-[100px] leading-none japanese-text">{item.kanji}</div><div><p className="text-sm font-semibold text-[color:var(--text-muted)]">{t('kanjiStudy.meaning')}</p><h3 className="mt-2 text-2xl font-bold">{meaning(item)}</h3>{language === 'vi' && item.meaning_en && <p className="mt-2 text-[color:var(--text-muted)]">{item.meaning_en}</p>}<p className="mt-5 text-sm font-semibold">{t('kanjiStudy.romaji')}</p><p className="mt-1 break-words text-sm">{[...item.onyomi, ...item.kunyomi].map(kanaToBasicRomaji).filter(Boolean).join(', ')}</p><p className="mt-5 text-sm">{t('kanjiStudy.strokes', { count: item.stroke_count })}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2"><button type="button" className="btn btn-outline min-h-[44px] px-4" onClick={() => move(-1)}><ChevronLeft size={18} />{t('kanjiStudy.previous')}</button><button type="button" className="btn btn-outline min-h-[44px] px-4" onClick={() => setIndex(value => visible.length < 2 ? 0 : (value + 1 + Math.floor(Math.random() * (visible.length - 1))) % visible.length)}><Shuffle size={17} />{t('kanjiStudy.random')}</button><button type="button" className="btn btn-primary min-h-[44px] px-4" onClick={() => { read(); move(1) }}>{t('kanjiStudy.next')}<ChevronRight size={18} /></button></div></div>
      <div className="grid gap-4 sm:grid-cols-2">{[['onyomi', item.onyomi], ['kunyomi', item.kunyomi]].map(([key, readings]) => <section key={key} className="theme-card p-4"><h3 className="mb-3 font-bold">{t(`kanjiStudy.${key}`)}</h3>{readings.length ? readings.map(reading => <div key={reading} className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[color:var(--bg-elevated)] p-3"><div><p className="japanese-text text-lg font-bold">{reading}</p><p className="text-sm text-[color:var(--text-muted)]">{kanaToBasicRomaji(reading)}</p></div><Speak text={reading.replace(/[.-]/g, '')} /></div>) : <p className="text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.noReading')}</p>}</section>)}</div></div>
      <aside className="space-y-4"><section className="theme-card p-5"><h3 className="mb-3 text-lg font-bold">{t('kanjiStudy.examples')}</h3>{item.examples.length ? item.examples.map((example, n) => <div key={n} className="mb-3 rounded-xl border bg-[color:var(--bg-elevated)] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="japanese-text break-words font-semibold">{example.word}</p><p className="japanese-text text-sm">{example.reading}</p><p className="mt-1 text-sm">{example.meaning_vi}</p></div><Speak text={example.word} /></div></div>) : <p className="text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.noExamples')}</p>}</section>
      <section className="theme-card p-5"><h3 className="mb-3 font-bold">{t('kanjiStudy.quickQuiz')}</h3><div className="flex flex-wrap gap-2">{['reading', 'meaning'].map(kind => <button type="button" key={kind} onClick={() => { setQuiz(kind); setAnswer(null) }} className="btn btn-outline min-h-[44px] flex-1 px-3" aria-pressed={quiz === kind}>{t(`kanjiStudy.${kind}Quiz`)}</button>)}</div>{quiz && (question ? <div className="mt-4"><p className="mb-3 font-semibold">{t(quiz === 'reading' ? 'kanjiStudy.readingPrompt' : 'kanjiStudy.meaningPrompt', { kanji: item.kanji })}</p><div className="grid gap-2">{question.options.map(value => <button type="button" key={value} disabled={answer !== null} className="btn btn-outline min-h-[44px] break-words px-3 py-2" onClick={() => { setAnswer(value); if (value === question.correct) read() }}>{value}</button>)}</div>{answer !== null && <p role="status" className="mt-3 text-sm font-semibold">{t(answer === question.correct ? 'kanjiStudy.correct' : 'kanjiStudy.wrong', { answer: question.correct })}</p>}</div> : <p className="mt-3 text-sm">{t('kanjiStudy.notEnoughChoices')}</p>)}</section>
      <section className="theme-card p-5"><h3 className="font-bold">{t('kanjiStudy.progress')}</h3><p className="mt-2 text-sm">{t('kanjiStudy.reviewed', { count: completed, total: items.length })}</p><progress className="mt-3 h-2 w-full accent-[color:var(--primary)]" value={completed} max={Math.max(1, items.length)} /><p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('kanjiStudy.sessionProgress')}</p></section></aside>
    </div>}
    <p className="text-xs text-[color:var(--text-muted)]">{t('kanjiStudy.sources')} <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer" className="underline">KANJIDIC / EDRDG</a> · <a href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noreferrer" className="underline">kanji-data</a> · <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer" className="underline">CC BY-SA 4.0</a></p>
  </section>
}
