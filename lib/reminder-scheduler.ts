/**
 * Reminder Scheduler Engine
 *
 * A singleton that ticks every 60 seconds, loads active reminder rules from
 * the database, evaluates each rule, and fires notifications when due.
 *
 * All time windows are expressed in Beijing time (UTC+8).
 */

import { prisma } from './prisma'
import { getEvaluator } from './reminder-evaluators/index'
import type { EvaluateResult } from './reminder-evaluators/index'
import { fireReminder } from './reminder-dispatcher'
import { logError } from './logger'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single Beijing-time window defined by HH:MM start/end strings */
interface TimeWindow {
  /** "HH:MM" in Beijing time */
  start: string
  /** "HH:MM" in Beijing time */
  end: string
}

/** Parsed shape of the `activeSchedule` JSON field on ReminderRule */
export interface ActiveSchedule {
  windows: TimeWindow[]
}

/**
 * Local representation of a ReminderRule row fetched from the DB.
 * Mirrors the Prisma model fields we actually use in the scheduler.
 */
type ReminderRuleRow = {
  id: string
  userId: string
  babyId: string
  name: string
  enabled: boolean
  triggerType: string
  triggerConfig: string
  activeSchedule: string | null
  advanceMinutes: number
  notifyTitle: string
  notifyBody: string | null
  startsAt: Date | null
  expiresAt: Date | null
  lastFiredAt: Date | null
  nextCheckAt: Date | null
}

// ─── Beijing-time helpers ─────────────────────────────────────────────────────

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * Convert a UTC Date to minutes-since-midnight in Beijing time (UTC+8).
 */
function toBeijingMinutes(date: Date): number {
  const bj = new Date(date.getTime() + BEIJING_OFFSET_MS)
  return bj.getUTCHours() * 60 + bj.getUTCMinutes()
}

/**
 * Parse an "HH:MM" string into minutes since midnight.
 */
function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

// ─── Active-window helpers ────────────────────────────────────────────────────

/**
 * Returns true if `now` (UTC) falls within any window defined in `schedule`.
 * Window times are in Beijing time (UTC+8).
 * If `schedule.windows` is empty the rule is treated as always active.
 *
 * Overnight windows are supported: if window.end < window.start
 * (e.g. "22:00"–"06:00") the window spans midnight.
 */
export function isInActiveWindow(schedule: ActiveSchedule, now: Date): boolean {
  if (!schedule.windows || schedule.windows.length === 0) return true

  const currentMins = toBeijingMinutes(now)

  for (const win of schedule.windows) {
    const startMins = hmToMinutes(win.start)
    const endMins = hmToMinutes(win.end)

    if (startMins <= endMins) {
      // Normal window, e.g. "08:00"–"22:00"
      if (currentMins >= startMins && currentMins < endMins) return true
    } else {
      // Overnight window, e.g. "22:00"–"06:00" — spans midnight
      if (currentMins >= startMins || currentMins < endMins) return true
    }
  }

  return false
}

/**
 * Compute the next UTC time at which any window in `schedule` opens,
 * starting from just after `now`.
 *
 * Returns `null` if the schedule has no windows (rule is always active).
 * Used to set `nextCheckAt` when the current time is outside all windows.
 */
export function nextWindowOpen(schedule: ActiveSchedule, now: Date): Date | null {
  if (!schedule.windows || schedule.windows.length === 0) return null

  const currentMins = toBeijingMinutes(now)
  let minOffsetMins = Infinity

  for (const win of schedule.windows) {
    const startMins = hmToMinutes(win.start)
    let offset = startMins - currentMins
    if (offset <= 0) offset += 24 * 60 // roll to next day
    if (offset < minOffsetMins) minOffsetMins = offset
  }

  if (minOffsetMins === Infinity) return null

  return new Date(now.getTime() + minOffsetMins * 60 * 1000)
}

// ─── Scheduler class ──────────────────────────────────────────────────────────

class ReminderScheduler {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _startTimeout: ReturnType<typeof setTimeout> | null = null
  /** Guard: prevents a new tick from starting while one is still running */
  private _ticking = false

  /**
   * Start the scheduler. Schedules a first tick 5 s after call (to allow DB
   * connections to establish), then ticks every 60 s thereafter.
   *
   * No-op if already started.
   * No-op if `REMINDER_ENABLED=false`.
   */
  start(): void {
    if (process.env.REMINDER_ENABLED === 'false') {
      console.log('[Reminder] Scheduler disabled via REMINDER_ENABLED=false')
      return
    }
    if (this._timer || this._startTimeout) {
      // Already started — ignore
      return
    }

    console.log('[Reminder] Scheduler starting — first tick in 5 s, then every 60 s')

    this._startTimeout = setTimeout(() => {
      this._startTimeout = null
      void this.tick()
      this._timer = setInterval(() => void this.tick(), 60_000)
    }, 5_000)
  }

  /** Stop the scheduler and clear all pending timers. */
  stop(): void {
    if (this._startTimeout) {
      clearTimeout(this._startTimeout)
      this._startTimeout = null
    }
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    console.log('[Reminder] Scheduler stopped')
  }

  /**
   * One scheduler tick: load all enabled rules whose `nextCheckAt` is due,
   * then evaluate each rule in sequence.
   *
   * A tick is skipped if the previous one is still running.
   */
  async tick(): Promise<void> {
    if (this._ticking) return
    this._ticking = true

    const now = new Date()

    try {
      const rules = await prisma.reminderRule.findMany({
        where: {
          enabled: true,
          OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
        },
      })

      console.log(`[Reminder] Tick — ${rules.length} rules loaded`)

      for (const rule of rules) {
        try {
          await this.evaluateRule(rule as ReminderRuleRow, now)
        } catch (err) {
          logError(`Scheduler: error evaluating rule ${rule.id}`, err)
        }
      }
    } catch (err) {
      logError('Scheduler: tick failed', err)
    } finally {
      this._ticking = false
    }
  }

  /**
   * Full lifecycle + evaluation pipeline for a single rule.
   *
   * Order:
   *  1. startsAt guard — skip (and defer) if rule hasn't become active yet
   *  2. expiresAt guard — auto-disable expired rules
   *  3. Active-window check — skip (and defer to next window) if outside schedule
   *  4. Evaluator lookup
   *  5. Evaluate — let the domain evaluator decide if the rule should fire
   *  6. Fire if needed; update lastFiredAt
   *  7. Write back nextCheckAt for scheduling optimization
   */
  async evaluateRule(rule: ReminderRuleRow, now: Date): Promise<void> {
    // 1. startsAt guard
    if (rule.startsAt && now < rule.startsAt) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { nextCheckAt: rule.startsAt },
      })
      return
    }

    // 2. expiresAt guard — auto-disable
    if (rule.expiresAt && now > rule.expiresAt) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { enabled: false },
      })
      return
    }

    // 3. Active-window check
    if (rule.activeSchedule) {
      let schedule: ActiveSchedule
      try {
        schedule = JSON.parse(rule.activeSchedule) as ActiveSchedule
      } catch {
        logError(
          `Scheduler: invalid activeSchedule JSON for rule ${rule.id}`,
          new Error('JSON parse error'),
        )
        // Update nextCheckAt to avoid re-evaluating this broken rule every tick
        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: { nextCheckAt: new Date(now.getTime() + 60_000) },
        })
        return
      }

      if (!isInActiveWindow(schedule, now)) {
        // Outside every window — defer to when the next window opens.
        const nextOpen = nextWindowOpen(schedule, now)
        console.log(
          `[Reminder] Rule ${rule.id} outside active window — deferred to ${nextOpen?.toISOString() ?? 'next minute'}`
        )
        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: { nextCheckAt: nextOpen ?? new Date(now.getTime() + 60_000) },
        })
        return
      }
    }

    // 4. Evaluator lookup
    const evaluator = getEvaluator(rule.triggerType)
    if (!evaluator) {
      logError(
        `Scheduler: no evaluator for triggerType "${rule.triggerType}" (rule ${rule.id})`,
        new Error('missing evaluator'),
      )
      return
    }

    // 5. Evaluate
    let result: EvaluateResult
    try {
      result = await evaluator.evaluate(rule, now)
    } catch (err) {
      logError(`Scheduler: evaluator threw for rule ${rule.id}`, err)
      // Update nextCheckAt so a broken rule doesn't retry every tick forever
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { nextCheckAt: new Date(now.getTime() + 60_000) },
      })
      return
    }

    if (result.shouldFire) {
      // 6. Fire
      console.log(`[Reminder] Firing rule=${rule.id} name="${rule.name}" type=${rule.triggerType}`)
      await fireReminder({ rule, context: result.context ?? {}, now })

      // 7a. Update lastFiredAt + nextCheckAt (post-fire cooldown)
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: {
          lastFiredAt: now,
          nextCheckAt: this.computeNextCheck(rule, now, true),
        },
      })
    } else {
      // 7b. Update nextCheckAt only (no fire this tick)
      if (rule.triggerType === 'interval') {
        console.log(`[Reminder] Skip rule=${rule.id} name="${rule.name}" — not firing`)
      }
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { nextCheckAt: this.computeNextCheck(rule, now, false) },
      })
    }
  }

  /**
   * Compute when the scheduler should next evaluate this rule.
   *
   * Strategy:
   * - `interval` + just fired  → now + intervalMinutes (skip the whole interval)
   * - `interval` + not fired   → now + 60 s (keep checking each minute)
   * - `cron`                   → now + 60 s (needs per-minute matching)
   * - `event_window`           → now + repeatIntervalMinutes
   * - unknown / parse error    → now + 60 s
   */
  private computeNextCheck(rule: ReminderRuleRow, now: Date, didFire: boolean): Date {
    try {
      if (rule.triggerType === 'interval') {
        const config = JSON.parse(rule.triggerConfig) as { intervalMinutes: number }
        if (didFire) {
          // Just fired — skip a full interval before checking again
          const intervalMs = Math.max(config.intervalMinutes, 1) * 60 * 1000
          return new Date(now.getTime() + intervalMs)
        }
        // Not fired yet — check again next minute (evaluator guards against re-fire)
        return new Date(now.getTime() + 60_000)
      }

      if (rule.triggerType === 'cron') {
        // Cron must be tested every minute
        return new Date(now.getTime() + 60_000)
      }

      if (rule.triggerType === 'event_window') {
        const config = JSON.parse(rule.triggerConfig) as { repeatIntervalMinutes: number }
        const intervalMs = Math.max(config.repeatIntervalMinutes, 1) * 60 * 1000
        return new Date(now.getTime() + intervalMs)
      }
    } catch {
      // Fall through to default
    }

    return new Date(now.getTime() + 60_000)
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

// Use globalThis to prevent dev-mode HMR from creating multiple scheduler instances
const globalForScheduler = globalThis as unknown as { __reminderScheduler?: ReminderScheduler }
export const reminderScheduler = globalForScheduler.__reminderScheduler ??= new ReminderScheduler()

// ─── resetIntervalRules ───────────────────────────────────────────────────────

/**
 * Reset interval-type reminder rules when a new feeding or health record is
 * created, so the countdown restarts from the new record time.
 *
 * Sets `lastFiredAt = null` (clear previous fire marker) and
 * `nextCheckAt = now + intervalMinutes` (defer the next evaluation).
 *
 * Errors are logged but not re-thrown (non-critical best-effort call).
 */
export async function resetIntervalRules(
  userId: string,
  babyId: string,
  sourceType: 'feeding' | 'health',
): Promise<void> {
  try {
    const now = new Date()

    const rules = await prisma.reminderRule.findMany({
      where: { userId, babyId, enabled: true, triggerType: 'interval' },
      select: { id: true, triggerConfig: true },
    })

    for (const rule of rules) {
      try {
        const config = JSON.parse(rule.triggerConfig) as {
          sourceType: string
          intervalMinutes: number
        }

        // Only reset rules whose sourceType matches the new record
        if (config.sourceType !== sourceType) continue

        const nextCheckAt = new Date(
          now.getTime() + Math.max(config.intervalMinutes, 1) * 60 * 1000,
        )

        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: { lastFiredAt: null, nextCheckAt },
        })
        console.log(
          `[Reminder] resetIntervalRules rule=${rule.id} sourceType=${sourceType} ` +
          `nextCheckAt=${nextCheckAt.toISOString()}`
        )
      } catch (err) {
        logError(`resetIntervalRules: failed to reset rule ${rule.id}`, err)
      }
    }
  } catch (err) {
    logError('resetIntervalRules: failed to query rules', err)
  }
}
