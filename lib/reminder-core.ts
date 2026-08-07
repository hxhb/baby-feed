export interface IntervalTriggerConfig {
  sourceType: 'feeding' | 'health'
  intervalMinutes: number
  filterCondition?: {
    type?: string[]
    [key: string]: unknown
  }
}

export interface IntervalTiming {
  shouldFire: boolean
  slot: number
  dueAt: Date
  nextCheckAt: Date
  elapsedMinutes: number
}

export function parseIntervalConfig(value: string): IntervalTriggerConfig | null {
  try {
    const config = JSON.parse(value) as Partial<IntervalTriggerConfig>
    if (config.sourceType !== 'feeding' && config.sourceType !== 'health') return null
    if (!Number.isInteger(config.intervalMinutes) || (config.intervalMinutes ?? 0) < 1) return null

    const types = config.filterCondition?.type
    if (types !== undefined && (!Array.isArray(types) || types.some(type => typeof type !== 'string'))) {
      return null
    }

    return config as IntervalTriggerConfig
  } catch {
    return null
  }
}

export function recordTypeMatches(config: IntervalTriggerConfig, recordType: string): boolean {
  const types = config.filterCondition?.type
  return !types || types.length === 0 || types.includes(recordType)
}

export function computeIntervalTiming(
  recordTime: Date,
  now: Date,
  intervalMinutes: number,
  advanceMinutes: number,
): IntervalTiming {
  const intervalMs = Math.max(intervalMinutes, 1) * 60_000
  const dueAt = new Date(recordTime.getTime() + intervalMs - advanceMinutes * 60_000)
  const elapsedMinutes = Math.floor((now.getTime() + advanceMinutes * 60_000 - recordTime.getTime()) / 60_000)
  const shouldFire = now.getTime() >= dueAt.getTime()

  if (!shouldFire) {
    return { shouldFire, slot: -1, dueAt, nextCheckAt: dueAt, elapsedMinutes }
  }

  const overdueMs = now.getTime() - dueAt.getTime()
  const slot = Math.floor(overdueMs / intervalMs)
  const alignedNextCheckAt = dueAt.getTime() + (slot + 1) * intervalMs
  const nextCheckAt = new Date(Math.max(alignedNextCheckAt, now.getTime() + intervalMs))
  return { shouldFire, slot, dueAt, nextCheckAt, elapsedMinutes }
}

export function buildIntervalFireKey(sourceRecordId: string | null, slot: number): string {
  return `interval:${sourceRecordId ?? 'none'}:${slot}`
}

export function buildCronFireKey(advancedNow: Date): string {
  return `cron:${advancedNow.toISOString().slice(0, 16)}`
}

export function buildEventWindowFireKey(slot: number): string {
  return `event-window:${slot}`
}

export function buildReminderConfigFingerprint(
  triggerType: string,
  triggerConfig: string,
  advanceMinutes: number,
): string {
  return createHash('sha256')
    .update(`${triggerType}\0${triggerConfig}\0${advanceMinutes}`)
    .digest('hex')
    .slice(0, 12)
}

export function calculateRetryDelayMs(attemptNumber: number, baseDelaySeconds: number): number {
  const seconds = Math.min(
    Math.max(baseDelaySeconds, 1) * Math.pow(2, Math.max(attemptNumber - 1, 0)),
    24 * 60 * 60,
  )
  return seconds * 1000
}
import { createHash } from 'crypto'
