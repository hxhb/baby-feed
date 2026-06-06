/**
 * Shared API route helpers
 * Centralizes common constants and server-side time utilities
 */

// Common no-cache response headers used by all API routes
export const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
} as const

/**
 * Convert a Date to Beijing time date string (YYYY-MM-DD)
 */
export function getBeijingDateStr(date: Date): string {
  const utcMs = date.getTime()
  const bj = new Date(utcMs + 8 * 60 * 60 * 1000)
  const y = bj.getUTCFullYear()
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get the start and end of a Beijing time day
 */
export function getBeijingDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  const end = new Date(`${dateStr}T23:59:59.999+08:00`)
  return { start, end }
}

/**
 * Get today's date string in Beijing time (YYYY-MM-DD)
 */
export function getBeijingTodayStr(): string {
  return getBeijingDateStr(new Date())
}

/**
 * Get the date string N days ago in Beijing time (YYYY-MM-DD)
 */
export function getBeijingDaysAgoStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getBeijingDateStr(d)
}

/**
 * Build a Prisma OR clause that captures health records for a date range,
 * including SLEEP records whose sleepStartTime falls in range (cross-midnight).
 *
 * Use inside a `where` block: `OR: buildSleepAwareOrClause(start, end)`
 */
export function buildSleepAwareOrClause(start: Date, end: Date) {
  return [
    { recordedAt: { gte: start, lte: end } },
    { type: 'SLEEP', sleepStartTime: { gte: start, lte: end } },
  ]
}

/**
 * Split a time span across natural Beijing-day boundaries.
 *
 * Walks day-by-day from `startMs` to `endMs` and invokes `callback` for each
 * calendar-day segment with:
 *   - `dayStr`          – the Beijing date string (YYYY-MM-DD)
 *   - `durationMinutes` – minutes attributed to that day
 */
export function splitDurationByBeijingDay(
  startMs: number,
  endMs: number,
  callback: (dayStr: string, durationMinutes: number) => void,
): void {
  if (endMs <= startMs) return

  let cursor = startMs
  while (cursor < endMs) {
    const dayStr = getBeijingDateStr(new Date(cursor))
    const { end: dayEnd } = getBeijingDayRange(dayStr)
    const segmentEnd = Math.min(endMs, dayEnd.getTime() + 1) // +1 to include 23:59:59.999
    const segmentMin = Math.round((segmentEnd - cursor) / (60 * 1000))
    if (segmentMin > 0) {
      callback(dayStr, segmentMin)
    }
    cursor = dayEnd.getTime() + 1
  }
}
