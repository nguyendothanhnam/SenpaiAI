import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from 'react-query'
import { api } from '../../services/api'

interface Segment { start_ms: number; end_ms: number; ja: string; vi: string }
export default function VideoLessonCreator() {
  const { t } = useTranslation('common')
  const cache = useQueryClient()
  const [open, setOpen] = useState(false), [url, setUrl] = useState(''), [text, setText] = useState('')
  const [title, setTitle] = useState(''), [topic, setTopic] = useState(''), [level, setLevel] = useState('N5'), [note, setNote] = useState('')
  const [rows, setRows] = useState<Segment[]>([]), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const lock = useRef(false)
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
    if (file.size > 1024 * 1024 || !/\.(srt|vtt)$/i.test(file.name)) { setError(t('videoLesson.fileError')); return }
    try { setText(new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer())) } catch { setError(t('videoLesson.fileError')) }
  }
  return <section className="theme-card space-y-4 rounded-2xl p-4 sm:p-5"><button type="button" className="btn btn-outline" aria-expanded={open} onClick={() => setOpen(!open)}>{t('videoLesson.create')}</button>
    {open && <div className="space-y-4"><p>{t('videoLesson.rights')}</p><label className="block">{t('videoLesson.url')}<input className="input w-full" value={url} onChange={e=>{setUrl(e.target.value);setRows([]);setSaved(false)}} placeholder="https://www.youtube.com/watch?v=..." /></label>
      <label className="block">{t('videoLesson.file')}<input type="file" accept=".srt,.vtt" onChange={e=>{void readFile(e.target.files?.[0]);e.target.value=''}} /></label>
      <label className="block">{t('videoLesson.subtitle')}<textarea className="input h-40 w-full" maxLength={1048576} value={text} onChange={e=>{setText(e.target.value);setRows([]);setSaved(false)}} /></label>
      <button type="button" className="btn btn-outline" disabled={busy || !url || !text} onClick={()=>parse.mutate()}>{t(parse.isLoading?'videoLesson.parsing':'videoLesson.preview')}</button>
      {!!rows.length && <><div className="grid gap-3 sm:grid-cols-2"><label>{t('videoLesson.title')}<input className="input w-full" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} /></label><label>{t('videoLesson.topic')}<input className="input w-full" maxLength={80} value={topic} onChange={e=>setTopic(e.target.value)} /></label><label>{t('videoLesson.level')}<select className="input w-full" value={level} onChange={e=>setLevel(e.target.value)}>{['N5','N4','N3','N2','N1'].map(v=><option key={v}>{v}</option>)}</select></label><label>{t('videoLesson.note')}<input className="input w-full" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label></div>
        {rows.map((row, index) => <div key={index} className="space-y-2 rounded-xl border border-[color:var(--border)] p-3"><p>{t('videoLesson.segment',{number:index+1})}</p><div className="grid gap-2 sm:grid-cols-2"><label>{t('videoLesson.start')}<input className="input w-full" type="number" min="0" step="1" value={row.start_ms} onChange={e=>setRow(index,{start_ms:Number(e.target.value)})} /></label><label>{t('videoLesson.end')}<input className="input w-full" type="number" min="0" step="1" value={row.end_ms} onChange={e=>setRow(index,{end_ms:Number(e.target.value)})} /></label><label>{t('videoLesson.ja')}<textarea className="input w-full" maxLength={1000} value={row.ja} onChange={e=>setRow(index,{ja:e.target.value})} /></label><label>{t('videoLesson.vi')}<textarea className="input w-full" maxLength={1000} value={row.vi} onChange={e=>setRow(index,{vi:e.target.value})} /></label></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-outline" disabled={busy || index===rows.length-1} onClick={()=>{setSaved(false);setRows(current=>current.flatMap((v,n)=>n===index ? [{...v,end_ms:current[n+1].end_ms,ja:`${v.ja}\n${current[n+1].ja}`,vi:[v.vi,current[n+1].vi].filter(Boolean).join('\n')}] : n===index+1?[]:[v]))}}>{t('videoLesson.merge')}</button><button type="button" className="btn btn-outline" disabled={busy || rows.length>=50 || row.end_ms-row.start_ms<2 || row.ja.length<2} onClick={()=>{const chars=Array.from(row.ja), point=Math.ceil(chars.length/2), midpoint=Math.floor((row.start_ms+row.end_ms)/2);setSaved(false);setRows(current=>current.flatMap((v,n)=>n===index?[{...v,end_ms:midpoint,ja:chars.slice(0,point).join(''),vi:v.vi},{...v,start_ms:midpoint,ja:chars.slice(point).join(''),vi:''}]:[v]))}}>{t('videoLesson.split')}</button></div>
        </div>)}
        <p>{t('videoLesson.manualTranslation')}</p><button type="button" className="btn btn-primary" disabled={busy || saved || !title.trim() || !topic.trim()} onClick={()=>{if(lock.current)return;lock.current=true;save.mutate()}}>{t(save.isLoading?'videoLesson.saving':'videoLesson.save')}</button>{saved && <p role="status">{t('videoLesson.saved')}</p>}</>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </section>
}
