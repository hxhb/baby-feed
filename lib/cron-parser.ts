// Minimal 5-field cron expression matcher.
// Fields: minute hour day-of-month month day-of-week
// Supports: numbers, ranges (1-5), steps (*/N), lists (1,3,5), wildcards (*)
// Does NOT support: @yearly etc aliases, L/W/# extensions

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>()
  const parts = field.split(',')
  // Cap parts to prevent DoS with extremely long comma-separated lists
  const safeParts = parts.slice(0, 60)

  for (const part of safeParts) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i)
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/')
      const step = parseInt(stepStr, 10)
      if (!step || step <= 0 || !Number.isFinite(step)) continue
      let start = min
      let end = max
      if (range !== '*') {
        if (range.includes('-')) {
          const [s, e] = range.split('-').map(Number)
          start = s
          end = e
        } else {
          start = parseInt(range, 10)
        }
      }
      for (let i = start; i <= end; i += step) values.add(i)
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) values.add(i)
    } else {
      values.add(parseInt(part, 10))
    }
  }

  return values
}

/**
 * Check if a Date matches a cron expression.
 * @param cronExpr 5-field cron: "min hour dom month dow"
 * @param date The date to check — uses UTC getters (caller should pass a timezone-shifted Date)
 */
export function cronMatchesDate(cronExpr: string, date: Date): boolean {
  const fields = cronExpr.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const minute = date.getUTCMinutes()
  const hour = date.getUTCHours()
  const dayOfMonth = date.getUTCDate()
  const month = date.getUTCMonth() + 1 // 1-12
  const dayOfWeek = date.getUTCDay() // 0=Sun

  const minutes = parseField(fields[0], 0, 59)
  const hours = parseField(fields[1], 0, 23)
  const doms = parseField(fields[2], 1, 31)
  const months = parseField(fields[3], 1, 12)
  const dows = parseField(fields[4], 0, 7) // 0 and 7 both = Sunday

  // Normalize: convert 7 to 0 for Sunday
  const normalizedDows = new Set<number>()
  for (const d of dows) {
    normalizedDows.add(d === 7 ? 0 : d)
  }

  return (
    minutes.has(minute) &&
    hours.has(hour) &&
    doms.has(dayOfMonth) &&
    months.has(month) &&
    normalizedDows.has(dayOfWeek)
  )
}
