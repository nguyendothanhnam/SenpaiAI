import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { WritingDictionaryEntry, WritingTemplate } from '../../services/kanjiWriting'

export default function WritingCharacterInfo({kanji,entry,template,hideHints,children}:{kanji:string;entry?:WritingDictionaryEntry;template:WritingTemplate;hideHints:boolean;children?:ReactNode}){
  const {t}=useTranslation('common')
  const examples=entry?.examples?.filter(e=>e.word?.trim())||[]
  const confusions=template.confusions?.filter(c=>c.distinguishing_strokes.length)||[]
  return <div className="space-y-3">
    <div className="flex items-center gap-4"><strong className="japanese-text text-6xl">{kanji}</strong><div><span className="text-sm font-semibold text-[color:var(--primary)]">{template.level} · {t('kanjiLookup.strokeCount',{count:template.stroke_count})}</span>{entry?.meaning_vi&&<p className="mt-1 font-semibold">{entry.meaning_vi}</p>}</div></div>
    {(entry?.onyomi?.length||entry?.kunyomi?.length)?<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">{entry.onyomi?.length?<><dt className="font-bold">{t('kanjiLookup.onyomi')}</dt><dd className="japanese-text">{entry.onyomi.join('、')}</dd></>:null}{entry.kunyomi?.length?<><dt className="font-bold">{t('kanjiLookup.kunyomi')}</dt><dd className="japanese-text">{entry.kunyomi.join('、')}</dd></>:null}</dl>:null}
    {children}
    {!!examples.length&&<details><summary className="cursor-pointer text-sm font-semibold">{t('writingUI.examples')}</summary><ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">{examples.slice(0,4).map((e,i)=><li key={i}><span className="japanese-text font-semibold">{e.word}</span>{e.reading?.trim()&&<p className="japanese-text text-[color:var(--text-muted)]">{e.reading}</p>}{e.meaning?.trim()&&<p>{e.meaning}</p>}</li>)}</ul></details>}
    {!hideHints&&!!confusions.length&&<details><summary className="cursor-pointer text-sm font-semibold">{t('writingUI.confusable')}</summary><p className="my-2 text-xs text-[color:var(--text-muted)]">{t('writing.confusionNote')}</p><ul className="max-h-40 space-y-2 overflow-y-auto text-sm">{confusions.map(c=><li key={c.kanji}><strong className="japanese-text text-xl">{c.kanji}</strong>{c.distinguishing_strokes.map((d,i)=><p key={i}>{t(`writing.difference.${d.reason}`,{target:d.target_stroke??'—',other:d.other_stroke??'—'})}</p>)}</li>)}</ul></details>}
    {!hideHints&&!!template.rules.length&&<details><summary className="cursor-pointer text-sm font-semibold">{t('writing.rulesTitle')}</summary><ul className="mt-2 list-inside list-disc space-y-1 text-sm">{template.rules.map(rule=><li key={rule.key}>{t(rule.key)}</li>)}</ul></details>}
  </div>
}
