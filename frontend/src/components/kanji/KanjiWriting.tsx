import { useEffect, useMemo, useRef, useState, useId } from 'react'
import type { PointerEvent } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { kanjiWritingAPI, WRITING_STRICTNESS } from '../../services/kanjiWriting'
import type { WritingPoint, WritingResult, WritingStrictness } from '../../services/kanjiWriting'
import { useAuth } from '../../services/auth'
import WritingCharacterPicker from './WritingCharacterPicker'
import WritingCharacterInfo from './WritingCharacterInfo'
import WritingReference from './WritingReference'
import WritingFeedback, { WritingScores } from './WritingFeedback'
import { readPreference,savePreference,buildOverlay,polylinePoints,displayPoints } from '../../features/kanjiWriting/practice'
import './kanjiWriting.css'

const pointsText = (points: WritingPoint[], template = false) => points.map(p => `${template ? 10+p.x*80 : p.x},${template ? 10+p.y*80 : p.y}`).join(' ')

export default function KanjiWriting({ initialKanji = '月' }: { initialKanji?: string }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const cache = useQueryClient()
  const [kanji, setKanji] = useState(()=>readPreference(user?.id)?.kanji||initialKanji)
  const [level,setLevel]=useState(()=>readPreference(user?.id)?.level||'N5')
  const [reviewIndex,setReviewIndex]=useState<number|null>(null),[reviewKey,setReviewKey]=useState(0)
  const drawingRef=useRef<SVGSVGElement>(null),activeLine=useRef<SVGPolylineElement>(null),arrowId=useId().replace(/:/g,'')
  const [test, setTest] = useState(false), [hint, setHint] = useState(false)
  const [strokes, setStrokes] = useState<WritingPoint[][]>([]), [active, setActive] = useState<WritingPoint[]>([])
  const [result, setResult] = useState<WritingResult | null>(null), [error, setError] = useState(false)
  const [pending, setPending] = useState(false), [locked, setLocked] = useState(false)
  const [strictness, setStrictness] = useState<WritingStrictness>('standard')
  const [reportOpen, setReportOpen] = useState(false), [reportComment, setReportComment] = useState('')
  const [reportConsent, setReportConsent] = useState(false), [reportStatus, setReportStatus] = useState<'idle'|'pending'|'saved'|'error'>('idle')
  const reportId = useRef(crypto.randomUUID())
  const activeRef = useRef<WritingPoint[]>([]), pointer = useRef<number | null>(null)
  const revision = useRef(0), attempt = useRef(crypto.randomUUID()), start = useRef(Date.now())
  const supported = useQuery(['kanjiWritingSupported'], kanjiWritingAPI.supported, { staleTime: 3600000 })
  const rules = useQuery(['kanjiWritingRules'], kanjiWritingAPI.rules, { staleTime: 3600000, retry: false })
  const dictionary=useQuery(['kanjiWritingDictionary'],kanjiWritingAPI.dictionary,{staleTime:3600000,retry:false})
  const history=useQuery(['kanjiWritingProgress',user?.id],kanjiWritingAPI.progress,{enabled:!!user,retry:false})
  const characters=useMemo(()=>{
    const entries=new Map(dictionary.data?.map(item=>[item.kanji,item]))
    return (supported.data?.items||[]).map(item=>({...entries.get(item.kanji),...item}))
  },[supported.data,dictionary.data])
  const template = useQuery(['kanjiWritingTemplate', kanji], () => kanjiWritingAPI.template(kanji), { retry: false, staleTime: 3600000 })
  useEffect(() => () => { revision.current++ }, [])
  const reset = () => {
    revision.current++; setStrokes([]); setActive([]); activeRef.current=[]; pointer.current=null
    setResult(null); setError(false); setPending(false); setLocked(false); setHint(false)
    setReviewIndex(null)
    setReportOpen(false); setReportComment(''); setReportConsent(false); setReportStatus('idle'); reportId.current=crypto.randomUUID()
    attempt.current=crypto.randomUUID(); start.current=Date.now()
  }
  const assess = async (values: WritingPoint[][], final: boolean) => {
    const token = ++revision.current
    setPending(true); setError(false)
    if (final) setLocked(true)
    try {
      const data = await kanjiWritingAPI.evaluate({ kanji, strokes: values, final, mode: test ? 'test' : 'practice', strictness,
        ...(final ? { attempt_id: attempt.current, elapsed_seconds: Math.min(3600, Math.round((Date.now()-start.current)/1000)), include_recognizer_warning: true } : {}) })
      if (token !== revision.current) return
      setResult(data)
      const focus=data.provisional?data.strokes[data.strokes.length-1]:data.strokes.find(row=>row.status!=='correct')
      setReviewIndex(focus&&focus.status!=='correct'?focus.index:null)
      if (final) {void cache.invalidateQueries(['learning', user?.id]);void cache.invalidateQueries(['kanjiWritingProgress',user?.id])}
    } catch {
      if (token === revision.current) { setError(true); if (final) setLocked(false) }
    } finally { if (token === revision.current) setPending(false) }
  }
  const sendReport = async () => {
    if (!reportConsent || !result?.saved || reportStatus==='pending') return
    const token=revision.current
    setReportStatus('pending')
    try {
      await kanjiWritingAPI.report({attempt_id:attempt.current,report_id:reportId.current,strokes,comment:reportComment,confirmed:true})
      if(token===revision.current){setReportStatus('saved');setReportOpen(false)}
    } catch { if(token===revision.current)setReportStatus('error') }
  }
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const rect=event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)), y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100)) }
  }
  const finish = (event: PointerEvent<SVGSVGElement>, cancel = false) => {
    if (pointer.current!==event.pointerId) return
    const values=[...activeRef.current, point(event)]
    pointer.current=null; activeRef.current=[]; setActive([])
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancel || values.length<2 || values.every(p=>Math.hypot(p.x-values[0].x,p.y-values[0].y)<.2)) return
    const next=[...strokes,values]; setStrokes(next); setHint(false); setResult(null)
    if (!test) void assess(next,false)
  }
  const selectCharacter=(value:string)=>{reset();setKanji(value);const actual=characters.find(i=>i.kanji===value)?.level||level;setLevel(actual);savePreference(user?.id,value,actual)}
  useEffect(()=>{
    const saved=readPreference(user?.id);reset();setKanji(saved?.kanji||initialKanji);setLevel(saved?.level||'N5')
    // Account changes discard private drafts and pending responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id])
  useEffect(()=>{
    if(!characters.length)return
    const selected=characters.find(c=>c.kanji===kanji)
    if(!selected)selectCharacter(characters[0].kanji)
    else if(!readPreference(user?.id)){setLevel(selected.level);savePreference(user?.id,kanji,selected.level)}
    // Validate stored selection once the supported catalog arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[supported.data,user?.id])
  const nextStroke=template.data?.strokes[strokes.length]
  const hideHints=test&&!result?.saved
  const row=result?.strokes.find(r=>r.index===reviewIndex)
  const overlay=row&&template.data&&!hideHints?buildOverlay(strokes,template.data.strokes,row,result?.provisional):null
  const reviewStroke=(index:number)=>{setReviewIndex(index);setReviewKey(v=>v+1);drawingRef.current?.scrollIntoView({block:'nearest',behavior:'auto'})}
  return <section className="space-y-4" aria-labelledby="writing-title">
    <div className="theme-card space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="writing-title" className="text-xl font-bold">{t('writing.title')}</h2>
      <div className="flex flex-wrap items-center gap-4"><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={test} onChange={e=>{reset();setTest(e.target.checked);setStrictness(e.target.checked?'strict':'standard')}} />{t('writing.testMode')}</label><label>{t('writing.strictnessLabel')} <select className="input min-h-[44px]" value={strictness} disabled={pending&&locked} onChange={e=>{reset();setStrictness(e.target.value as WritingStrictness)}}>{WRITING_STRICTNESS.map(value=><option key={value} value={value}>{t(`writing.strictness.${value}`)}</option>)}</select></label></div></div><div className="writing-strictness-description"><span>{t('writing.strictnessPosition',{current:WRITING_STRICTNESS.indexOf(strictness)+1,total:WRITING_STRICTNESS.length})}</span><p>{t(`writing.profileHelp.${strictness}`)}</p></div><details className="text-sm text-[color:var(--text-muted)]"><summary className="cursor-pointer">{t('writingUI.instructions')}</summary><p className="mt-2">{t('writing.description')}</p><p className="mt-2">{t('writing.estimate')}</p><p className="mt-2">{t('writing.strictnessHelp')}</p></details>
    </div>
    <details className="theme-card p-4 text-sm"><summary className="cursor-pointer font-semibold">{t('writingRules.title')}</summary>
      {rules.data?.weights && rules.data?.profiles ? <div className="space-y-2 pt-3"><p>{t('writingRules.version',{version:rules.data.version})}</p><ul>{Object.entries(rules.data.weights).map(([key,value])=><li key={key}>{t(`writing.criteria.${key}`)}: {Math.round(value*100)}%</li>)}</ul>
        <p>{t('writingRules.pass',{score:rules.data.pass_score})}</p><p>{t('writingRules.method')}</p><p>{t('writingRules.uncertain')}</p><p>{t('writingRules.modes')}</p>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{t('writing.strictnessLabel')}</th><th>{t('writingRules.distance')}</th><th>{t('writingRules.endpoint')}</th><th>{t('writingRules.length')}</th><th>{t('writingRules.margin')}</th></tr></thead><tbody>{Object.entries(rules.data.profiles).map(([key,value])=><tr key={key}><th>{t(`writing.strictness.${key}`)}</th><td>{value.distance}</td><td>{value.endpoint}</td><td>{value.length_ratio}</td><td>{value.order_margin}</td></tr>)}</tbody></table></div>
      </div> : <p role="status" className="pt-3">{rules.isError ? t('writingRules.unavailable') : t('writing.loading')}</p>}
    </details>
    <WritingCharacterPicker key={user?.id??'guest'} items={characters} history={history.data?.items} kanji={kanji} level={level} onLevel={value=>{setLevel(value);savePreference(user?.id,kanji,value)}} onSelect={selectCharacter} disabled={!!active.length||pending}/>
    {(dictionary.isError||history.isError)&&<p role="status" className="text-sm">{t(dictionary.isError?'writingUI.dictionaryError':'writingUI.historyError')} <button type="button" className="underline" onClick={()=>{void dictionary.refetch();void history.refetch()}}>{t('writing.retry')}</button></p>}
    {supported.isError && <p role="alert">{t('writing.catalogError')} <button className="underline" onClick={()=>supported.refetch()}>{t('writing.retry')}</button></p>}
    {template.isLoading ? <p role="status">{t('writing.loading')}</p> : template.isError || !template.data ? <div role="alert" className="theme-card p-5">{t('writing.unavailable')} <button className="underline" onClick={()=>template.refetch()}>{t('writing.retry')}</button></div> : <div className="writing-workspace"><aside className="theme-card writing-information min-w-0 space-y-3 p-4"><WritingCharacterInfo kanji={kanji} entry={characters.find(c=>c.kanji===kanji)} template={template.data} hideHints={hideHints}>{hideHints?<p className="rounded-xl border border-[color:var(--border)] p-4 text-sm">{t('writingUI.testReferenceHidden')}</p>:<WritingReference kanji={kanji} strokes={template.data.strokes} highlight={row?.status==='extra'?0:row?.expected_index??undefined} playKey={reviewKey}/>}</WritingCharacterInfo><p className="text-xs"><a className="underline" href={template.data.source_url} target="_blank" rel="noreferrer">{template.data.source}</a>{' \u00b7 '}{template.data.license}</p></aside>
      <div className="theme-card min-w-0 space-y-3 p-4"><p className="font-semibold">{t('writing.count',{current:strokes.length,total:template.data.stroke_count})}</p><p className="text-sm">{t(test?'writing.testInstruction':'writing.drawInstruction')}</p>
        {result&&<WritingScores result={result}/>}
        <svg ref={drawingRef} viewBox="0 0 100 100" className="writing-board mx-auto block aspect-square w-full max-w-[460px] rounded-xl border bg-[color:var(--bg-elevated)]" role="img" aria-label={t('writing.canvas',{kanji})}
          onPointerDown={e=>{if(locked || pointer.current!==null || strokes.length>=40 || e.button!==0)return; e.preventDefault(); setReviewIndex(null); pointer.current=e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); activeRef.current=[point(e)];setActive(activeRef.current)}}
          onPointerMove={e=>{if(pointer.current!==e.pointerId || activeRef.current.length>=1999)return;activeRef.current.push(point(e));activeLine.current?.setAttribute('points',pointsText(activeRef.current))}}
          onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(pointer.current===e.pointerId){pointer.current=null;activeRef.current=[];setActive([])}}}>
          <path d="M50 0V100 M0 50H100" fill="none" stroke="var(--border)" strokeDasharray="2 2" strokeWidth=".3" />
          {!test && hint && nextStroke && <polyline key={strokes.length} points={pointsText(nextStroke,true)} fill="none" stroke="var(--primary)" strokeWidth="1.8" opacity=".45" pathLength="100" className="writing-hint" />}
          {strokes.map((stroke,i)=>{
            const canReview=locked&&!hideHints&&result?.strokes.some(row=>row.index===i+1&&row.status!=='correct')
            return <g key={i} opacity={overlay?.user.length ? .2 : 1} role={canReview?'button':undefined} tabIndex={canReview?0:undefined} aria-label={canReview?t('writingUI.compareStroke',{index:i+1}):undefined} onClick={()=>{if(canReview)reviewStroke(i+1)}} onKeyDown={event=>{if(canReview&&(event.key==='Enter'||event.key===' ')){event.preventDefault();reviewStroke(i+1)}}}><polyline points={pointsText(stroke)} fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><text x={stroke[0].x} y={Math.max(4,stroke[0].y-2)} fill="var(--primary)" fontSize="4">{i+1}</text></g>
          })}
          <polyline ref={activeLine} points={pointsText(active)} fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
          {overlay&&<g pointerEvents="none"><defs><marker id={`writing-arrow-${arrowId}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10" fill="var(--primary)"/></marker><marker id={`user-arrow-${arrowId}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10" fill="var(--text)"/></marker></defs>
            {template.data.strokes.map((s,i)=><polyline key={i} points={polylinePoints(displayPoints(s))} fill="none" stroke="var(--border)" strokeWidth=".6"/>)}
            {overlay.template.length>0&&<polyline key={reviewKey} className="writing-hint" pathLength="100" points={polylinePoints(overlay.template)} fill="none" stroke="var(--primary)" strokeWidth="1.8" markerEnd={`url(#writing-arrow-${arrowId})`}/>}
            <polyline points={polylinePoints(overlay.user)} fill="none" stroke="var(--text)" strokeWidth="1" strokeDasharray="2 1" markerEnd={`url(#user-arrow-${arrowId})`}/>
            {overlay.template[0]&&<text x={overlay.template[0].x} y={Math.max(4,overlay.template[0].y-2)} fill="var(--primary)" fontSize="4">{row?.expected_index}</text>}
            {overlay.user[0]&&<text x={overlay.user[0].x} y={Math.min(98,overlay.user[0].y+5)} fill="var(--text)" fontSize="4">{row?.index}</text>}
          </g>}
        </svg>
        {overlay&&<p className="text-xs">{t('writingUI.overlayLegend')} <button type="button" className="underline" onClick={()=>setReviewIndex(null)}>{t('writingUI.hideOverlay')}</button></p>}
        <div className="flex flex-wrap gap-2"><button className="btn btn-outline min-h-[44px] px-3" disabled={!strokes.length || locked || pending} onClick={()=>{const next=strokes.slice(0,-1);setStrokes(next);setResult(null);setHint(false);if(next.length&&!test)void assess(next,false)}}>{t('writing.undo')}</button><button className="btn btn-outline min-h-[44px] px-3" disabled={pending && locked} onClick={reset}>{t('writing.clear')}</button>{!test && <button className="btn btn-outline min-h-[44px] px-3" disabled={!nextStroke || locked} onClick={()=>setHint(v=>!v)}>{t('writing.hint')}</button>}<button className="btn btn-primary min-h-[44px] px-3" disabled={!strokes.length || locked || pending || !!active.length} onClick={()=>{setResult(null);void assess(strokes,true)}}>{t('writing.finish')}</button></div>
        <p role="status" className="text-sm">{pending?t('writing.assessing'):result?.saved?t('writing.saved'):t('writing.provisional')}</p>{error && <p role="alert">{t('writing.error')}</p>}
        {result&&<WritingFeedback result={result} strokes={strokes} template={template.data} onReview={reviewStroke}/>}
        {result?.saved && <div className="space-y-2">{reportStatus==='saved'?<p role="status">{t('writing.reportSaved')}</p>:<button type="button" className="btn btn-outline min-h-[44px] px-3" onClick={()=>setReportOpen(v=>!v)} aria-expanded={reportOpen}>{t('writing.reportWrong')}</button>}{reportOpen&&<div className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><p>{t('writing.reportExplanation')}</p><label className="block">{t('writing.reportNote')}<textarea className="input mt-2 w-full" rows={3} maxLength={2000} value={reportComment} disabled={reportStatus==='pending'} onChange={e=>{setReportComment(e.target.value);reportId.current=crypto.randomUUID()}} /></label><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={reportConsent} disabled={reportStatus==='pending'} onChange={e=>setReportConsent(e.target.checked)}/>{t('writing.reportConsent')}</label><div className="flex flex-wrap gap-2"><button type="button" className="btn btn-primary min-h-[44px] px-3" disabled={!reportConsent||reportStatus==='pending'} onClick={()=>void sendReport()}>{t(reportStatus==='pending'?'writing.reportSending':'writing.reportSend')}</button><button type="button" className="btn btn-outline min-h-[44px] px-3" disabled={reportStatus==='pending'} onClick={()=>setReportOpen(false)}>{t('writing.reportCancel')}</button></div>{reportStatus==='error'&&<p role="alert">{t('writing.reportError')}</p>}</div>}</div>}
      </div>
    </div>}
  </section>
}
