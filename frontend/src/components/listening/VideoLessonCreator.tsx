import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from 'react-query'
import { api } from '../../services/api'
import { CheckCircle2, FileText, Film, Info, Loader2, Play, UploadCloud, X } from 'lucide-react'
import { listeningTimestamp, youtubePreviewId } from '../../utils/listeningPresentation'
import './listening.css'

interface Segment { start_ms: number; end_ms: number; ja: string; vi: string }
export default function VideoLessonCreator({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('common')
  const cache = useQueryClient()
  const [open, setOpen] = useState(false), [url, setUrl] = useState(''), [text, setText] = useState('')
  const [title, setTitle] = useState(''), [topic, setTopic] = useState(''), [level, setLevel] = useState('N5'), [note, setNote] = useState('')
  const [rows, setRows] = useState<Segment[]>([]), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const lock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState(''), [dragging, setDragging] = useState(false)
  const previewId = youtubePreviewId(url)
  const parse = useMutation(() => api.post<{segments: Segment[]}>('/listening/video/parse', { url, subtitles: text }).then(r => r.data), {
    onSuccess: data => { setRows(data.segments); setError(''); setSaved(false) },
    onError: () => setError(t('videoLesson.parseError')),
  })
  const save = useMutation(() => api.post('/listening/video/lessons', {url, title, topic, jlpt_level:level, source_note:note, segments:rows}), {
    onSuccess: () => { setSaved(true); setError(''); void cache.invalidateQueries('listening-lessons') },
    onError: () => setError(t('videoLesson.saveError')),
    onSettled: () => { lock.current = false },
  })
  const busy = parse.isLoading || save.isLoading
  const setRow = (index: number, patch: Partial<Segment>) => { setSaved(false); setRows(current => current.map((row, n) => n === index ? {...row,...patch} : row)) }
  const readFile = async (file?: File) => {
    if (!file) return
    setRows([]); setSaved(false); setError('')
    setFileName('')
    if (file.size > 1024 * 1024 || !/\.(srt|vtt)$/i.test(file.name)) { setError(t('videoLesson.fileError')); return }
    try { setText(new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer())); setFileName(file.name) } catch { setError(t('videoLesson.fileError')) }
  }
  return <section className={embedded ? 'space-y-5' : 'listening-module listening-glass space-y-5 p-5'}>
    {!embedded && <button type="button" className="listening-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{t('videoLesson.create')}</button>}
    {(embedded || open) && <div className="space-y-5">
      <p className="listening-notice flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('videoLesson.rights')}</p>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-4"><label className="block space-y-2 text-sm font-semibold"><span>{t('videoLesson.url')}</span><span className="relative block"><input className="listening-input w-full pr-11" value={url} onChange={e=>{setUrl(e.target.value);setRows([]);setSaved(false)}} placeholder={t('listening.ui.youtubePlaceholder')} />{url && <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center" aria-label={t('listening.ui.clearUrl')} onClick={() => { setUrl(''); setRows([]); setSaved(false) }}><X className="h-4 w-4" /></button>}</span></label>
          {url && <p role="status" className={`flex items-center gap-1.5 text-xs ${previewId ? 'text-emerald-800 dark:text-emerald-300' : 'text-[color:var(--text-muted)]'}`}>{previewId && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{t(previewId ? 'listening.ui.validVideo' : 'listening.ui.videoHint')}</p>}
          <div className="relative flex aspect-video min-w-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--bg-elevated)]">
            {previewId ? <><img src={`https://i.ytimg.com/vi/${previewId}/hqdefault.jpg`} alt={t('listening.ui.videoPreview')} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" /><span className="absolute inset-0 bg-black/20" /><span className="relative grid h-12 w-12 place-items-center rounded-full bg-white/95 text-orange-700 shadow-sm"><Play className="ml-0.5 h-5 w-5" aria-hidden="true" /></span><span className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-white">{t('listening.ui.videoId', { id: previewId })}</span></> : <div className="space-y-2 p-6 text-center text-[color:var(--text-muted)]"><Film className="mx-auto h-8 w-8 opacity-60" aria-hidden="true" /><p className="text-sm">{t('listening.ui.videoPlaceholder')}</p></div>}
          </div>
        </div>
        <div className="min-w-0 space-y-4"><input ref={fileInput} type="file" hidden accept=".srt,.vtt" aria-label={t('videoLesson.file')} onChange={e=>{void readFile(e.target.files?.[0]);e.target.value=''}} />
          <button type="button" disabled={busy} className={`listening-dropzone w-full ${dragging ? 'is-dragging' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) void readFile(event.dataTransfer.files?.[0]) }}><UploadCloud className="h-7 w-7 text-[color:var(--listening-accent-text)]" aria-hidden="true" /><span className="text-sm font-semibold">{t('listening.ui.chooseSubtitle')}</span><span className="text-xs text-[color:var(--text-muted)]">{t('listening.ui.subtitleHint')}</span></button>
          {fileName && <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] px-3 py-2"><FileText className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</span><button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" disabled={busy} aria-label={t('listening.ui.removeFile')} onClick={() => { setFileName(''); setText(''); setRows([]); setSaved(false) }}><X className="h-4 w-4" /></button></div>}
          <label className="block space-y-2 text-sm font-semibold">{t('videoLesson.subtitle')}<textarea className="listening-input h-40 w-full font-mono text-xs" maxLength={1048576} value={text} onChange={e=>{setText(e.target.value);setRows([]);setSaved(false)}} placeholder={t('listening.ui.subtitlePlaceholder')} /></label>
        </div>
      </div>
      <div className="flex justify-end border-t border-[color:var(--border)] pt-4"><button type="button" className="listening-action w-full sm:w-auto" disabled={busy || !url || !text} onClick={()=>parse.mutate()}>{parse.isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{t(parse.isLoading?'videoLesson.parsing':'videoLesson.preview')}</button></div>
      {!!rows.length && <div className="space-y-4 border-t border-[color:var(--border)] pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold">{t('listening.ui.parsedPreview')}</h3><span className="listening-badge">{t('listening.ui.sentenceCount', { count: rows.length })}</span></div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold">{t('videoLesson.title')}<input className="listening-input w-full" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} /></label><label className="space-y-1.5 text-sm font-semibold">{t('videoLesson.topic')}<input className="listening-input w-full" maxLength={80} value={topic} onChange={e=>setTopic(e.target.value)} /></label><label className="space-y-1.5 text-sm font-semibold">{t('videoLesson.level')}<select className="listening-input w-full" value={level} onChange={e=>setLevel(e.target.value)}>{['N5','N4','N3','N2','N1'].map(v=><option key={v}>{v}</option>)}</select></label><label className="space-y-1.5 text-sm font-semibold">{t('videoLesson.note')}<input className="listening-input w-full" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label></div>
        {rows.map((row, index) => <div key={index} className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold"><span className="listening-badge">{listeningTimestamp(row.start_ms / 1000)} – {listeningTimestamp(row.end_ms / 1000)}</span>{t('videoLesson.segment',{number:index+1})}</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold">{t('videoLesson.start')}<input className="listening-input w-full" type="number" min="0" step="1" value={row.start_ms} onChange={e=>setRow(index,{start_ms:Number(e.target.value)})} /></label><label className="space-y-1.5 text-xs font-semibold">{t('videoLesson.end')}<input className="listening-input w-full" type="number" min="0" step="1" value={row.end_ms} onChange={e=>setRow(index,{end_ms:Number(e.target.value)})} /></label><label className="space-y-1.5 text-xs font-semibold">{t('videoLesson.ja')}<textarea className="listening-input w-full font-japanese" maxLength={1000} value={row.ja} onChange={e=>setRow(index,{ja:e.target.value})} /></label><label className="space-y-1.5 text-xs font-semibold">{t('videoLesson.vi')}<textarea className="listening-input w-full" maxLength={1000} value={row.vi} onChange={e=>setRow(index,{vi:e.target.value})} /></label></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="listening-secondary" disabled={busy || index===rows.length-1} onClick={()=>{setSaved(false);setRows(current=>current.flatMap((v,n)=>n===index ? [{...v,end_ms:current[n+1].end_ms,ja:`${v.ja}\n${current[n+1].ja}`,vi:[v.vi,current[n+1].vi].filter(Boolean).join('\n')}] : n===index+1?[]:[v]))}}>{t('videoLesson.merge')}</button><button type="button" className="listening-secondary" disabled={busy || rows.length>=50 || row.end_ms-row.start_ms<2 || row.ja.length<2} onClick={()=>{const chars=Array.from(row.ja), point=Math.ceil(chars.length/2), midpoint=Math.floor((row.start_ms+row.end_ms)/2);setSaved(false);setRows(current=>current.flatMap((v,n)=>n===index?[{...v,end_ms:midpoint,ja:chars.slice(0,point).join(''),vi:v.vi},{...v,start_ms:midpoint,ja:chars.slice(point).join(''),vi:''}]:[v]))}}>{t('videoLesson.split')}</button></div>
        </div>)}
        <p className="listening-notice">{t('videoLesson.manualTranslation')}</p><div className="flex justify-end"><button type="button" className="listening-action" disabled={busy || saved || !title.trim() || !topic.trim()} onClick={()=>{if(lock.current)return;lock.current=true;save.mutate()}}>{t(save.isLoading?'videoLesson.saving':'videoLesson.save')}</button></div>{saved && <p role="status" className="listening-notice">{t('videoLesson.saved')}</p>}</div>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
    </div>}
  </section>
}
