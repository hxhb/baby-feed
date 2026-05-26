# Reminder System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic scheduled task/reminder engine that supports interval-based, cron-based, and event-window-based triggers with webhook notification, active schedule (quiet hours), and execution logging.

**Architecture:** Single `ReminderRule` DB table with JSON trigger configs. In-process `setInterval` (60s) evaluates rules via pluggable evaluators. Fires `reminder.fired` webhook events. Execution history via existing `activity-logger`.

**Tech Stack:** Next.js 15, Prisma (SQLite), TypeScript, existing webhook-service + activity-logger infrastructure.

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260526180000_add_reminder_rules/migration.sql`

- [ ] **Step 1: Add ReminderRule model and relations to schema**

Add to `prisma/schema.prisma` — append after the `WebhookEndpoint` model:

```prisma
model ReminderRule {
  id              String    @id @default(cuid())
  userId          String
  babyId          String

  name            String
  enabled         Boolean   @default(true)

  triggerType     String
  triggerConfig   String
  activeSchedule  String?

  advanceMinutes  Int       @default(0)

  notifyTitle     String
  notifyBody      String?

  startsAt        DateTime?
  expiresAt       DateTime?

  lastFiredAt     DateTime?
  nextCheckAt     DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  baby            Baby      @relation(fields: [babyId], references: [id], onDelete: Cascade)

  @@index([userId, enabled])
  @@index([babyId])
  @@index([enabled, nextCheckAt])
}
```

Add `reminderRules ReminderRule[]` relation to the `User` model (after `webhookEndpoints`):
```prisma
  reminderRules    ReminderRule[]
```

Add `reminderRules ReminderRule[]` relation to the `Baby` model (after `memos`):
```prisma
  reminderRules  ReminderRule[]
```

- [ ] **Step 2: Create migration SQL**

Create `prisma/migrations/20260526180000_add_reminder_rules/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "activeSchedule" TEXT,
    "advanceMinutes" INTEGER NOT NULL DEFAULT 0,
    "notifyTitle" TEXT NOT NULL,
    "notifyBody" TEXT,
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "lastFiredAt" DATETIME,
    "nextCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderRule_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReminderRule_userId_enabled_idx" ON "ReminderRule"("userId", "enabled");
CREATE INDEX "ReminderRule_babyId_idx" ON "ReminderRule"("babyId");
CREATE INDEX "ReminderRule_enabled_nextCheckAt_idx" ON "ReminderRule"("enabled", "nextCheckAt");
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260526180000_add_reminder_rules/
git commit -m "feat(reminder): add ReminderRule model and migration"
```

---

### Task 2: Cron Expression Parser Utility

**Files:**
- Create: `lib/cron-parser.ts`

No external dependency — write a minimal 5-field cron matcher (minute, hour, day-of-month, month, day-of-week). This app only needs "does this cron match this minute?" logic.

- [ ] **Step 1: Create cron parser**

Create `lib/cron-parser.ts`:

```typescript
/**
 * Minimal 5-field cron expression matcher.
 * Fields: minute hour day-of-month month day-of-week
 * Supports: numbers, ranges (1-5), steps (* /2), lists (1,3,5), wildcards (*)
 * Does NOT support: @yearly etc aliases, L/W/# extensions
 */

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i)
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/')
      const step = parseInt(stepStr, 10)
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
 * @param date The date to check (should be in the desired timezone already)
 */
export function cronMatchesDate(cronExpr: string, date: Date): boolean {
  const fields = cronExpr.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const minute = date.getMinutes()
  const hour = date.getHours()
  const dayOfMonth = date.getDate()
  const month = date.getMonth() + 1 // 1-12
  const dayOfWeek = date.getDay() // 0=Sun, need to handle

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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/cron-parser.ts
git commit -m "feat(reminder): add minimal cron expression parser"
```

---

### Task 3: Evaluator Modules

**Files:**
- Create: `lib/reminder-evaluators/index.ts`
- Create: `lib/reminder-evaluators/interval.ts`
- Create: `lib/reminder-evaluators/cron.ts`
- Create: `lib/reminder-evaluators/event-window.ts`

- [ ] **Step 1: Create evaluator types and registry**

Create `lib/reminder-evaluators/index.ts`:

```typescript
/**
 * Evaluator Registry
 *
 * Maps triggerType strings to their evaluator implementations.
 */

import { intervalEvaluator } from './interval'
import { cronEvaluator } from './cron'
import { eventWindowEvaluator } from './event-window'

export interface EvaluateResult {
  shouldFire: boolean
  context?: Record<string, unknown>
}

export interface ReminderRuleForEval {
  id: string
  userId: string
  babyId: string
  triggerType: string
  triggerConfig: string
  advanceMinutes: number
  lastFiredAt: Date | null
}

export interface RuleEvaluator {
  evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult>
}

const evaluators: Record<string, RuleEvaluator> = {
  interval: intervalEvaluator,
  cron: cronEvaluator,
  event_window: eventWindowEvaluator,
}

export function getEvaluator(triggerType: string): RuleEvaluator | undefined {
  return evaluators[triggerType]
}
```

- [ ] **Step 2: Create interval evaluator**

Create `lib/reminder-evaluators/interval.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface IntervalTriggerConfig {
  sourceType: 'feeding' | 'health'
  intervalMinutes: number
  filterCondition?: {
    type?: string[]
    [key: string]: unknown
  }
}

export const intervalEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: IntervalTriggerConfig = JSON.parse(rule.triggerConfig)
    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)

    // Query the last matching record
    let lastRecordTime: Date | null = null

    if (config.sourceType === 'feeding') {
      const where: Record<string, unknown> = { babyId: rule.babyId }
      if (config.filterCondition?.type) {
        where.type = { in: config.filterCondition.type }
      }
      const record = await prisma.feedingRecord.findFirst({
        where,
        orderBy: { startTime: 'desc' },
        select: { startTime: true },
      })
      lastRecordTime = record?.startTime ?? null
    } else if (config.sourceType === 'health') {
      const where: Record<string, unknown> = { babyId: rule.babyId }
      if (config.filterCondition?.type) {
        where.type = { in: config.filterCondition.type }
      }
      const record = await prisma.healthRecord.findFirst({
        where,
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      })
      lastRecordTime = record?.recordedAt ?? null
    }

    // If no record exists, fire immediately
    if (!lastRecordTime) {
      return { shouldFire: true, context: { elapsed: null, lastRecordTime: null } }
    }

    const elapsedMs = advancedNow.getTime() - lastRecordTime.getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60000)
    const shouldFire = elapsedMinutes >= config.intervalMinutes

    // Prevent re-firing: if already fired for this interval period
    if (shouldFire && rule.lastFiredAt) {
      const timeSinceLastFire = now.getTime() - rule.lastFiredAt.getTime()
      if (timeSinceLastFire < config.intervalMinutes * 60 * 1000) {
        return { shouldFire: false }
      }
    }

    return {
      shouldFire,
      context: {
        elapsedMinutes,
        lastRecordTime: lastRecordTime.toISOString(),
      },
    }
  },
}
```

- [ ] **Step 3: Create cron evaluator**

Create `lib/reminder-evaluators/cron.ts`:

```typescript
import { cronMatchesDate } from '@/lib/cron-parser'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface CronTriggerConfig {
  cronExpr: string
}

export const cronEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: CronTriggerConfig = JSON.parse(rule.triggerConfig)

    // Apply advance minutes: pretend it's N minutes in the future
    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)

    // Convert to Beijing time for cron matching
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingTime = new Date(advancedNow.getTime() + beijingOffset)

    if (cronMatchesDate(config.cronExpr, beijingTime)) {
      // Prevent duplicate fire in same minute
      if (rule.lastFiredAt) {
        const lastFireMinute = Math.floor(rule.lastFiredAt.getTime() / 60000)
        const currentMinute = Math.floor(now.getTime() / 60000)
        if (lastFireMinute === currentMinute) {
          return { shouldFire: false }
        }
      }
      return { shouldFire: true, context: { cronExpr: config.cronExpr } }
    }

    return { shouldFire: false }
  },
}
```

- [ ] **Step 4: Create event window evaluator**

Create `lib/reminder-evaluators/event-window.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface EventWindowTriggerConfig {
  anchorTime: string
  windowHours: number
  repeatIntervalMinutes: number
}

export const eventWindowEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: EventWindowTriggerConfig = JSON.parse(rule.triggerConfig)
    const anchor = new Date(config.anchorTime)
    const windowEndMs = anchor.getTime() + config.windowHours * 60 * 60 * 1000

    // Window expired — auto-disable rule
    if (now.getTime() > windowEndMs) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { enabled: false },
      })
      return { shouldFire: false }
    }

    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)
    const elapsedSinceAnchor = advancedNow.getTime() - anchor.getTime()
    const intervalMs = config.repeatIntervalMinutes * 60 * 1000
    const currentSlot = Math.floor(elapsedSinceAnchor / intervalMs)

    if (rule.lastFiredAt) {
      const lastElapsed = rule.lastFiredAt.getTime() - anchor.getTime()
      const lastSlot = Math.floor(lastElapsed / intervalMs)
      if (currentSlot > lastSlot) {
        return {
          shouldFire: true,
          context: { slot: currentSlot, windowEnd: new Date(windowEndMs).toISOString() },
        }
      }
      return { shouldFire: false }
    } else {
      // First fire — only after first full interval
      if (currentSlot >= 1) {
        return {
          shouldFire: true,
          context: { slot: currentSlot, windowEnd: new Date(windowEndMs).toISOString() },
        }
      }
      return { shouldFire: false }
    }
  },
}
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/reminder-evaluators/
git commit -m "feat(reminder): add evaluator modules (interval, cron, event-window)"
```

---

### Task 4: Notification Dispatcher

**Files:**
- Create: `lib/reminder-dispatcher.ts`
- Modify: `lib/webhook-events.ts` (add `REMINDER_FIRED`)
- Modify: `lib/activity-logger.ts` (register `reminder` source)

- [ ] **Step 1: Add reminder.fired to webhook events**

In `lib/webhook-events.ts`, add to the `WEBHOOK_EVENTS` object (before `} as const`):

```typescript
  // Reminder Events
  REMINDER_FIRED: 'reminder.fired',
```

- [ ] **Step 2: Register reminder source in activity-logger**

In `lib/activity-logger.ts`, after the `activityLogger.registerSource('webhook', ...)` call at the bottom of the file, add:

```typescript
activityLogger.registerSource('reminder', {
  maxEntries: 1000,
  maxPerGroup: 200,
  ttlMs: 72 * 60 * 60 * 1000, // 72 hours
})
```

- [ ] **Step 3: Create notification dispatcher**

Create `lib/reminder-dispatcher.ts`:

```typescript
/**
 * Reminder Notification Dispatcher
 *
 * Handles template rendering, webhook emission, and activity logging
 * when a reminder rule fires.
 */

import { prisma } from './prisma'
import { activityLogger } from './activity-logger'
import { emitWebhookEvent } from './webhook-service'
import { logError } from './logger'

interface FireReminderParams {
  rule: {
    id: string
    userId: string
    babyId: string
    name: string
    triggerType: string
    notifyTitle: string
    notifyBody: string | null
    advanceMinutes: number
  }
  context: Record<string, unknown>
  now: Date
}

/**
 * Render a template string, replacing {{variable}} placeholders
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * Format elapsed minutes as human-readable string
 */
function formatElapsed(minutes: number | null): string {
  if (minutes === null) return '未知时间'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

/**
 * Format a Date as Beijing time string
 */
function formatBeijingNow(date: Date): string {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijing.getUTCDate()).padStart(2, '0')
  const hour = String(beijing.getUTCHours()).padStart(2, '0')
  const minute = String(beijing.getUTCMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

/**
 * Fire a reminder: render templates, emit webhook, log to activity-logger
 */
export async function fireReminder({ rule, context, now }: FireReminderParams): Promise<void> {
  try {
    // Get baby name for template
    const baby = await prisma.baby.findUnique({
      where: { id: rule.babyId },
      select: { name: true },
    })
    const babyName = baby?.name ?? '宝宝'

    // Build template variables
    const vars: Record<string, string> = {
      babyName,
      ruleName: rule.name,
      now: formatBeijingNow(now),
      elapsed: formatElapsed(context.elapsedMinutes as number | null),
    }

    const renderedTitle = renderTemplate(rule.notifyTitle, vars)
    const renderedBody = rule.notifyBody ? renderTemplate(rule.notifyBody, vars) : null

    // Emit webhook event
    await emitWebhookEvent(
      rule.userId,
      'reminder.fired',
      {
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: rule.triggerType,
          babyId: rule.babyId,
          babyName,
          title: renderedTitle,
          body: renderedBody,
          context,
        },
      }
    )

    // Log to activity-logger
    activityLogger.record({
      source: 'reminder',
      userId: rule.userId,
      groupKey: rule.id,
      groupLabel: rule.name,
      status: 'success',
      summary: `${rule.name} · ${renderedTitle}`,
      meta: {
        ruleId: rule.id,
        triggerType: rule.triggerType,
        babyId: rule.babyId,
        babyName,
        title: renderedTitle,
        body: renderedBody,
        webhookDelivered: true,
        context,
      },
    })
  } catch (error) {
    logError(`Reminder dispatch failed for rule ${rule.id}`, error)

    // Log failure
    activityLogger.record({
      source: 'reminder',
      userId: rule.userId,
      groupKey: rule.id,
      groupLabel: rule.name,
      status: 'failed',
      summary: `${rule.name} · 发送失败`,
      meta: {
        ruleId: rule.id,
        triggerType: rule.triggerType,
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/reminder-dispatcher.ts lib/webhook-events.ts lib/activity-logger.ts
git commit -m "feat(reminder): add dispatcher, webhook event, and activity-logger source"
```

---

### Task 5: Scheduler Engine

**Files:**
- Create: `lib/reminder-scheduler.ts`

- [ ] **Step 1: Create the scheduler module**

Create `lib/reminder-scheduler.ts`:

```typescript
/**
 * Reminder Scheduler Engine
 *
 * In-process singleton that ticks every 60 seconds, evaluates active rules,
 * and fires reminders via the dispatcher.
 */

import { prisma } from './prisma'
import { getEvaluator } from './reminder-evaluators'
import { fireReminder } from './reminder-dispatcher'
import { logError } from './logger'

// ─── Active Schedule helpers ────────────────────────────────────────────────

interface ActiveSchedule {
  windows: Array<{ start: string; end: string }>
  weekdays?: number[]
}

/**
 * Check if a given Beijing time is within the active schedule windows.
 */
function isInActiveWindow(schedule: ActiveSchedule, now: Date): boolean {
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijing = new Date(now.getTime() + beijingOffset)

  // Check weekday (1=Mon..7=Sun)
  if (schedule.weekdays && schedule.weekdays.length > 0) {
    const jsDay = beijing.getUTCDay() // 0=Sun
    const isoDay = jsDay === 0 ? 7 : jsDay
    if (!schedule.weekdays.includes(isoDay)) return false
  }

  const currentMinutes = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()

  for (const window of schedule.windows) {
    const [startH, startM] = window.start.split(':').map(Number)
    const [endH, endM] = window.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (endMinutes > startMinutes) {
      // Normal window (e.g., 06:00-23:00)
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return true
    } else {
      // Overnight window (e.g., 22:00-06:00)
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) return true
    }
  }

  return false
}

/**
 * Compute the next window open time (for nextCheckAt optimization).
 * Returns a Date or null if can't determine.
 */
function nextWindowOpen(schedule: ActiveSchedule, now: Date): Date | null {
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijing = new Date(now.getTime() + beijingOffset)
  const currentMinutes = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()

  // Find the earliest window start that's after current time
  let earliestMinutes: number | null = null
  let isNextDay = false

  for (const window of schedule.windows) {
    const [startH, startM] = window.start.split(':').map(Number)
    const startMinutes = startH * 60 + startM

    if (startMinutes > currentMinutes) {
      if (earliestMinutes === null || startMinutes < earliestMinutes) {
        earliestMinutes = startMinutes
        isNextDay = false
      }
    }
  }

  // If no window found today, use first window tomorrow
  if (earliestMinutes === null && schedule.windows.length > 0) {
    const [startH, startM] = schedule.windows[0].start.split(':').map(Number)
    earliestMinutes = startH * 60 + startM
    isNextDay = true
  }

  if (earliestMinutes === null) return null

  const targetBeijing = new Date(beijing)
  targetBeijing.setUTCHours(Math.floor(earliestMinutes / 60), earliestMinutes % 60, 0, 0)
  if (isNextDay) {
    targetBeijing.setUTCDate(targetBeijing.getUTCDate() + 1)
  }

  // Convert back from Beijing to UTC
  return new Date(targetBeijing.getTime() - beijingOffset)
}

// ─── Scheduler Class ────────────────────────────────────────────────────────

class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false

  start(): void {
    if (process.env.REMINDER_ENABLED === 'false') {
      console.log('[Reminder] Scheduler disabled via REMINDER_ENABLED=false')
      return
    }

    if (this.timer) return // Already running

    console.log('[Reminder] Scheduler started (60s interval)')
    this.timer = setInterval(() => {
      this.tick().catch(err => logError('[Reminder] tick error', err))
    }, 60_000)

    // Run first tick after 5s delay (let DB connect etc.)
    setTimeout(() => {
      this.tick().catch(err => logError('[Reminder] initial tick error', err))
    }, 5_000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[Reminder] Scheduler stopped')
    }
  }

  async tick(): Promise<void> {
    if (this.running) return // Prevent overlapping ticks
    this.running = true

    try {
      const now = new Date()

      // Load active rules that are due for checking
      const rules = await prisma.reminderRule.findMany({
        where: {
          enabled: true,
          OR: [
            { nextCheckAt: null },
            { nextCheckAt: { lte: now } },
          ],
        },
      })

      for (const rule of rules) {
        try {
          await this.evaluateRule(rule, now)
        } catch (error) {
          logError(`[Reminder] Error evaluating rule ${rule.id}`, error)
        }
      }
    } finally {
      this.running = false
    }
  }

  private async evaluateRule(
    rule: {
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
    },
    now: Date
  ): Promise<void> {
    // 1. Lifecycle check
    if (rule.startsAt && now < rule.startsAt) return
    if (rule.expiresAt && now > rule.expiresAt) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { enabled: false },
      })
      return
    }

    // 2. Active window check
    if (rule.activeSchedule) {
      const schedule: ActiveSchedule = JSON.parse(rule.activeSchedule)
      if (!isInActiveWindow(schedule, now)) {
        const nextOpen = nextWindowOpen(schedule, now)
        if (nextOpen) {
          await prisma.reminderRule.update({
            where: { id: rule.id },
            data: { nextCheckAt: nextOpen },
          })
        }
        return
      }
    }

    // 3. Evaluate trigger
    const evaluator = getEvaluator(rule.triggerType)
    if (!evaluator) return

    const result = await evaluator.evaluate(
      {
        id: rule.id,
        userId: rule.userId,
        babyId: rule.babyId,
        triggerType: rule.triggerType,
        triggerConfig: rule.triggerConfig,
        advanceMinutes: rule.advanceMinutes,
        lastFiredAt: rule.lastFiredAt,
      },
      now
    )

    // 4. Fire if needed
    if (result.shouldFire) {
      await fireReminder({
        rule: {
          id: rule.id,
          userId: rule.userId,
          babyId: rule.babyId,
          name: rule.name,
          triggerType: rule.triggerType,
          notifyTitle: rule.notifyTitle,
          notifyBody: rule.notifyBody,
          advanceMinutes: rule.advanceMinutes,
        },
        context: result.context ?? {},
        now,
      })

      // Update rule state
      const nextCheckAt = this.computeNextCheck(rule, now)
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { lastFiredAt: now, nextCheckAt },
      })
    }
  }

  private computeNextCheck(
    rule: { triggerType: string; triggerConfig: string },
    now: Date
  ): Date {
    // For cron: check next minute
    if (rule.triggerType === 'cron') {
      return new Date(now.getTime() + 60_000)
    }
    // For interval: check after interval elapses
    if (rule.triggerType === 'interval') {
      const config = JSON.parse(rule.triggerConfig)
      return new Date(now.getTime() + config.intervalMinutes * 60 * 1000)
    }
    // For event_window: check after repeat interval
    if (rule.triggerType === 'event_window') {
      const config = JSON.parse(rule.triggerConfig)
      return new Date(now.getTime() + config.repeatIntervalMinutes * 60 * 1000)
    }
    // Default: next minute
    return new Date(now.getTime() + 60_000)
  }
}

export const reminderScheduler = new ReminderScheduler()

/**
 * Reset interval rules when a new record is created.
 * Called from webhook-service after feeding/health record creation.
 */
export async function resetIntervalRules(
  userId: string,
  babyId: string,
  sourceType: 'feeding' | 'health'
): Promise<void> {
  try {
    const rules = await prisma.reminderRule.findMany({
      where: {
        userId,
        babyId,
        enabled: true,
        triggerType: 'interval',
      },
    })

    const now = new Date()

    for (const rule of rules) {
      const config = JSON.parse(rule.triggerConfig)
      if (config.sourceType === sourceType) {
        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: {
            lastFiredAt: null,
            nextCheckAt: new Date(now.getTime() + config.intervalMinutes * 60 * 1000),
          },
        })
      }
    }
  } catch (error) {
    logError('[Reminder] resetIntervalRules failed', error)
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/reminder-scheduler.ts
git commit -m "feat(reminder): add scheduler engine with tick logic and reset"
```

---

### Task 6: Instrumentation + Record Reset Integration

**Files:**
- Create: `instrumentation.ts`
- Modify: `lib/webhook-service.ts`

- [ ] **Step 1: Create instrumentation.ts**

Create `instrumentation.ts` in project root:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reminderScheduler } = await import('@/lib/reminder-scheduler')
    reminderScheduler.start()
  }
}
```

- [ ] **Step 2: Add resetIntervalRules calls to webhook-service.ts**

In `lib/webhook-service.ts`, add the import at the top (after existing imports):

```typescript
import { resetIntervalRules } from '@/lib/reminder-scheduler'
```

In the `emitFeedingCreated` function, after the `await emitWebhookEvent(...)` call, add:

```typescript
  // Reset interval reminder timers for feeding
  resetIntervalRules(userId, record.babyId, 'feeding').catch(() => {})
```

In the `emitHealthCreated` function, after the `await emitWebhookEvent(...)` call, add:

```typescript
  // Reset interval reminder timers for health
  resetIntervalRules(userId, record.babyId, 'health').catch(() => {})
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add instrumentation.ts lib/webhook-service.ts
git commit -m "feat(reminder): wire up scheduler startup and record-reset integration"
```

---

### Task 7: API Routes

**Files:**
- Create: `app/api/reminders/route.ts`
- Create: `app/api/reminders/[id]/route.ts`
- Create: `app/api/reminders/logs/route.ts`
- Modify: `lib/rate-limit-config.ts` (add rate limit entries)

- [ ] **Step 1: Add rate limit config**

In `lib/rate-limit-config.ts`, add within the `rateLimitConfig` object:

```typescript
  // ============ 提醒规则 ============
  'reminder-list':          { limit: 60,  windowMs: 60 * 1000 },
  'reminder-create':        { limit: 20,  windowMs: 10 * 60 * 1000 },
  'reminder-update':        { limit: 30,  windowMs: 10 * 60 * 1000 },
  'reminder-delete':        { limit: 20,  windowMs: 15 * 60 * 1000 },
  'reminder-logs-list':     { limit: 60,  windowMs: 60 * 1000 },
  'reminder-logs-delete':   { limit: 10,  windowMs: 10 * 60 * 1000 },
```

- [ ] **Step 2: Create main reminders route (GET + POST)**

Create `app/api/reminders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { safeParseBody, validateSameOrigin, validateString, validateId } from '@/lib/validation'
import { logError } from '@/lib/logger'

const MAX_RULES_PER_USER = 50

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-list', session.user.id, request),
      ...getRateLimit('reminder-list'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId') || undefined
    const enabledParam = searchParams.get('enabled')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (babyId) where.babyId = babyId
    if (enabledParam === 'true') where.enabled = true
    if (enabledParam === 'false') where.enabled = false

    const rules = await prisma.reminderRule.findMany({
      where,
      include: { baby: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const result = rules.map(r => ({
      ...r,
      babyName: r.baby.name,
      triggerConfig: JSON.parse(r.triggerConfig),
      activeSchedule: r.activeSchedule ? JSON.parse(r.activeSchedule) : null,
      baby: undefined,
    }))

    return NextResponse.json(result, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取提醒规则失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-create', session.user.id, request),
      ...getRateLimit('reminder-create'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { name, babyId, triggerType, triggerConfig, activeSchedule, advanceMinutes, notifyTitle, notifyBody, startsAt, expiresAt } = body

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '名称不能为空' }, { status: 400, headers: noStoreHeaders })
    }
    const nameCheck = validateString(name, '名称', 100)
    if (!nameCheck.valid) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    if (!babyId || typeof babyId !== 'string') {
      return NextResponse.json({ error: '缺少 babyId' }, { status: 400, headers: noStoreHeaders })
    }
    const idCheck = validateId(babyId, '宝宝 ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    if (!['interval', 'cron', 'event_window'].includes(triggerType)) {
      return NextResponse.json({ error: '无效的触发器类型' }, { status: 400, headers: noStoreHeaders })
    }

    if (!triggerConfig || typeof triggerConfig !== 'object') {
      return NextResponse.json({ error: '触发器配置不能为空' }, { status: 400, headers: noStoreHeaders })
    }

    if (!notifyTitle || typeof notifyTitle !== 'string') {
      return NextResponse.json({ error: '通知标题不能为空' }, { status: 400, headers: noStoreHeaders })
    }

    // Verify baby belongs to user
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, createdBy: session.user.id },
    })
    if (!baby) {
      return NextResponse.json({ error: '宝宝不存在' }, { status: 404, headers: noStoreHeaders })
    }

    // Check rule count limit
    const count = await prisma.reminderRule.count({ where: { userId: session.user.id } })
    if (count >= MAX_RULES_PER_USER) {
      return NextResponse.json({ error: `最多创建 ${MAX_RULES_PER_USER} 条提醒规则` }, { status: 400, headers: noStoreHeaders })
    }

    const rule = await prisma.reminderRule.create({
      data: {
        userId: session.user.id,
        babyId,
        name: name.trim(),
        triggerType,
        triggerConfig: JSON.stringify(triggerConfig),
        activeSchedule: activeSchedule ? JSON.stringify(activeSchedule) : null,
        advanceMinutes: typeof advanceMinutes === 'number' ? Math.max(0, Math.min(advanceMinutes, 60)) : 0,
        notifyTitle: notifyTitle.trim(),
        notifyBody: typeof notifyBody === 'string' ? notifyBody.trim() || null : null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json(rule, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    logError('创建提醒规则失败', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
```

- [ ] **Step 3: Create [id] route (PUT + DELETE)**

Create directory and file `app/api/reminders/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { safeParseBody, validateSameOrigin, validateId } from '@/lib/validation'
import { logError } from '@/lib/logger'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-update', session.user.id, request),
      ...getRateLimit('reminder-update'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const { id } = await params
    const idCheck = validateId(id, '规则 ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Verify ownership
    const existing = await prisma.reminderRule.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '规则不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // Build update data (partial update)
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = String(body.name).trim()
    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled)
    if (body.triggerConfig !== undefined) updateData.triggerConfig = JSON.stringify(body.triggerConfig)
    if (body.activeSchedule !== undefined) updateData.activeSchedule = body.activeSchedule ? JSON.stringify(body.activeSchedule) : null
    if (body.advanceMinutes !== undefined) updateData.advanceMinutes = Math.max(0, Math.min(Number(body.advanceMinutes), 60))
    if (body.notifyTitle !== undefined) updateData.notifyTitle = String(body.notifyTitle).trim()
    if (body.notifyBody !== undefined) updateData.notifyBody = body.notifyBody ? String(body.notifyBody).trim() : null
    if (body.startsAt !== undefined) updateData.startsAt = body.startsAt ? new Date(body.startsAt) : null
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

    // If rule is being re-enabled or config changed, reset nextCheckAt
    if (body.enabled === true || body.triggerConfig !== undefined) {
      updateData.nextCheckAt = null
    }

    const updated = await prisma.reminderRule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated, { headers: noStoreHeaders })
  } catch (error) {
    logError('更新提醒规则失败', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-delete', session.user.id, request),
      ...getRateLimit('reminder-delete'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const { id } = await params
    const idCheck = validateId(id, '规则 ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const existing = await prisma.reminderRule.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '规则不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.reminderRule.delete({ where: { id } })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    logError('删除提醒规则失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
```

- [ ] **Step 4: Create logs route (GET + DELETE)**

Create `app/api/reminders/logs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { activityLogger } from '@/lib/activity-logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { validateSameOrigin } from '@/lib/validation'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-logs-list', session.user.id, request),
      ...getRateLimit('reminder-logs-list'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('ruleId') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    const result = activityLogger.query('reminder', session.user.id, {
      groupKey: ruleId,
      limit,
      offset,
    })

    return NextResponse.json({ logs: result.entries, total: result.total, offset, limit }, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取提醒日志失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-logs-delete', session.user.id, request),
      ...getRateLimit('reminder-logs-delete'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rl.retryAfterSeconds) } })
    }

    const deleted = activityLogger.clear('reminder', session.user.id)

    return NextResponse.json({ success: true, deleted }, { headers: noStoreHeaders })
  } catch (error) {
    logError('清理提醒日志失败', error)
    return NextResponse.json({ error: '清理失败' }, { status: 500, headers: noStoreHeaders })
  }
}
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/api/reminders/ lib/rate-limit-config.ts
git commit -m "feat(reminder): add API routes for CRUD and logs"
```

---

### Task 8: Settings Page + ReminderManager UI Component

**Files:**
- Create: `app/settings/reminders/page.tsx`
- Create: `components/ReminderManager.tsx`

- [ ] **Step 1: Create settings page wrapper**

Create `app/settings/reminders/page.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import ReminderManager from '@/components/ReminderManager'

export default function RemindersPage() {
  const router = useRouter()

  return <ReminderManager onBack={() => router.push('/settings')} />
}
```

- [ ] **Step 2: Create ReminderManager component**

Create `components/ReminderManager.tsx` — this is a large client component following the same pattern as `ApiKeyManager.tsx` and `WebhookManager.tsx`. Due to its size, it is provided as a complete file in the implementation. The component includes:

1. Rule list with enable/disable toggles
2. Create/Edit modal with dynamic forms per trigger type
3. Execution log section with refresh and clear
4. Auto-refresh of logs every 30 seconds

The full component code should follow the established UI patterns (rounded cards, `mobile-touch-target` buttons, lucide icons, `date-fns` formatting with `zhCN` locale).

Key features to implement:
- Fetch rules from `GET /api/reminders`
- Create rule via `POST /api/reminders`
- Toggle enabled via `PUT /api/reminders/[id]`
- Delete via `DELETE /api/reminders/[id]`
- Fetch logs from `GET /api/reminders/logs`
- Clear logs via `DELETE /api/reminders/logs`
- Type badges: 间隔 (interval), 定时 (cron), 窗口 (event_window)
- Active schedule display as quiet-hours summary

- [ ] **Step 3: Add reminders link to settings page**

In the existing settings page (`app/settings/page.tsx`), add a navigation item for "提醒管理" pointing to `/settings/reminders`, following the same pattern as the existing API Key and Webhook links.

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: Build completes successfully

- [ ] **Step 5: Commit**

```bash
git add app/settings/reminders/ components/ReminderManager.tsx app/settings/page.tsx
git commit -m "feat(reminder): add settings page and ReminderManager UI"
```

---

### Task 9: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `docs/HTTP_REQUESTS.md`

- [ ] **Step 1: Update README.md**

Add to the "其他特性" section:
```markdown
- **智能提醒系统**：支持喂养间隔提醒、定时循环提醒（如每日AD）、事件窗口提醒（如疫苗后测体温），支持静默时段和 Webhook 通知
```

Add to the API table:
```markdown
| `/api/reminders` | GET/POST | 提醒规则列表 / 创建规则 |
| `/api/reminders/[id]` | PUT/DELETE | 更新 / 删除提醒规则 |
| `/api/reminders/logs` | GET/DELETE | 提醒执行日志 |
```

Add to environment variables table:
```markdown
| `REMINDER_ENABLED` | 否 | 设为 `false` 禁用提醒调度器（默认启用） |
```

- [ ] **Step 2: Update docs/HTTP_REQUESTS.md**

Add a new section "12. 提醒系统" with full documentation for:
- 12.1 获取提醒规则列表 (GET /api/reminders)
- 12.2 创建提醒规则 (POST /api/reminders)
- 12.3 更新提醒规则 (PUT /api/reminders/:id)
- 12.4 删除提醒规则 (DELETE /api/reminders/:id)
- 12.5 获取执行日志 (GET /api/reminders/logs)
- 12.6 清理执行日志 (DELETE /api/reminders/logs)

Including full request/response examples and all parameter documentation.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/HTTP_REQUESTS.md
git commit -m "docs: add reminder system API documentation"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npx eslint lib/reminder-scheduler.ts lib/reminder-dispatcher.ts lib/reminder-evaluators/ lib/cron-parser.ts app/api/reminders/ components/ReminderManager.tsx instrumentation.ts`
Expected: No errors (warnings OK)

- [ ] **Step 3: Run full build**

Run: `npx next build`
Expected: Build completes successfully

- [ ] **Step 4: Verify Prisma migration applies**

Run: `npx prisma migrate deploy`
Expected: Migration applied successfully
