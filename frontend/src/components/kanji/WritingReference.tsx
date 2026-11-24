import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { displayPoints,polylinePoints } from '../../features/kanjiWriting/practice'
import type { WritingPoint } from '../../services/kanjiWriting'

export default function WritingReference({kanji,strokes,highlight,playKey=0}:{kanji:string;strokes:WritingPoint[][];highlight?:number;playKey?:number}){
  const {t}=useTranslation('common'),[replay,setReplay]=useState(0),id=useId().replace(/:/g,'')
  return <figure className="writing-reference"><figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">{t('writing.reference',{kanji})}<button type="button" className="btn btn-outline min-h-[44px] px-3" onClick={()=>setReplay(v=>v+1)}>{t('writingUI.animate')}</button></figcaption>
    <svg key={`${kanji}:${replay}:${highlight}:${playKey}`} viewBox="0 0 100 100" role="img" aria-label={t('writing.reference',{kanji})} className="writing-reference-board">
      <defs><marker id={`reference-arrow-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="var(--primary)"/></marker></defs>
      <path d="M50 0V100 M0 50H100" stroke="var(--border)" strokeWidth=".4" strokeDasharray="2 2"/>
      {strokes.map((stroke,i)=>{const points=displayPoints(stroke);return <g key={i}>
        <polyline points={polylinePoints(points)} fill="none" stroke="var(--border)" strokeWidth="1.3"/>
        <polyline className={highlight===undefined||highlight===i+1?'writing-reference-stroke':''} style={{animationDelay:`${highlight===undefined?i*.65:0}s`}} pathLength="100" points={polylinePoints(points)} fill="none" stroke={highlight===undefined||highlight===i+1?'var(--primary)':'var(--text-muted)'} strokeWidth="1.5" markerEnd={highlight===i+1?`url(#reference-arrow-${id})`:undefined} strokeLinecap="round"/>
        <text x={points[0]?.x} y={Math.max(4,(points[0]?.y||0)-2)} fontSize="4" fill="var(--text)">{i+1}</text>
      </g>})}
    </svg>
  </figure>
}
