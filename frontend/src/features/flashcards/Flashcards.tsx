import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth'
import { flashcardsAPI as api } from '../../services/flashcards'
import type { DeckInput, FlashCard, ReviewPayload, TextPreview } from '../../services/flashcards'
import { confirmDialog } from '../dialogs/queue'
import { draftKey, reviewSummary, studyCards, validateDeck } from './logic'
import './flashcards.css'
import FlashcardShell from './FlashcardShell'
import { Search, Volume2 } from 'lucide-react'
import AssessmentPage, { FlashcardStatistics } from './Assessment'
import { KanjiText } from '../../components/kanji/KanjiText'

type View='library'|'detail'|'editor'|'play'|'learn'|'test'|'stats'
const blank=():FlashCard=>({front:'',back:'',reading:'',note:''})
const empty=():DeckInput=>({title:'',description:'',jlpt_level:null,topic:'',cards:[]})
const levels=['N5','N4','N3','N2','N1']
const button='btn btn-outline px-3'

function useWords(){const {t,i18n}=useTranslation('common');return{f:(key:string,values?:Record<string,unknown>)=>String(t(`flashcardsManager.${key}`,values)),language:i18n.language}}
function useFailure(){
  const {f}=useWords();const [error,setError]=useState('')
  const fail=(reason:unknown)=>{const key=(reason as {response?:{data?:{detail?:unknown}}})?.response?.data?.detail;setError(typeof key==='string'&&key.startsWith('flashcards.')?f(key.slice(11)):f('error'))}
  return{error,setError,fail}
}
function Frame({children,deckTitle}:{children:ReactNode;deckTitle?:string}){return <FlashcardShell deckTitle={deckTitle}>{children}</FlashcardShell>}
function Ring({value}:{value:number}){const{f}=useWords();return <div className="fc-ring-wrap"><span className="fc-ring-stage"><svg className="fc-ring" viewBox="0 0 40 40" role="img" aria-label={f('masteredPercent',{value})}><circle cx="20" cy="20" r="16" fill="none" stroke="var(--border)" strokeWidth="4"/><circle cx="20" cy="20" r="16" fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray={`${value} ${100-value}`} pathLength="100"/></svg><strong aria-hidden="true">{value}%</strong></span><span>{f('masteredPercent',{value})}</span></div>}
function ErrorText({children}:{children:ReactNode}){return children?<p role="alert" className="fc-panel">{children}</p>:null}

export default function FlashcardPage({view}:{view:View}){
  const{user}=useAuth();const{f}=useWords()
  if(!user)return <div className="fc-layout"><p role="status">{f('signIn')}</p></div>
  return <AccountPage key={user.id} view={view} account={user.id}/>
}
function AccountPage({view,account}:{view:View;account:number}){
  const params=useParams(),location=useLocation(),[search]=useSearchParams()
  const id=Number(params.deckId||search.get('set')||(location.state as {setId?:number}|null)?.setId)||undefined
  if(view==='learn'||view==='test')return <AssessmentPage key={`${id}:${view}`} account={account} id={id} mode={view}/>
  if(view==='stats')return <FlashcardStatistics key={id||'all'} account={account} id={id}/>
  if(view==='library')return <Library account={account}/>
  if(view==='editor')return <Editor key={id||'new'} account={account} id={id}/>
  if(view==='play')return <Player key={`${id||'today'}`} account={account} id={id}/>
  return <Detail account={account} id={id}/>
}

function Library({account}:{account:number}){
  const{f,language}=useWords(),navigate=useNavigate(),cache=useQueryClient()
  const[search,setSearch]=useState(''),[level,setLevel]=useState(''),[topic,setTopic]=useState(''),[sort,setSort]=useState('recent'),[offset,setOffset]=useState(0)
  const{error,setError,fail}=useFailure(),[busy,setBusy]=useState(false)
  const[quick,setQuick]=useState({title:'',source:'kanji',level:'N5',group:0})
  const list=useQuery(['flashcards',account,'list',search,level,topic,sort,offset],()=>api.list({search,...(level?{level}:{}),...(topic?{topic}:{}),sort,offset,limit:20}))
  const catalog=useQuery(['flashcards',account,'catalog'],()=>api.list({limit:100}))
  const stats=useQuery(['flashcards',account,'stats'],api.stats)
  const refresh=()=>cache.invalidateQueries(['flashcards',account])
  const run=async(action:()=>Promise<unknown>)=>{setError('');setBusy(true);try{await action();await refresh()}catch(e){fail(e)}finally{setBusy(false)}}
  const filters=(action:()=>void)=>{action();setOffset(0)}
  return <Frame><header className="fc-panel fc-header"><div><h1 className="text-2xl font-bold">{f('title')}</h1><p className="fc-muted">{f('subtitle')}</p></div><div className="fc-row"><Link className="btn btn-primary px-3" to="/flashcard/manual">{f('create')}</Link><Link className={button} to="/flashcard/play?today=1">{f('today',{count:stats.data?.due_today||0})}</Link></div></header>
    <ErrorText>{error||((list.isError||stats.isError)?f('error'):'')}</ErrorText>{(list.isError||stats.isError)&&<button className={button} onClick={()=>void refresh()}>{f('retry')}</button>}
    <details className="fc-panel"><summary>{f('quick')}</summary><div className="fc-quick-fields mt-3"><label>{f('deckTitle')}<input maxLength={160} value={quick.title} onChange={e=>setQuick({...quick,title:e.target.value})}/></label><label>{f('source')}<select value={quick.source} onChange={e=>setQuick({...quick,source:e.target.value})}><option value="kanji">{f('kanji')}</option><option value="vocabulary">{f('vocabulary')}</option></select></label><label>{f('level')}<select value={quick.level} onChange={e=>setQuick({...quick,level:e.target.value})}>{levels.map(l=><option key={l}>{l}</option>)}</select></label><label>{f('group')}<input type="number" min={1} max={10001} value={quick.group+1} onChange={e=>setQuick({...quick,group:Math.max(0,Number(e.target.value)-1)})}/></label><button className={button} disabled={busy||!quick.title.trim()} onClick={()=>void run(async()=>{const deck=await api.quick(quick);navigate(`/flashcard/${deck.id}`)})}>{f('create')}</button></div></details>
    <section className="fc-filters fc-panel"><label className="fc-search">{f('search')}<Search size={17} aria-hidden="true"/><input type="search" value={search} onChange={e=>filters(()=>setSearch(e.target.value))}/></label><label>{f('level')}<select value={level} onChange={e=>filters(()=>setLevel(e.target.value))}><option value="">{f('all')}</option>{levels.map(l=><option key={l}>{l}</option>)}</select></label><label>{f('topic')}<select value={topic} onChange={e=>filters(()=>setTopic(e.target.value))}><option value="">{f('all')}</option>{[...new Set(catalog.data?.items.map(d=>d.topic).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select></label><label>{f('sort')}<select value={sort} onChange={e=>filters(()=>setSort(e.target.value))}>{['recent','name','progress'].map(v=><option value={v} key={v}>{f(v)}</option>)}</select></label></section>
    {list.isLoading?<p role="status">{f('loading')}</p>:<section className="fc-grid">{list.data?.items.map(deck=><article key={deck.id} className="fc-panel fc-deck"><h2 className="text-xl font-bold fc-card-text"><Link to={`/flashcard/${deck.id}`}>{deck.title}</Link></h2><div className="fc-badges"><span className="fc-badge">{deck.jlpt_level||f('mixed')}</span>{deck.topic&&<span className="fc-badge">{deck.topic}</span>}<span className="fc-muted text-sm">{f('cardCount',{count:deck.stats.total})}</span></div><Ring value={deck.stats.mastered_percent}/><p className="fc-muted">{f('lastStudy')}: {deck.stats.last_studied_at?new Date(deck.stats.last_studied_at).toLocaleDateString(language):f('notYet')}</p><div className="fc-row fc-deck-actions"><Link className="btn btn-primary" to={`/flashcard/${deck.id}`}>{f('open')}</Link><button className={button} disabled={busy} onClick={()=>void run(()=>api.duplicate(deck.id))}>{f('duplicate')}</button><button className={`${button} fc-danger`} disabled={busy} onClick={()=>void run(async()=>{if(await confirmDialog(f('deleteConfirm'),{tone:'danger'}))await api.remove(deck.id)})}>{f('delete')}</button></div></article>)}</section>}
    {list.data?.total===0&&<p>{f('empty')}</p>}<div className="fc-row fc-toolbar"><button className={button} disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-20))}>{f('previous')}</button><span>{f('resultCount',{count:list.data?.total||0})}</span><button className={button} disabled={offset+20>=(list.data?.total||0)} onClick={()=>setOffset(v=>v+20)}>{f('next')}</button></div>
  </Frame>
}

function useSpeech(){
  const[enabled,setEnabled]=useState(false),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([])
  useEffect(()=>{
    if(!('speechSynthesis'in window))return
    const update=()=>setVoices(window.speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('ja')))
    update();window.speechSynthesis.addEventListener('voiceschanged',update)
    return()=>{window.speechSynthesis.removeEventListener('voiceschanged',update);window.speechSynthesis.cancel()}
  },[])
  const speak=useCallback((card:FlashCard)=>{
    if(!enabled||!voices.length)return
    const text=card.reading||(/[\u3040-\u30ff\u3400-\u9fff]/.test(card.front)?card.front:card.back)
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ja-JP';utterance.voice=voices[0];window.speechSynthesis.speak(utterance)
  },[enabled,voices])
  return{enabled,setEnabled,available:!!voices.length,speak}
}
function SpeechControl({speech}:{speech:ReturnType<typeof useSpeech>}){const{f}=useWords();return <div><label className="fc-toggle"><input type="checkbox" checked={speech.enabled} disabled={!speech.available} onChange={e=>{speech.setEnabled(e.target.checked);if(!e.target.checked&&'speechSynthesis'in window)window.speechSynthesis.cancel()}}/>{f('speech')}</label>{!speech.available&&<p className="fc-muted text-sm">{f('noVoice')}</p>}</div>}

function Detail({account,id}:{account:number;id?:number}){
  const{f}=useWords(),cache=useQueryClient(),speech=useSpeech(),{error,setError,fail}=useFailure(),[busy,setBusy]=useState(false)
  const deck=useQuery(['flashcards',account,'detail',id],()=>api.detail(id!),{enabled:!!id})
  const download=async(format:string)=>{try{const blob=await api.export(id!,format),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`flashcards-${id}.${format==='csv'?'csv':'txt'}`;a.click();URL.revokeObjectURL(url)}catch(e){fail(e)}}
  if(deck.isLoading)return <Frame><p role="status">{f('loading')}</p></Frame>
  if(!deck.data)return <Frame><ErrorText>{f('notFound')}</ErrorText><button className={button} onClick={()=>void deck.refetch()}>{f('retry')}</button></Frame>
  const value=deck.data
  return <Frame deckTitle={value.title}><ErrorText>{error}</ErrorText><header className="fc-panel space-y-3"><h1 className="text-2xl font-bold fc-card-text">{value.title}</h1><p className="fc-card-text">{value.description}</p><div className="fc-badges"><span className="fc-badge">{value.jlpt_level||f('mixed')}</span>{value.topic&&<span className="fc-badge">{value.topic}</span>}</div><Ring value={value.stats.mastered_percent}/><div className="fc-row">{(['new','learning','mastered']as const).map(state=><span className={`fc-status fc-status-${state}`} key={state}>{f(state)}: {value.stats[state]||0}</span>)}</div><div className="fc-row"><Link className="btn btn-primary px-3" to={`/flashcard/play?set=${id}`}>{f('flipMode')}</Link><Link className={button} to={`/flashcard/learn?set=${id}`}>{f('learn')}</Link><Link className={button} to={`/flashcard/test?set=${id}`}>{f('test')}</Link><Link className={button} to={`/flashcard/manual?set=${id}`}>{f('edit')}</Link>{['csv','text'].map(format=><button className={button} key={format} onClick={()=>void download(format)}>{f(format==='csv'?'exportCsv':'exportText')}</button>)}</div><SpeechControl speech={speech}/></header>
    <section className="space-y-3" aria-label={f('cards')}>{value.cards.map(card=><article key={card.id} className="fc-panel fc-vocabulary"><div className="fc-vocabulary-content"><h2 className="text-xl font-bold fc-card-text" lang="ja"><KanjiText text={card.front} /></h2>{card.reading&&<p lang="ja" className="fc-muted">{card.reading}</p>}<p className="fc-card-text"><KanjiText text={card.back} /></p>{card.note&&<p className="fc-muted fc-card-text"><KanjiText text={card.note} /></p>}<span className={`fc-status fc-status-${card.progress?.state||'new'}`}>{f(card.progress?.state||'new')}</span></div><div className="fc-row"><button className={`${button} fc-icon-button`} disabled={busy} aria-pressed={!!card.progress?.starred} aria-label={f('star',{front:card.front})} onClick={()=>{setBusy(true);setError('');void api.star(id!,card.id!,!card.progress?.starred).then(()=>cache.invalidateQueries(['flashcards',account])).catch(fail).finally(()=>setBusy(false))}}>{card.progress?.starred?'★':'☆'}</button><button className={`${button} fc-icon-button`} disabled={!speech.enabled||!speech.available} aria-label={f('listen')} title={f('listen')} onClick={()=>speech.speak(card)}><Volume2 size={18} aria-hidden="true"/></button></div></article>)}</section>
  </Frame>
}

function Editor({account,id}:{account:number;id?:number}){
  const{f}=useWords(),navigate=useNavigate(),cache=useQueryClient(),{error,setError,fail}=useFailure()
  const[data,setData]=useState<DeckInput>(empty),[ready,setReady]=useState(false),[draftSaved,setDraftSaved]=useState(false),[busy,setBusy]=useState(false)
  const[text,setText]=useState(''),[field,setField]=useState('\t'),[separator,setSeparator]=useState('\n'),[preview,setPreview]=useState<TextPreview|null>(null)
  const key=draftKey(account,id)
  const loaded=useQuery(['flashcards',account,'detail',id],()=>api.detail(id!),{enabled:!!id})
  useEffect(()=>{
    if(ready||id&&!loaded.data)return
    const original=loaded.data?{...loaded.data,cards:loaded.data.cards.map(c=>({...c}))}:empty()
    try{const raw=localStorage.getItem(key),draft=raw?JSON.parse(raw):null;if(draft&&Array.isArray(draft.cards)&&typeof draft.title==='string'&&typeof draft.description==='string'&&typeof draft.topic==='string'&&draft.cards.every((c:FlashCard)=>['front','back','reading','note'].every(k=>typeof c[k as keyof FlashCard]==='string'))){setData(draft);setDraftSaved(true)}else setData(original)}catch{setData(original);setError(f('draftError'))}
    setReady(true)
    // Initialize once; refetching must not overwrite an active editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,id,loaded.data,key])
  useEffect(()=>{if(!ready)return;setDraftSaved(false);const timer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(data));setDraftSaved(true)}catch{setError(f('draftError'))}},500);return()=>clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,data,key])
  const update=(index:number,key:keyof FlashCard,value:string)=>setData(d=>({...d,cards:d.cards.map((c,i)=>i===index?{...c,[key]:value}:c)}))
  const move=(index:number,direction:number)=>setData(d=>{const cards=[...d.cards];[cards[index],cards[index+direction]]=[cards[index+direction],cards[index]];return{...d,cards}})
  const save=async()=>{const invalid=validateDeck(data);if(invalid){setError(f(invalid));return}setBusy(true);setError('');try{const deck=await api.save(id,data);try{localStorage.removeItem(key)}catch{/* Server copy is already saved. */}await cache.invalidateQueries(['flashcards',account]);navigate(`/flashcard/${deck.id}`)}catch(e){fail(e);setBusy(false)}}
  const importFile=async(file:File|undefined)=>{if(!file)return;if(file.size>5*1024*1024){setError(f('fileTooLarge'));return}setBusy(true);setError('');try{const response=await api.importFile(file);setPreview({cards:response.cards.map((c:FlashCard)=>({...c,reading:c.reading||'',note:c.note||''})),errors:[]})}catch{setError(f('fileError'))}finally{setBusy(false)}}
  if(loaded.isError)return <Frame><ErrorText>{f('error')}</ErrorText><button className={button} onClick={()=>void loaded.refetch()}>{f('retry')}</button></Frame>
  if(!ready)return <Frame><p role="status">{f('loading')}</p></Frame>
  return <Frame deckTitle={data.title}><h1 className="text-2xl font-bold">{f(id?'edit':'create')}</h1><ErrorText>{error}</ErrorText><fieldset disabled={busy} className="space-y-4 min-w-0"><section className="fc-panel fc-editor-meta"><label>{f('deckTitle')}<input required maxLength={160} value={data.title} onChange={e=>setData({...data,title:e.target.value})}/></label><label>{f('description')}<textarea maxLength={2000} value={data.description} onChange={e=>setData({...data,description:e.target.value})}/></label><div className="fc-row"><label>{f('level')}<select value={data.jlpt_level||''} onChange={e=>setData({...data,jlpt_level:e.target.value||null})}><option value="">{f('mixed')}</option>{levels.map(l=><option key={l}>{l}</option>)}</select></label><label>{f('topic')}<input maxLength={100} value={data.topic} onChange={e=>setData({...data,topic:e.target.value})}/></label></div></section>
    <details className="fc-panel"><summary>{f('bulkImport')}</summary><p>{f('bulkHelp')}</p><div className="fc-row"><label>{f('fieldSeparator')}<select value={field} onChange={e=>{setField(e.target.value);setPreview(null)}}><option value={'\t'}>{f('tab')}</option><option value=";">;</option><option value=",">,</option><option value="::">::</option></select></label><label>{f('cardSeparator')}<select value={separator} onChange={e=>{setSeparator(e.target.value);setPreview(null)}}><option value={'\n'}>{f('newline')}</option><option value="|">|</option><option value={'\n\n'}>{f('blankLine')}</option></select></label><label>{f('file')}<input type="file" accept=".csv,.json,.xlsx,.xls" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label></div><label>{f('paste')}<textarea rows={5} maxLength={500000} value={text} onChange={e=>{setText(e.target.value);setPreview(null)}}/></label><button className={button} onClick={()=>{setBusy(true);void api.preview(text,field,separator).then(setPreview).catch(fail).finally(()=>setBusy(false))}}>{f('preview')}</button>{preview&&<div className="space-y-2"><p>{f('cardCount',{count:preview.cards.length})}</p>{preview.errors.map((e,i)=><p key={i} role="alert">{f('lineError',{line:e.line})}: {f(e.code==='duplicate'?'duplicateCard':e.code)}</p>)}<div className="max-h-60 overflow-auto">{preview.cards.map((c,i)=><p key={i} className="fc-card-text">{c.front} → {c.back} {c.reading}</p>)}</div><button className={button} disabled={!!preview.errors.length||!preview.cards.length||data.cards.length+preview.cards.length>500} onClick={()=>{const cards=[...data.cards,...preview.cards.map(c=>({...blank(),...c,id:undefined}))];const invalid=validateDeck({...data,title:data.title||'_',cards});if(invalid){setError(f(invalid));return}setData({...data,cards});setPreview(null)}}>{f('append')}</button></div>}</details>
    <section className="space-y-3" aria-label={f('cards')}>{data.cards.map((card,index)=><article className="fc-panel" key={card.id||`new-${index}`}><div className="fc-editor-heading"><h2 className="font-bold">{f('cardNumber',{number:index+1})}</h2><div className="fc-row mt-2"><button className={button} disabled={index===0} aria-label={f('moveUp',{number:index+1})} onClick={()=>move(index,-1)}>↑</button><button className={button} disabled={index===data.cards.length-1} aria-label={f('moveDown',{number:index+1})} onClick={()=>move(index,1)}>↓</button><button className={`${button} fc-danger`} aria-label={f('deleteCard',{number:index+1})} onClick={()=>setData(d=>({...d,cards:d.cards.filter((_,i)=>i!==index)}))}>{f('delete')}</button></div></div><div className="fc-editor-row">{(['front','back','reading','note']as const).map(k=><label key={k}>{f(k)}<textarea rows={2} maxLength={{front:1000,back:2000,reading:500,note:2000}[k]} value={card[k]} onChange={e=>update(index,k,e.target.value)}/></label>)}</div></article>)}</section>
    <div className="fc-row fc-toolbar fc-savebar"><button className={button} disabled={data.cards.length>=500} onClick={()=>setData(d=>({...d,cards:[...d.cards,blank()]}))}>{f('addCard')}</button><button className="btn btn-primary px-4" onClick={()=>void save()}>{f('save')}</button><button className={button} onClick={async()=>{if(await confirmDialog(f('discardConfirm'))){try{localStorage.removeItem(key)}catch{/* Explicit user choice. */}navigate('/flashcard')}}}>{f('discard')}</button><span role="status">{f(busy?'saving':draftSaved?'draftSaved':'draftSaving')}</span></div></fieldset></Frame>
}

function Player({account,id}:{account:number;id?:number}){
  const{f}=useWords(),cache=useQueryClient(),speech=useSpeech(),{error,setError,fail}=useFailure()
  const source=useQuery(['flashcards',account,'playSource',id],()=>id?api.detail(id).then(d=>({cards:d.cards,title:d.title,total:d.cards.length})):api.queue({limit:500}).then(q=>({cards:q.items,title:'',total:q.total})))
  const[starred,setStarred]=useState(false),[shuffle,setShuffle]=useState(false),[first,setFirst]=useState('front'),[tracking,setTracking]=useState(true)
  const[session,setSession]=useState<FlashCard[]|null>(null),[index,setIndex]=useState(0),[flipped,setFlipped]=useState(false),[results,setResults]=useState<Record<number,boolean>>({}),[finished,setFinished]=useState(false)
  const[auto,setAuto]=useState(false),[interval,setIntervalSeconds]=useState(5),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false)
  const request=useRef(crypto.randomUUID()),start=useRef(Date.now()),inflight=useRef(false),payload=useRef<ReviewPayload|null>(null),gesture=useRef<{x:number;y:number}|null>(null),ignoreClick=useRef(false)
  const choices=useMemo(()=>session?.map(()=>first==='random'?Math.random()<.5:first==='back')||[],[session,first])
  const card=session?.[index],summary=reviewSummary(results)
  const answer=useCallback((correct:boolean)=>{if(!card||finished)return;const updated={...results,[card.id!]:correct};setResults(updated);setFlipped(false);if(index+1<(session?.length||0))setIndex(i=>i+1);else{const remaining=session?.findIndex(c=>updated[c.id!]===undefined)??-1;if(remaining>=0)setIndex(remaining);else{setFinished(true);setAuto(false)}}},[card,finished,index,session,results])
  const next=useCallback((delta:number)=>{setIndex(i=>Math.max(0,Math.min((session?.length||1)-1,i+delta)));setFlipped(false)},[session])
  useEffect(()=>{if(!session||finished)return;const handler=(event:KeyboardEvent)=>{if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable=true]'))return;if(event.code==='Space'){if(event.target instanceof HTMLElement&&event.target.closest('button,a'))return;event.preventDefault();setFlipped(v=>!v)}else if(event.key==='ArrowLeft'){event.preventDefault();next(-1)}else if(event.key==='ArrowRight'){event.preventDefault();next(1)}else if(event.key==='1')answer(false);else if(event.key==='2')answer(true)};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[session,finished,next,answer])
  useEffect(()=>{if(!auto||!session||finished)return;const timer=window.setInterval(()=>{if(document.hidden)return;if(!flipped)setFlipped(true);else if(index+1<session.length)next(1);else{setAuto(false);setFlipped(false)}},interval*1000);return()=>window.clearInterval(timer)},[auto,session,finished,flipped,index,interval,next])
  const submit=useCallback(async()=>{
    if(!tracking||!finished||inflight.current||saved||!Object.keys(results).length)return
    if(!payload.current)payload.current={request_id:request.current,mode:'flip',duration_seconds:Math.min(14400,Math.round((Date.now()-start.current)/1000)),results:Object.entries(results).map(([card_id,correct])=>({card_id:Number(card_id),correct}))}
    inflight.current=true;setSaving(true);setError('')
    try{await api.review(payload.current);setSaved(true);await cache.invalidateQueries(['flashcards',account])}catch(e){fail(e)}finally{inflight.current=false;setSaving(false)}
    // Freeze request body and key across retries; only the authenticated page owns this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tracking,finished,saved,results,cache,account])
  useEffect(()=>{if(finished)void submit()
    // Submit once at completion, retry only on explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[finished])
  const begin=(onlyWrong=false)=>{const cards=onlyWrong?session?.filter(c=>results[c.id!]===false)||[]:studyCards(source.data?.cards||[],starred,shuffle);setSession(cards);setIndex(0);setFlipped(false);setResults({});setFinished(false);setSaved(false);payload.current=null;request.current=crypto.randomUUID();start.current=Date.now();setError('')}
  if(source.isLoading)return <Frame><p role="status">{f('loading')}</p></Frame>
  if(source.isError)return <Frame><ErrorText>{f('error')}</ErrorText><button className={button} onClick={()=>void source.refetch()}>{f('retry')}</button></Frame>
  if(!session)return <Frame deckTitle={source.data?.title}><h1 className="text-2xl font-bold">{source.data?.title||f('todayTitle')}</h1><ErrorText>{error}</ErrorText><section className="fc-panel fc-setup space-y-3"><p>{f('cardCount',{count:source.data?.cards.length||0})}</p>{(source.data?.total||0)>500&&<p>{f('queueLimit')}</p>}<label className="fc-toggle"><input type="checkbox" checked={starred} onChange={e=>setStarred(e.target.checked)}/>{f('starredOnly')}</label><label className="fc-toggle"><input type="checkbox" checked={shuffle} onChange={e=>setShuffle(e.target.checked)}/>{f('shuffle')}</label><label className="fc-toggle"><input type="checkbox" checked={tracking} onChange={e=>setTracking(e.target.checked)}/>{f('tracking')}</label><p className="fc-muted">{f('trackingHelp')}</p><label>{f('firstSide')}<select value={first} onChange={e=>setFirst(e.target.value)}>{['front','back','random'].map(v=><option key={v} value={v}>{f(v)}</option>)}</select></label><SpeechControl speech={speech}/><button disabled={!studyCards(source.data?.cards||[],starred,false).length} className="btn btn-primary px-4" onClick={()=>begin()}>{f('start')}</button></section></Frame>
  if(finished)return <Frame><section className="fc-panel space-y-3"><h1 className="text-2xl font-bold">{f('summary')}</h1><p>{f('sessionSummary',summary)}</p><p role="status">{f(!tracking?'untracked':saved?'saved':saving?'saving':'notSaved')}</p><ErrorText>{error}</ErrorText>{tracking&&!saved&&<button className={button} disabled={saving} onClick={()=>void submit()}>{f('retry')}</button>}<button className={button} disabled={!summary.wrong||saving||(tracking&&!saved)} onClick={()=>begin(true)}>{f('repeatWrong')}</button><Link className={button} to={id?`/flashcard/${id}`:'/flashcard'}>{f('done')}</Link></section></Frame>
  if(!card)return <Frame><p>{f('emptyCards')}</p></Frame>
  const backFirst=choices[index],shownFront=backFirst?card.back:card.front,shownBack=backFirst?card.front:card.back
  return <Frame deckTitle={source.data?.title}><section className="fc-panel space-y-4"><div className="fc-session-header"><h1 className="text-xl font-bold">{source.data?.title||f('todayTitle')}</h1><p aria-live="polite">{f('position',{current:index+1,total:session.length,remaining:session.length-Object.keys(results).length})}</p><progress max={session.length} value={Object.keys(results).length} aria-label={f('progress')}/><p className="fc-muted text-sm">{f('shortcuts')}</p></div>
    <div className="fc-flip-stage"><button type="button" className="fc-flip" aria-label={f('flip')} aria-pressed={flipped} onPointerDown={e=>{gesture.current={x:e.clientX,y:e.clientY};ignoreClick.current=false}} onPointerUp={e=>{const p=gesture.current;gesture.current=null;if(p&&Math.abs(e.clientX-p.x)>70&&Math.abs(e.clientY-p.y)<50){ignoreClick.current=true;answer(e.clientX>p.x)}}} onPointerCancel={()=>{gesture.current=null}} onClick={()=>{if(ignoreClick.current){ignoreClick.current=false;return}setFlipped(v=>!v)}}><span className={`fc-flip-inner ${flipped?'flipped':''}`}><span className="fc-face" aria-hidden={flipped}><span className="text-3xl fc-card-text">{shownFront}</span></span><span className="fc-face fc-back" aria-hidden={!flipped}><span className="text-3xl fc-card-text">{shownBack}</span>{card.reading&&<span lang="ja" className="mt-2 fc-card-text">{card.reading}</span>}{card.note&&<span className="mt-3 fc-card-text">{card.note}</span>}</span></span></button><button className={`${button} fc-icon-button fc-stage-audio`} disabled={!speech.enabled||!speech.available} aria-label={f('listen')} title={f('listen')} onClick={()=>speech.speak(card)}><Volume2 size={18} aria-hidden="true"/></button></div><p className="fc-flip-hint">{f('flipHint')}</p>
    <div className="fc-row fc-evaluation"><button className={`${button} fc-rating`} onClick={()=>answer(false)}>{f('stillLearning')}</button><button className={`${button} fc-success fc-rating`} onClick={()=>answer(true)}>{f('remembered')}</button></div><div className="fc-row"><button className={button} disabled={index===0} onClick={()=>next(-1)}>{f('previous')}</button><button className={button} disabled={index===session.length-1} onClick={()=>next(1)}>{f('next')}</button><button className={button} disabled={!speech.enabled||!speech.available} onClick={()=>speech.speak(card)}>{f('listen')}</button></div><div className="fc-row fc-autoplay"><label className="fc-toggle"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>{f('auto')}</label><label>{f('seconds')}<input type="number" min={2} max={60} value={interval} onChange={e=>setIntervalSeconds(Math.max(2,Math.min(60,Number(e.target.value)||2)))}/></label><button className={button} onClick={()=>{setFinished(true);setAuto(false)}}>{f('finish')}</button></div><p className="fc-muted">{f('autoHelp')}</p>
  </section></Frame>
}
