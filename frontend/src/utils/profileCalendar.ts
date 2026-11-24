/** Calendar-only dates use UTC arithmetic, independently of the browser's timezone. */
export function activityCalendarCells(endDate?: string): (string | null)[] {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return []
  const end = new Date(`${endDate}T12:00:00Z`)
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== endDate) return []
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 29)
  const padding = (start.getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array(padding).fill(null)
  for (let index = 0; index < 30; index++) {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    cells.push(day.toISOString().slice(0, 10))
  }
  while (cells.length % 7) cells.push(null)
  return cells
}

export function appCalendarDate(instant = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): string | undefined {
  if (!Number.isFinite(instant.getTime())) return undefined
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(instant)
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}-${parts.find(part => part.type === 'day')!.value}`
}
