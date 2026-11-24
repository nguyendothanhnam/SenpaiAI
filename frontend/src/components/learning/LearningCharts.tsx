import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { TrendPoint } from '../../services/learning'

export function GoalRing({ value, label, detail }: { value: number; label: string; detail: string }) {
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return <div className="flex items-center gap-4"><div className="relative h-24 w-24 shrink-0" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="41" fill="none" stroke="var(--accent)" strokeWidth="9" /><circle cx="50" cy="50" r="41" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`} /></svg>
    <span className="absolute inset-0 grid place-items-center text-xl font-bold text-[color:var(--primary)]">{percent}%</span></div><div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-sm text-[color:var(--text-muted)]">{detail}</p></div></div>
}

export function LearningTrend({ points }: { points: TrendPoint[] }) {
  const { t, i18n } = useTranslation('common')
  const title = useId()
  const maximum = Math.max(1, ...points.map(point => point.lessons))
  const x = (index: number) => 30 + index * (540 / Math.max(1, points.length - 1))
  const y = (value: number) => Math.round((170 - value * 1.4) * 100) / 100
  let prior = false
  const path = points.map((point, index) => {
    if (point.accuracy === null) { prior = false; return '' }
    const segment = `${prior ? 'L' : 'M'}${x(index)},${y(point.accuracy)}`
    prior = true; return segment
  }).join(' ')
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'short' })
  return <figure className="space-y-3"><figcaption id={title} className="font-semibold">{t('learning.trendTitle')}</figcaption>
    <div className="flex flex-wrap gap-4 text-xs text-[color:var(--text-muted)]"><span>{t('learning.trendBars')}</span><span className="font-semibold text-[color:var(--primary)]">{t('learning.trendLine')}</span></div>
    <svg viewBox="0 0 600 200" className="w-full" role="img" aria-labelledby={title}>
      <line x1="16" x2="585" y1="174" y2="174" stroke="var(--border)" />
      {points.map((point, index) => <g key={point.start}><rect x={x(index) - 13} y={174 - point.lessons / maximum * 135} width="26" height={point.lessons / maximum * 135} rx="5" fill="var(--accent)" /><text x={x(index)} y="193" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className={`text-[22px] sm:text-[10px] ${index > 0 && index < points.length - 1 ? 'hidden sm:inline' : ''}`} fill="var(--text-muted)">{format(point.start)}</text></g>)}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" />
      {points.map((point, index) => point.accuracy !== null && <circle key={point.start} cx={x(index)} cy={y(point.accuracy)} r="4" fill="var(--primary)"><title>{`${format(point.start)}: ${point.accuracy}%`}</title></circle>)}
    </svg>
    {!points.some(point => point.accuracy !== null) && <p className="text-sm text-[color:var(--text-muted)]">{t('learning.noTrend')}</p>}
    <details className="text-sm"><summary className="cursor-pointer text-[color:var(--primary)]">{t('learning.viewChartData')}</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{t('learning.week')}</th><th>{t('learning.lessons')}</th><th>{t('learning.accuracy')}</th></tr></thead><tbody>{points.map(point => <tr key={point.start}><td className="py-2">{format(point.start)}</td><td>{point.lessons}</td><td>{point.accuracy === null ? t('learning.noScore') : `${point.accuracy}%`}</td></tr>)}</tbody></table></div></details>
  </figure>
}
