/**
 * Production-safe error logging utility.
 * In production: logs only the error message (no stack traces that could leak internal paths).
 * In development: logs the full error object for debugging.
 */
export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[ERROR] ${context}: ${msg}`)
  } else {
    console.error(`[ERROR] ${context}:`, error)
  }
}
