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
