import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DailyHistoryEntry } from '../../services/api'
import { activityCalendarCells } from '../../utils/profileCalendar'

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ActivityCalendar({ endDate, history }: {
  endDate?: string; history: Pick<DailyHistoryEntry, 'date' | 'points_awarded'>[]
}) {
  const { t, i18n } = useTranslation('profile')
  const cells = activityCalendarCells(endDate)
  const entries = new Map(history.map(entry => [entry.date, entry]))
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const format = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', day:'numeric', month:'numeric', year:'numeric' })
  const dates = cells.filter((day): day is string => day !== null)
  if (!dates.length) return <p className="text-sm text-[color:var(--text-muted)]">{t('calendarEmpty')}</p>
  const rows = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
  const hasActivity = dates.some(day => entries.has(day))
  return <div className="space-y-3">
    <p className="text-xs text-[color:var(--text-muted)]">{t('calendarRange', { start: format(dates[0]), end: format(dates[dates.length - 1]) })}</p>
    <table className="w-full table-fixed border-separate border-spacing-1 sm:border-spacing-2">
      <caption className="sr-only">{t('calendar')}</caption>
      <thead><tr>{weekdays.map((day, index) => <th key={day} scope="col" className="pb-2 text-center text-xs font-semibold text-[color:var(--text-muted)]"><abbr className="no-underline" title={new Date(Date.UTC(2026, 0, 5 + index)).toLocaleDateString(locale, {weekday:'long', timeZone:'UTC'})}>{t(`calendarWeekdays.${day}`)}</abbr></th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((day, column) => {
        if (!day) return <td key={`empty:${column}`} aria-hidden="true" />
        const entry = entries.get(day)
        const label = entry ? t('calendarDayWithPoints', { date: format(day), points: entry.points_awarded }) : t('calendarDay', { date: format(day) })
        return <td key={day} className="p-0"><div role="group" title={label} aria-label={label} tabIndex={entry ? 0 : undefined} className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] motion-reduce:transition-none sm:h-16 sm:rounded-xl sm:text-sm ${entry ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)]'}`}>
          <time dateTime={day} aria-current={day === endDate ? 'date' : undefined}>{Number(day.slice(-2))}</time>
          {entry && <Flame aria-hidden="true" className="h-3 w-3" />}
        </div></td>
      })}</tr>)}</tbody>
    </table>
    <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">{t('calendarLegend')}</p>
    {!hasActivity && <p className="text-xs text-[color:var(--text-muted)]">{t('calendarEmpty')}</p>}
  </div>
}
