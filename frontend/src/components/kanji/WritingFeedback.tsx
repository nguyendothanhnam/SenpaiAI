import { useTranslation } from 'react-i18next'
import { buildOverlay,strokeDetail } from '../../features/kanjiWriting/practice'
import type { WritingPoint, WritingResult, WritingTemplate } from '../../services/kanjiWriting'

export function WritingScores({result}:{result:WritingResult}){
  const {t}=useTranslation('common')
  return <div aria-live="polite" className="space-y-2"><p className="font-bold">{t(result.summary_key)} · <span className="text-xl">{result.overall_score}/100</span></p>{!result.provisional&&<dl className="grid grid-cols-2 gap-x-4 gap-y-2">{Object.entries(result.scores).map(([key,value])=><div key={key}><div className="flex justify-between gap-2 text-xs"><dt>{t(`writing.criteria.${key}`)}</dt><dd className="font-bold">{value}/100</dd></div><progress className="writing-score" value={value} max={100} aria-label={t(`writing.criteria.${key}`)}/></div>)}</dl>}</div>
}
export default function WritingFeedback({result,strokes,template,onReview}:{result:WritingResult;strokes:WritingPoint[][];template:WritingTemplate;onReview:(index:number)=>void}){
  const {t}=useTranslation('common')
  return <div className="space-y-3">
    <ol className="writing-feedback-list">{result.strokes.map(row=>{
      const overlay=buildOverlay(strokes,template.strokes,row,result.provisional)
      return <li key={row.index}><details open={row.status!=='correct'} className="rounded-lg border border-[color:var(--border)] p-2"><summary className="cursor-pointer text-sm font-semibold">{t('writing.stroke',{index:row.index})} · {t(`writingUI.labels.${row.status}`)}</summary><div className="space-y-2 pt-2 text-sm"><p>{t(strokeDetail(row,overlay),{expected:row.expected_index,matched:row.matched_index})}</p>{row.status==='wrong_order'&&row.direction_error&&<p>{t('writing.status.wrong_direction')}</p>}{row.status!=='correct'&&<button type="button" className="btn btn-outline min-h-[44px] px-3" onClick={()=>onReview(row.index)}>{t('writingUI.compareStroke',{index:row.index})}</button>}</div></details></li>
    })}</ol>
    {result.confusion&&<div className="rounded-xl border border-[color:var(--primary)] p-3 text-sm"><p className="font-semibold">{t('writing.confusion',{kanji:result.confusion.kanji})}</p>{result.confusion.distinguishing_strokes.map((d,i)=><p key={i}>{t(`writing.difference.${d.reason}`,{target:d.target_stroke??'—',other:d.other_stroke??'—'})}</p>)}</div>}
  </div>
}
