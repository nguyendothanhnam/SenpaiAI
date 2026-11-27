import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Shuffle, Volume2, Sparkles, Brain, BookOpen, Eye, EyeOff, CheckCircle2, XCircle, Search } from 'lucide-react'
import { kanjiDataAPI } from '../../services/api'
import { normalizeKanjiItem, kanaToBasicRomaji } from '../../data/kanjiDataset'
import { KANJI_DICTIONARY_LEVELS } from '../../constants/jlptLevels'
import { makeStudyQuestion } from '../../features/kanji/study'
import { useAuth } from '../../services/auth'
import { placementDefault } from '../../utils/placementDefaults'
import './kanjiStudy.css'

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
  const { user } = useAuth()
  const [level, setLevel] = useState(() => placementDefault(params.toString(), user?.current_jlpt_level, KANJI_DICTIONARY_LEVELS, 'N5'))
  const [search, setSearch] = useState(() => params.get('character') || ''), [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [quiz, setQuiz] = useState(null), [answer, setAnswer] = useState(null), [reviewed, setReviewed] = useState([])
  const query = useQuery(['kanjiStudy', level], () => kanjiDataAPI.list({ jlpt: level, limit: 500 }).then(({ data }) => data.items), { staleTime: 60000, retry: 1 })
  const items = useMemo(() => (query.data || []).map(normalizeKanjiItem).filter(Boolean), [query.data])
  const language = i18n.language.startsWith('en') ? 'en' : 'vi'
  const meaning = item => language === 'en' ? item.meaning_en || item.meaning_vi : item.meaning_vi || item.meaning_en
  const visible = items.filter(item => `${item.kanji} ${item.meaning_vi} ${item.meaning_en} ${item.onyomi.join(' ')} ${item.kunyomi.join(' ')} ${item.romaji.join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const item = visible[index % Math.max(1, visible.length)]
  const question = useMemo(() => item && quiz ? makeStudyQuestion(items, item, quiz, language) : null, [items, item, quiz, language])
  useEffect(() => { setIndex(0); setQuiz(null); setAnswer(null) }, [level, search])
  useEffect(() => { setQuiz(null); setAnswer(null); setRevealed(false) }, [item?.kanji, language])
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])
  const move = offset => setIndex(value => (value + offset + visible.length) % visible.length)
  const read = () => setReviewed(previous => [...new Set([...previous, item.kanji])])
  const completed = items.filter(entry => reviewed.includes(entry.kanji)).length
  const questionPending = Boolean(question && answer === null)
  const detailsVisible = revealed && !questionPending
  const percent = items.length ? Math.round(completed / items.length * 100) : 0
  const previewStart = Math.max(0, Math.min(index - 3, visible.length - 8))
  return <section className="kanji-study space-y-5" aria-labelledby="kanji-study-title">
    <header className="theme-card study-header p-5">
      <div><p className="study-eyebrow"><Sparkles size={15} aria-hidden="true"/>{t('kanjiStudy.activeStudy')}</p><h2 id="kanji-study-title" className="mt-2 text-2xl font-bold">{t('kanjiStudy.title')}</h2><p className="mt-2 max-w-xl text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.activeDescription')}</p></div>
      <label className="text-sm font-semibold">{t('minigames.level')}<select value={level} onChange={event=>setLevel(event.target.value)} className="ml-3 min-h-[44px] rounded-xl border bg-[color:var(--card)] px-3">{KANJI_DICTIONARY_LEVELS.map(value=><option key={value}>{value}</option>)}</select></label>
      <div className="study-search"><Search size={18} aria-hidden="true"/><input aria-label={t('kanjiStudy.search')} placeholder={t('kanjiStudy.search')} value={search} onChange={event=>setSearch(event.target.value)} className="input min-h-[44px] w-full"/></div>
    </header>
    {query.isLoading ? <p role="status" className="theme-card p-5">{t('kanjiStudy.loading')}</p> : query.isError ? <div role="alert" className="theme-card p-5"><p>{t('kanjiStudy.loadError')}</p><button type="button" className="btn btn-primary mt-3" onClick={()=>query.refetch()}>{t('kanjiStudy.retry')}</button></div> : !item ? <p className="theme-card p-5">{t('kanjiStudy.empty')}</p> : <div className="study-main">
      <div className="space-y-4">
        <article className="theme-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-[color:var(--text-muted)]">{t('kanjiStudy.position',{current:index%visible.length+1,total:visible.length})}</p><div className="study-pills"><span className="study-pill">{level}</span><span className="study-pill">{t('kanjiStudy.strokes',{count:item.stroke_count})}</span>{reviewed.includes(item.kanji)&&<span className="study-pill"><CheckCircle2 size={14} aria-hidden="true"/>{t('kanjiStudy.reviewedBadge')}</span>}</div></div>
          <div className="study-character"><div className="study-glyph japanese-text" lang="ja"><span key={item.kanji}>{item.kanji}</span></div><div className="study-memory">
            {detailsVisible ? <><p className="study-memory-label"><BookOpen size={16} aria-hidden="true"/>{t('kanjiStudy.meaning')}</p><h3>{meaning(item)}</h3>{language==='vi'&&item.meaning_en&&<p className="text-sm text-[color:var(--text-muted)]">{item.meaning_en}</p>}<div><p className="study-memory-label">{t('kanjiStudy.romaji')}</p><p className="mt-1 break-words text-sm">{[...item.onyomi,...item.kunyomi].map(kanaToBasicRomaji).filter(Boolean).join(', ')}</p></div></> : <><p className="study-memory-label"><Brain size={17} aria-hidden="true"/>{t('kanjiStudy.recallTitle')}</p><p className="study-memory-prompt">{t('kanjiStudy.recallPrompt')}</p><p className="text-sm text-[color:var(--text-muted)]">{t(questionPending?'kanjiStudy.quizConcealed':'kanjiStudy.recallHelp')}</p></>}
            <button type="button" className="btn btn-outline w-fit" disabled={questionPending} aria-expanded={detailsVisible} onClick={()=>setRevealed(value=>!value)}>{detailsVisible?<EyeOff size={17} aria-hidden="true"/>:<Eye size={17} aria-hidden="true"/>}{t(detailsVisible?'kanjiStudy.hideDetails':'kanjiStudy.revealDetails')}</button>
          </div></div>
          <nav className="study-navigation" aria-label={t('kanjiStudy.characterNavigation')}><button type="button" className="btn btn-outline" onClick={()=>move(-1)}><ChevronLeft size={17} aria-hidden="true"/>{t('kanjiStudy.previous')}</button><button type="button" className="btn btn-outline" onClick={()=>setIndex(value=>visible.length<2?0:(value+1+Math.floor(Math.random()*(visible.length-1)))%visible.length)}><Shuffle size={17} aria-hidden="true"/>{t('kanjiStudy.random')}</button><button type="button" className="btn btn-primary" onClick={()=>{read();move(1)}}>{t('kanjiStudy.next')}<ChevronRight size={17} aria-hidden="true"/></button></nav>
        </article>
        <div className="study-readings">{[['onyomi',item.onyomi],['kunyomi',item.kunyomi]].map(([key,readings])=><section key={key} className="theme-card p-4"><h3 className="mb-3 font-bold">{t(`kanjiStudy.${key}`)}</h3>{!detailsVisible?<div className="study-locked"><EyeOff size={20} aria-hidden="true"/><p>{t('kanjiStudy.detailsHidden')}</p></div>:readings.length?readings.map(reading=><div key={reading} className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[color:var(--bg-elevated)] p-3"><div><p className="japanese-text text-lg font-bold" lang="ja">{reading}</p><p className="text-sm text-[color:var(--text-muted)]">{kanaToBasicRomaji(reading)}</p></div><Speak text={reading.replace(/[.-]/g,'')}/></div>):<p className="text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.noReading')}</p>}</section>)}</div>
        <section className="theme-card p-4"><h3 className="mb-3 text-sm font-semibold">{t('kanjiStudy.characterStrip')}</h3><div className="study-next">{visible.slice(previewStart,previewStart+8).map((entry,offset)=><button type="button" key={entry.kanji} lang="ja" aria-label={t('kanjiStudy.selectCharacter',{kanji:entry.kanji})} aria-pressed={entry.kanji===item.kanji} onClick={()=>setIndex(previewStart+offset)}>{entry.kanji}{reviewed.includes(entry.kanji)&&<CheckCircle2 size={14} aria-hidden="true"/>}</button>)}</div></section>
      </div>
      <aside className="study-sidebar space-y-4 xl:space-y-4">
        <section className="theme-card space-y-4 p-5"><div className="flex items-center gap-3"><span className="study-question-icon"><Brain size={23} aria-hidden="true"/></span><div><h3 className="font-bold">{t('kanjiStudy.quickQuiz')}</h3><p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('kanjiStudy.quizInvitation')}</p></div></div><div className="grid grid-cols-2 gap-2">{['reading','meaning'].map(kind=><button type="button" key={kind} className="btn btn-outline" aria-pressed={quiz===kind} onClick={()=>{setQuiz(kind);setAnswer(null)}}>{t(`kanjiStudy.${kind}Quiz`)}</button>)}</div>
          {quiz&&(question?<div className="space-y-3"><p className="text-sm font-semibold">{t(quiz==='reading'?'kanjiStudy.readingPrompt':'kanjiStudy.meaningPrompt',{kanji:item.kanji})}</p><div className="study-options">{question.options.map(value=><button type="button" key={value} disabled={answer!==null} aria-pressed={answer===value} data-result={answer===null?undefined:value===question.correct?'correct':answer===value?'wrong':undefined} className="study-option" onClick={()=>{setAnswer(value);setRevealed(true);if(value===question.correct)read()}}>{value}</button>)}</div>{answer!==null&&<p role="status" className="study-feedback" data-correct={answer===question.correct}>{answer===question.correct?<CheckCircle2 size={18} className="shrink-0" aria-hidden="true"/>:<XCircle size={18} className="shrink-0" aria-hidden="true"/>}{t(answer===question.correct?'kanjiStudy.correct':'kanjiStudy.wrong',{answer:question.correct})}</p>}</div>:<p className="text-sm">{t('kanjiStudy.notEnoughChoices')}</p>)}
        </section>
        <section className="theme-card p-5"><h3 className="mb-4 font-bold">{t('kanjiStudy.examples')}</h3>{!detailsVisible?<div className="study-locked"><BookOpen size={22} aria-hidden="true"/><p>{t('kanjiStudy.detailsHidden')}</p></div>:item.examples.length?item.examples.map((example,n)=><div key={n} className="mb-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="japanese-text break-words font-semibold" lang="ja">{example.word}</p><p className="japanese-text text-sm" lang="ja">{example.reading}</p><p className="mt-1 text-sm">{example.meaning_vi}</p></div><Speak text={example.word}/></div></div>):<p className="text-sm text-[color:var(--text-muted)]">{t('kanjiStudy.noExamples')}</p>}</section>
        <section className="theme-card p-5"><div className="flex items-center gap-4"><div className="study-progress-ring" role="img" aria-label={t('kanjiStudy.reviewed',{count:completed,total:items.length})}><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent)" strokeWidth="9"/><circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`}/></svg><strong>{percent}%</strong></div><div><h3 className="font-bold">{t('kanjiStudy.progress')}</h3><p className="mt-2 text-sm">{t('kanjiStudy.reviewed',{count:completed,total:items.length})}</p></div></div><p className="mt-4 text-xs leading-5 text-[color:var(--text-muted)]">{t('kanjiStudy.sessionProgress')}</p></section>
      </aside>
    </div>}
    <p className="study-credits text-xs text-[color:var(--text-muted)]">{t('kanjiStudy.sources')} <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer" className="underline">KANJIDIC / EDRDG</a> · <a href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noreferrer" className="underline">kanji-data</a> · <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer" className="underline">CC BY-SA 4.0</a></p>
  </section>
}
