import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TrendPoint } from '../../services/learning'
import { trendGeometry } from '../../features/learning/trend'
import './learningCharts.css'

export function GoalRing({ value, label, detail }: { value: number; label: string; detail: string }) {
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return <div className="flex items-center gap-4"><div className="relative h-24 w-24 shrink-0" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="41" fill="none" stroke="var(--accent)" strokeWidth="9" /><circle cx="50" cy="50" r="41" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`} /></svg>
    <span className="absolute inset-0 grid place-items-center text-xl font-bold text-[color:var(--primary)]">{percent}%</span></div><div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-sm text-[color:var(--text-muted)]">{detail}</p></div></div>
}

export function LearningTrend({ points }: { points: TrendPoint[] }) {
  const { t, i18n } = useTranslation('common')
  const title = useId(), tableId = useId(), tooltipId = useId()
  const [selected, setSelected] = useState<number | null>(null)
  const [showData, setShowData] = useState(false)
  const chart = trendGeometry(points)
  const active = selected === null ? undefined : chart.rows[selected]
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'short' })
  const tooltipX = active ? Math.max(chart.left, Math.min(chart.right - 230, active.x - 115)) : 0
  const tooltipY = active ? Math.max(chart.top + 8, Math.min(chart.bottom - 92, (active.accuracyY ?? active.barY) - 100)) : 0
  return <figure className="learning-trend">
    <div className="trend-header"><figcaption id={title} className="font-semibold">{t('learning.trendTitle')}</figcaption><button type="button" className="trend-data-toggle" aria-expanded={showData} aria-controls={tableId} onClick={() => setShowData(value => !value)}><span aria-hidden="true">{showData ? '−' : '+'}</span>{t('learning.viewChartData')}</button></div>
    <div className="trend-legend"><span><i className="trend-swatch" aria-hidden="true" />{t('learning.chartBars')}</span><span><i className="trend-line-key" aria-hidden="true" />{t('learning.chartLine')}</span><span><i className="trend-line-key gap" aria-hidden="true" />{t('learning.chartGap')}</span></div>
    <p className="trend-scroll-hint text-xs text-[color:var(--text-muted)]">{t('learning.chartScroll')}</p>
    <div className="trend-scroll" role="region" aria-label={t('learning.trendTitle')} tabIndex={0}>
      <svg viewBox="0 0 1000 440" role="group" aria-labelledby={title}>
        {chart.ticks.map(tick => <g key={tick.accuracy}>
          <line className="trend-grid" x1={chart.left} x2={chart.right} y1={tick.y} y2={tick.y} />
          <path className="trend-axis" d={`M${chart.left - 6},${tick.y} H${chart.left} M${chart.right},${tick.y} h6`} />
          <text className="trend-tick" x={chart.left - 14} y={tick.y + 5} textAnchor="end">{tick.lessons}</text>
          <text className="trend-tick" x={chart.right + 14} y={tick.y + 5}>{tick.accuracy}%</text>
        </g>)}
        <path className="trend-axis" d={`M${chart.left},${chart.top} V${chart.bottom} H${chart.right} V${chart.top}`} fill="none" />
        <text className="trend-axis-title" transform="translate(22 203) rotate(-90)" textAnchor="middle">{t('learning.chartLessonsAxis')}</text>
        <text className="trend-axis-title" transform="translate(980 203) rotate(90)" textAnchor="middle">{t('learning.chartAccuracyAxis')}</text>
        <text className="trend-axis-title" x="500" y="425" textAnchor="middle">{t('learning.chartTimeAxis')}</text>
        {chart.rows.map(row => <g key={row.start}>
          {row.lessons > 0 && <><path className="trend-bar" d={row.barPath} /><text className="trend-value" x={row.x} y={row.accuracyY !== null && Math.abs(row.barY - row.accuracyY) < 40 ? Math.min(row.barY - 10, row.accuracyY - 42) : row.barY - 10} textAnchor="middle">{row.lessons}</text></>}
          <line className="trend-axis" x1={row.x} x2={row.x} y1={chart.bottom} y2={chart.bottom + 7} />
          <text className="trend-date" x={row.x} y={chart.bottom + 28} textAnchor="middle">{format(row.start)}</text>
        </g>)}
        {chart.segments.map((segment, index) => <path key={index} d={segment.path} className="trend-accuracy" fill="none" strokeWidth="3" strokeDasharray={segment.gap ? '5 5' : undefined} opacity={segment.gap ? .55 : 1} />)}
        {chart.rows.map(row => row.accuracyY !== null && <g key={row.start}><circle className="trend-point" cx={row.x} cy={row.accuracyY} r="6" /><rect x={row.x - 23} y={row.accuracyY - 29} width="46" height="20" rx="5" fill="var(--card)" stroke="var(--border)" /><text className="trend-accuracy-value" x={row.x} y={row.accuracyY - 14} textAnchor="middle">{row.accuracy}%</text></g>)}
        {active && <g aria-hidden="true"><line className="trend-crosshair" x1={active.x} x2={active.x} y1={chart.top} y2={chart.bottom} /><line className="trend-crosshair trend-count-guide" x1={chart.left} x2={active.x} y1={active.barY} y2={active.barY} />{active.accuracyY !== null && <line className="trend-crosshair trend-accuracy-guide" x1={active.x} x2={chart.right} y1={active.accuracyY} y2={active.accuracyY} />}</g>}
        {chart.rows.map((row, index) => {
          const from = index === 0 ? chart.left : (chart.rows[index - 1].x + row.x) / 2
          const to = index === chart.rows.length - 1 ? chart.right : (row.x + chart.rows[index + 1].x) / 2
          return <rect key={row.start} className="trend-hit" x={from} y={chart.top} width={to - from} height={chart.bottom - chart.top} tabIndex={0} role="img" aria-describedby={selected === index ? tooltipId : undefined} aria-label={`${format(row.start)}: ${t('learning.lessons')} ${row.lessons}; ${t('learning.accuracy')} ${row.accuracy === null ? t('learning.noScore') : `${row.accuracy}%`}`} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onPointerEnter={() => setSelected(index)} onPointerLeave={() => setSelected(null)} onPointerDown={() => setSelected(index)} onKeyDown={event => { if (event.key === 'Escape') setSelected(null) }} />
        })}
        {active && <g id={tooltipId} role="tooltip" className="trend-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}><rect width="230" height="84" rx="10" /><text x="14" y="22" className="trend-tooltip-title">{format(active.start)}</text><text x="14" y="46">{t('learning.lessons')}: {active.lessons}</text><text x="14" y="68">{t('learning.accuracy')}: {active.accuracy === null ? t('learning.chartNoAccuracy') : `${active.accuracy}%`}</text></g>}
      </svg>
    </div>
    {!points.some(point => point.accuracy !== null) && <p className="text-sm text-[color:var(--text-muted)]">{t('learning.noTrend')}</p>}
    <div id={tableId} hidden={!showData} className="trend-table"><table className="w-full text-left"><caption className="sr-only">{t('learning.trendTitle')}</caption><thead><tr><th scope="col">{t('learning.week')}</th><th scope="col">{t('learning.lessons')}</th><th scope="col">{t('learning.accuracy')}</th></tr></thead><tbody>{points.map(point => <tr key={point.start}><th scope="row">{format(point.start)}</th><td>{point.lessons}</td><td>{point.accuracy === null ? t('learning.noScore') : `${point.accuracy}%`}</td></tr>)}</tbody></table></div>
  </figure>
}
