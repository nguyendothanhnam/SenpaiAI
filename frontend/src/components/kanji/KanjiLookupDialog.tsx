import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { X, Volume2, Save, Wand2, BookOpen, Lightbulb } from 'lucide-react'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { useAuth } from '../../services/auth'
import { kanjiNotesAPI } from '../../services/kanjiNotes'
import type { KanjiNote } from '../../services/kanjiNotes'

export default function KanjiLookupDialog({ kanji, onClose }: { kanji: string; onClose: () => void }) {
  const { t } = useTranslation('common'), { user } = useAuth(), cache = useQueryClient()
  const ref = useRef<HTMLDivElement>(null), id = useId()
  const dismiss = useCallback(onClose, [onClose])
  useDialogFocus(ref, true, dismiss)
  const key = ['kanjiNote', user?.id, kanji]
  const query = useQuery(key, () => kanjiNotesAPI.get(kanji), { retry: 1 })
  const [draft, setDraft] = useState<KanjiNote | null>(null), [editing, setEditing] = useState(false)
  const [voice, setVoice] = useState(false)
  useEffect(() => {
    const speech = window.speechSynthesis
    if (!speech) return
    const update = () => setVoice(speech.getVoices().some(v => v.lang.startsWith('ja')))
    update(); speech.addEventListener('voiceschanged', update)
    return () => { speech.removeEventListener('voiceschanged', update); speech.cancel() }
  }, [])
  const save = useMutation((body: KanjiNote) => kanjiNotesAPI.save(kanji, body), { onSuccess: data => { cache.setQueryData(key, data); setDraft(null); setEditing(false) } })
  const data = query.data, entry = data?.dictionary
  const values: KanjiNote = draft || data?.note || { sino_vietnamese: data?.defaults.sino_vietnamese || '', meaning_vi: data?.defaults.meaning_vi || '', mnemonic: '' }
  const change = (name: keyof KanjiNote, value: string) => { save.reset(); setDraft({ ...values, [name]: value }) }
  const speak = (text: string) => { if (!voice) return; speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text.replace(/-/g, '')); utterance.lang = 'ja-JP'; speechSynthesis.speak(utterance) }
  return createPortal(<div data-kanji-tools className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4" onClick={e => { if (e.target === e.currentTarget && !save.isLoading) onClose() }}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-kanji-tools className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[640px] flex-col overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] shadow-2xl outline-none">
      <header className="flex items-center gap-4 border-b border-[color:var(--border)] p-5 sm:p-7"><span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--primary-hover,var(--primary))] text-5xl font-bold text-[color:var(--primary-contrast)] japanese-text">{kanji}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border border-[color:var(--primary)] bg-[color:var(--accent)] px-2 py-1 text-[color:var(--primary)]">{t('kanjiLookup.badge')}</span>{entry && <><span className="rounded-md bg-[color:var(--accent)] px-2 py-1">{entry.jlpt}</span><span className="rounded-md bg-[color:var(--bg-elevated)] px-2 py-1">{t('kanjiLookup.strokeCount', { count: entry.stroke_count })}</span></>}{data?.note && <span className="rounded-md bg-[color:var(--accent)] px-2 py-1 text-[color:var(--primary)]">{t('kanjiLookup.hasNote')}</span>}</div><h2 id={`${id}-title`} className="mt-2 text-xl font-bold sm:text-2xl">{t('kanjiLookup.title', { kanji })} <span className="text-lg text-[color:var(--primary)]">{values.sino_vietnamese}</span></h2></div><button type="button" onClick={onClose} disabled={save.isLoading} aria-label={t('kanjiLookup.close')} className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full hover:bg-[color:var(--accent)]"><X /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:px-7">
        {query.isLoading ? <p role="status">{t('kanjiLookup.loading')}</p> : query.isError ? <p role="alert">{t('kanjiLookup.loadError')} <button className="underline" onClick={() => query.refetch()}>{t('kanjiLookup.retry')}</button></p> : <>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-[color:var(--text-muted)]">{t('kanjiLookup.dictionary')}</h3><button type="button" className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-[color:var(--primary)]" onClick={() => { setDraft({ ...values, ...data!.defaults }); save.reset() }}><Wand2 size={15} />{t('kanjiLookup.refill')}</button></div>{!entry && <p className="text-sm">{t('kanjiLookup.unknown')}</p>}{(['onyomi', 'kunyomi'] as const).map(kind => <div key={kind} className="flex min-h-[44px] items-center gap-3"><span className="text-xs font-bold text-[color:var(--primary)]">{t(`kanjiLookup.${kind}`)}</span><span className="japanese-text font-semibold">{entry?.[kind]?.join('、') || t('kanjiLookup.missing')}</span><button type="button" className="grid h-11 w-11 place-items-center rounded-full hover:bg-[color:var(--accent)] disabled:opacity-40" disabled={!voice || !entry?.[kind]?.length} onClick={() => speak(entry![kind].join('、'))} aria-label={t('kanjiLookup.listen', { kind: t(`kanjiLookup.${kind}`) })} title={!voice ? t('kanjiLookup.noVoice') : undefined}><Volume2 size={17} /></button></div>)}</div>
          <label className="block text-sm font-semibold">{t('kanjiLookup.sino')}<input value={values.sino_vietnamese} maxLength={80} onChange={e => change('sino_vietnamese', e.target.value)} placeholder={t('kanjiLookup.missingSino')} className="input mt-2 min-h-[48px] w-full" /></label>
          <label className="block text-sm font-semibold"><BookOpen className="mr-2 inline h-4 w-4 text-[color:var(--primary)]" />{t('kanjiLookup.meaning')}<textarea rows={3} maxLength={2000} value={values.meaning_vi} onChange={e => change('meaning_vi', e.target.value)} className="input mt-2 w-full resize-y" /></label>
          <div><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold"><Lightbulb className="mr-2 inline h-4 w-4 text-[color:var(--primary)]" />{t('kanjiLookup.mnemonic')}</h3><button type="button" className="min-h-[44px] text-sm font-semibold text-[color:var(--primary)]" onClick={() => setEditing(v => !v)}>{t(editing ? 'kanjiLookup.preview' : 'kanjiLookup.edit')}</button></div>{editing || !values.mnemonic ? <textarea aria-label={t('kanjiLookup.mnemonic')} value={values.mnemonic} maxLength={2000} rows={4} onChange={e => change('mnemonic', e.target.value)} placeholder={t('kanjiLookup.mnemonicHint')} className="input w-full resize-y" /> : <p className="whitespace-pre-wrap break-words rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4 text-lg leading-8">{Array.from(values.mnemonic).map((c, i) => /\p{Script=Han}/u.test(c) ? <strong key={i} className="mx-0.5 rounded-md bg-[color:var(--accent)] px-1 text-[color:var(--primary)]">{c}</strong> : c)}</p>}</div>
          <p className="text-xs text-[color:var(--text-muted)]">{t('kanjiLookup.privateNote')} <a className="underline" href={data?.reading_source.url} target="_blank" rel="noreferrer">{data?.reading_source.title}</a></p>
          {save.isError && <p role="alert">{t('kanjiLookup.saveError')}</p>}{save.isSuccess && !draft && <p role="status" className="text-[color:var(--primary)]">{t('kanjiLookup.saved')}</p>}
        </>}
      </div><footer className="flex justify-end gap-3 border-t border-[color:var(--border)] p-4 sm:px-7"><button type="button" disabled={save.isLoading} className="btn btn-outline min-h-[44px] px-5" onClick={onClose}>{t('kanjiLookup.close')}</button><button type="button" className="btn btn-primary inline-flex min-h-[44px] items-center gap-2 px-5" disabled={!data || save.isLoading} onClick={() => save.mutate(values)}><Save size={17} />{t(save.isLoading ? 'kanjiLookup.saving' : 'kanjiLookup.save')}</button></footer>
    </section>
  </div>, document.body)
}
