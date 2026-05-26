# Reminder System - Generic Scheduled Task Engine

## Overview

A flexible, extensible reminder/scheduled task system for the baby-feed app. Supports multiple trigger patterns (interval-based, cron-based, event-window-based) through a single generic data model. New reminder types can be added by implementing a new evaluator function without modifying the database schema.

## Goals

1. **Generic data model**: One `ReminderRule` table handles all reminder types via JSON config
2. **Pluggable evaluators**: Each trigger type has an independent evaluator module
3. **In-process scheduler**: `setInterval`-based ticker (1-minute granularity), no external cron dependency
4. **Active schedule**: Rules support quiet hours / active windows to suppress triggering during sleep
5. **Webhook-only notification**: Triggers emit `reminder.fired` events to existing webhook infrastructure
6. **Execution logging**: Uses existing `activity-logger` for in-memory trigger history display
7. **UI + API**: Settings page for managing rules + full REST API

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Reminder Scheduler                         │
│                 (lib/reminder-scheduler.ts)                   │
│                                                              │
│  ┌──────────────┐  60s   ┌───────────────────────────┐      │
│  │ setInterval  ├───────▶│  tick()                    │      │
│  └──────────────┘        │                            │      │
│                          │  1. loadActiveRules(now)    │      │
│                          │  2. for each rule:          │      │
│                          │     a. isInActiveWindow()?  │      │
│                          │     b. evaluate(rule, now)  │      │
│                          │     c. shouldFire()?        │      │
│                          │  3. fireReminder(rule, ctx) │      │
│                          └───────────────────────────────┘   │
│                                     │                        │
│           ┌─────────────────────────┼────────────────┐       │
│           ▼                         ▼                ▼       │
│   ┌───────────────┐  ┌────────────────────┐ ┌────────────┐  │
│   │IntervalEval   │  │ CronEvaluator      │ │EventWindow │  │
│   │               │  │                    │ │Evaluator   │  │
│   │ Query last    │  │ Parse cron expr    │ │            │  │
│   │ matching      │  │ Check if current   │ │ Check if   │  │
│   │ record from   │  │ minute matches     │ │ within     │  │
│   │ DB            │  │                    │ │ window +   │  │
│   └───────────────┘  └────────────────────┘ │ repeat int │  │
│                                              └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                │ fire
                ▼
┌──────────────────────────────────────────────────┐
│            Notification Dispatcher                │
│                                                  │
│  1. Render notification template (var replace)   │
│  2. Emit webhook event: "reminder.fired"         │
│  3. Record to activity-logger (source: reminder) │
│  4. Update rule.lastFiredAt + nextCheckAt in DB  │
└──────────────────────────────────────────────────┘
```

## Data Model

### Prisma Schema

```prisma
model ReminderRule {
  id              String    @id @default(cuid())
  userId          String
  babyId          String

  // ─── Basic info ───
  name            String              // Human-readable name
  enabled         Boolean   @default(true)

  // ─── Trigger type ───
  // "interval"      — fire when N minutes elapsed since last matching record
  // "cron"          — fire at fixed times (cron expression)
  // "event_window"  — fire repeatedly within a time window after an anchor event
  triggerType      String

  // ─── Trigger config (JSON) ───
  // Schema varies by triggerType; stored as serialized JSON string
  triggerConfig    String

  // ─── Active schedule (JSON, nullable) ───
  // Defines when the rule is active; null = always active (24/7)
  activeSchedule   String?

  // ─── Advance notice ───
  // 0 = fire at exact trigger time; 10 = fire 10 minutes early
  advanceMinutes   Int       @default(0)

  // ─── Notification template ───
  notifyTitle      String
  notifyBody       String?

  // ─── Lifecycle ───
  startsAt         DateTime?           // Rule effective from (null = immediately)
  expiresAt        DateTime?           // Rule expires at (null = never)

  // ─── Runtime state ───
  lastFiredAt      DateTime?           // Last time this rule fired
  nextCheckAt      DateTime?           // Optimization: skip ticks before this time

  // ─── Metadata ───
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  baby             Baby      @relation(fields: [babyId], references: [id], onDelete: Cascade)

  @@index([userId, enabled])
  @@index([babyId])
  @@index([enabled, nextCheckAt])
}
```

### triggerConfig Schemas

#### interval

Fires when the elapsed time since the last matching record exceeds a threshold.

```typescript
interface IntervalTriggerConfig {
  sourceType: 'feeding' | 'health'     // Which record table to query
  intervalMinutes: number               // Threshold in minutes
  filterCondition?: {                   // Optional: filter which records count
    type?: string[]                     // e.g., ["FORMULA", "BREAST_MILK"]
    [key: string]: unknown
  }
}
```

**Example**: Alert if no feeding in 3 hours:
```json
{
  "sourceType": "feeding",
  "intervalMinutes": 180,
  "filterCondition": { "type": ["FORMULA", "BREAST_MILK", "BREAST_MILK_BOTTLE"] }
}
```

#### cron

Fires at fixed times defined by a cron expression (evaluated in Beijing time).

```typescript
interface CronTriggerConfig {
  cronExpr: string                     // Standard 5-field cron (min hour dom month dow)
}
```

**Example**: Every day at 11:00 AM Beijing time:
```json
{
  "cronExpr": "0 11 * * *"
}
```

#### event_window

Fires repeatedly within a time window anchored to a specific event (e.g., post-vaccine monitoring).

```typescript
interface EventWindowTriggerConfig {
  anchorTime: string                   // ISO datetime: when the window started
  windowHours: number                  // Window duration from anchor
  repeatIntervalMinutes: number        // How often to fire within the window
}
```

**Example**: After vaccine at 2026-05-26T10:00, remind every 8h for 48h:
```json
{
  "anchorTime": "2026-05-26T10:00:00+08:00",
  "windowHours": 48,
  "repeatIntervalMinutes": 480
}
```

### activeSchedule Schema

Defines time windows during which the rule is active. Outside these windows, the rule is suppressed (quiet hours).

```typescript
interface ActiveSchedule {
  windows: Array<{
    start: string    // "HH:MM" in Beijing time
    end: string      // "HH:MM" in Beijing time (can be next day if end < start)
  }>
  weekdays?: number[]  // 1=Mon..7=Sun; omit = all days
}
```

**Example**: Active 06:00–23:00 daily:
```json
{
  "windows": [{ "start": "06:00", "end": "23:00" }]
}
```

**Behavior at window boundary**: When a rule should have fired during quiet hours, it fires immediately when the next active window begins ("catch-up fire on window open").

## Scheduler Engine

### Module: `lib/reminder-scheduler.ts`

Singleton scheduler initialized once at process start via Next.js `instrumentation.ts`.

```typescript
class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null

  start(): void    // Start the 60s interval
  stop(): void     // Clear interval (graceful shutdown)
  tick(): Promise<void>  // Single evaluation cycle
}

export const reminderScheduler = new ReminderScheduler()
```

### Tick Logic (pseudo-code)

```
tick():
  now = currentBeijingTime()
  rules = DB.query(enabled=true, nextCheckAt <= now OR nextCheckAt IS NULL)

  for rule in rules:
    // 1. Lifecycle check
    if rule.startsAt && now < rule.startsAt: skip
    if rule.expiresAt && now > rule.expiresAt: disable rule, skip

    // 2. Active window check
    if rule.activeSchedule && !isInActiveWindow(rule.activeSchedule, now):
      // Set nextCheckAt to window open time for optimization
      rule.nextCheckAt = nextWindowOpen(rule.activeSchedule, now)
      skip

    // 3. Evaluate trigger
    result = evaluators[rule.triggerType].evaluate(rule, now)

    // 4. Fire if needed
    if result.shouldFire:
      fireReminder(rule, result.context)
      rule.lastFiredAt = now
      rule.nextCheckAt = computeNextCheck(rule, now)
      DB.update(rule)
```

### Evaluator Interface

```typescript
interface EvaluateResult {
  shouldFire: boolean
  context?: Record<string, unknown>  // Extra data for template rendering
}

interface RuleEvaluator {
  evaluate(rule: ReminderRuleWithConfig, now: Date): Promise<EvaluateResult>
}
```

### Evaluator: Interval

```
evaluate(rule, now):
  config = parse(rule.triggerConfig) as IntervalTriggerConfig
  advancedNow = now + rule.advanceMinutes minutes

  lastRecord = DB.query(
    table: config.sourceType,
    babyId: rule.babyId,
    filter: config.filterCondition,
    orderBy: startTime DESC,
    limit: 1
  )

  if !lastRecord: shouldFire = true (never fed)
  else:
    elapsed = advancedNow - lastRecord.startTime
    shouldFire = elapsed >= config.intervalMinutes minutes

  // Prevent re-firing: check lastFiredAt
  if shouldFire && rule.lastFiredAt:
    timeSinceLastFire = now - rule.lastFiredAt
    if timeSinceLastFire < config.intervalMinutes minutes:
      shouldFire = false  // Already fired for this interval

  return { shouldFire, context: { elapsed, lastRecordTime } }
```

### Evaluator: Cron

```
evaluate(rule, now):
  config = parse(rule.triggerConfig) as CronTriggerConfig
  advancedNow = now + rule.advanceMinutes minutes

  if cronMatches(config.cronExpr, advancedNow):
    // Prevent duplicate fire in same minute
    if rule.lastFiredAt && sameMinute(rule.lastFiredAt, now):
      return { shouldFire: false }
    return { shouldFire: true }

  return { shouldFire: false }
```

### Evaluator: Event Window

```
evaluate(rule, now):
  config = parse(rule.triggerConfig) as EventWindowTriggerConfig
  anchor = parseISO(config.anchorTime)
  windowEnd = anchor + config.windowHours hours

  if now > windowEnd:
    // Window expired — disable rule
    DB.update(rule, { enabled: false })
    return { shouldFire: false }

  // Calculate expected fire times within the window
  advancedNow = now + rule.advanceMinutes minutes
  elapsedSinceAnchor = advancedNow - anchor
  intervalMs = config.repeatIntervalMinutes * 60 * 1000
  currentSlot = floor(elapsedSinceAnchor / intervalMs)

  // Check if we're in a new slot since lastFiredAt
  if rule.lastFiredAt:
    lastSlot = floor((rule.lastFiredAt - anchor) / intervalMs)
    if currentSlot > lastSlot:
      return { shouldFire: true, context: { slot: currentSlot, windowEnd } }
    return { shouldFire: false }
  else:
    // First fire
    if currentSlot >= 1:
      return { shouldFire: true, context: { slot: currentSlot, windowEnd } }
    return { shouldFire: false }
```

## Record Reset Logic

When a new feeding or health record is created, interval-type rules monitoring that record type need their timer reset.

**Integration point**: In `lib/webhook-service.ts`, after emitting `feeding.created` / `health.created`:

```typescript
import { resetIntervalRules } from '@/lib/reminder-scheduler'

// After record creation:
resetIntervalRules(userId, babyId, recordType)
```

This function:
1. Finds all enabled interval rules for this user+baby with matching `sourceType`
2. Sets `lastFiredAt = null` (reset the fire-once-per-interval guard)
3. Sets `nextCheckAt = now + intervalMinutes` (optimization: don't check until interval elapses)

## Notification Dispatch

When a rule fires:

1. **Template rendering**: Replace variables in `notifyTitle` / `notifyBody`:
   - `{{babyName}}` — baby's name
   - `{{elapsed}}` — time since last record (for interval type)
   - `{{ruleName}}` — rule name
   - `{{now}}` — current Beijing time formatted

2. **Emit webhook event**: Call existing `emitWebhookEvent()` with type `reminder.fired`

3. **Log to activity-logger**: Record success/failure to `source: 'reminder'`

4. **Update rule state**: Set `lastFiredAt`, compute `nextCheckAt`

### Webhook Event: `reminder.fired`

```typescript
// Added to WEBHOOK_EVENTS:
REMINDER_FIRED: 'reminder.fired'
```

Payload structure:
```json
{
  "id": "event_id",
  "type": "reminder.fired",
  "timestamp": "2026-05-26T11:00:00+08:00",
  "userId": "cxxx",
  "data": {
    "ruleId": "cxxx",
    "ruleName": "喂养间隔提醒",
    "triggerType": "interval",
    "babyId": "cxxx",
    "babyName": "宝宝",
    "title": "该喂宝宝了",
    "body": "距离上次喂养已经3小时12分钟",
    "context": {
      "elapsedMinutes": 192,
      "lastRecordTime": "2026-05-26T07:48:00+08:00"
    }
  }
}
```

## Execution Logging

Register new source in `activity-logger`:

```typescript
activityLogger.registerSource('reminder', {
  maxEntries: 1000,
  maxPerGroup: 200,
  ttlMs: 72 * 60 * 60 * 1000,  // 72 hours
})
```

Each trigger records:
```typescript
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
    context: evaluationContext,
  },
})
```

## API Endpoints

### GET `/api/reminders`

List all reminder rules for current user.

Query params: `babyId?`, `enabled?`

Response:
```json
[
  {
    "id": "cxxx",
    "name": "喂养间隔提醒",
    "babyId": "cxxx",
    "babyName": "宝宝",
    "enabled": true,
    "triggerType": "interval",
    "triggerConfig": { "sourceType": "feeding", "intervalMinutes": 180 },
    "activeSchedule": { "windows": [{ "start": "06:00", "end": "23:00" }] },
    "advanceMinutes": 10,
    "notifyTitle": "该喂{{babyName}}了",
    "notifyBody": "距离上次喂养已经超过3小时",
    "lastFiredAt": "2026-05-26T10:00:00Z",
    "createdAt": "2026-05-25T12:00:00Z"
  }
]
```

### POST `/api/reminders`

Create a new reminder rule.

Request body:
```json
{
  "name": "每日AD",
  "babyId": "cxxx",
  "triggerType": "cron",
  "triggerConfig": { "cronExpr": "0 11 * * *" },
  "activeSchedule": null,
  "advanceMinutes": 0,
  "notifyTitle": "该给{{babyName}}吃AD啦",
  "notifyBody": "每日维生素AD提醒",
  "startsAt": null,
  "expiresAt": null
}
```

### PUT `/api/reminders/[id]`

Update a rule (partial update supported).

### DELETE `/api/reminders/[id]`

Delete a rule.

### GET `/api/reminders/logs`

Query reminder execution logs from activity-logger.

Query params: `ruleId?`, `limit?`, `offset?`

### DELETE `/api/reminders/logs`

Clear reminder execution logs.

## UI Design

### Settings → Reminder Management Page

Located at `/settings/reminders`, following existing settings sub-page pattern (like API Key, Webhook managers).

**Components:**
- `components/ReminderManager.tsx` — main page component

**Sections:**

1. **Rule List Card** — "我的提醒" with create button
   - Each rule shows: name, type badge (间隔/定时/窗口), baby name, enabled toggle
   - Expandable: shows trigger config details, last fired time, active schedule
   - Actions: edit, delete

2. **Create/Edit Modal** — form fields:
   - Name, baby selector
   - Trigger type selector → dynamic config form per type
   - Active schedule (optional): window start/end time pickers
   - Advance minutes
   - Notification title/body (with variable hints)

3. **Execution Log Card** — "执行日志" (independent section below rules)
   - Similar to API Key request logs
   - Shows: time, rule name, status, summary
   - Refresh + clear buttons

## File Structure

```
lib/
  reminder-scheduler.ts       — Singleton scheduler (start/stop/tick)
  reminder-evaluators/
    index.ts                  — Evaluator registry
    interval.ts               — Interval evaluator
    cron.ts                   — Cron evaluator
    event-window.ts           — Event window evaluator
  reminder-dispatcher.ts      — Template rendering + webhook + logging

app/
  api/
    reminders/
      route.ts               — GET (list) + POST (create)
      [id]/
        route.ts             — PUT + DELETE
      logs/
        route.ts             — GET + DELETE

  settings/
    reminders/
      page.tsx               — Server page wrapper

components/
  ReminderManager.tsx         — Client component

instrumentation.ts            — Initialize scheduler on process start
```

## Scheduler Initialization

Using Next.js `instrumentation.ts` (runs once on server start):

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reminderScheduler } = await import('@/lib/reminder-scheduler')
    reminderScheduler.start()
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `REMINDER_ENABLED` | No | Set to `"false"` to disable the scheduler (default: enabled) |

## Memory & Performance

- **Tick efficiency**: Query only rules where `nextCheckAt <= now` (indexed)
- **DB queries per tick**: 1 query for rules + 1 per interval-type rule (for last record)
- **Expected load**: <10 rules per user, <50 total for self-hosted instance
- **Memory**: activity-logger bounded at 1000 entries for reminder source
- **Timer**: Single `setInterval`, negligible CPU overhead

## Edge Cases

1. **Process restart**: Rules persist in DB. Timer restarts via `instrumentation.ts`. Any missed fires during downtime are caught on first tick (catch-up).

2. **Quiet hours boundary**: When a rule's interval expires during quiet hours, it fires immediately when the active window opens.

3. **Rule disabled while interval running**: If user disables a rule, it stops being loaded by `loadActiveRules()`.

4. **Event window expiry**: When `now > anchorTime + windowHours`, the rule auto-disables itself.

5. **Concurrent record creation**: `resetIntervalRules()` uses the latest record time, so concurrent writes naturally resolve to the most recent.

6. **Cron at startup**: If the server was down at a cron time (e.g., daily 11:00) and restarts at 11:05, the first tick after restart will NOT retroactively fire (cron is point-in-time, not catch-up). Only interval and event_window types catch up.

## Implementation Order

1. Add `ReminderRule` model to Prisma schema + migration (also add `reminderRules` relation to `User` and `Baby` models)
2. Create `lib/reminder-evaluators/` (interval, cron, event-window)
3. Create `lib/reminder-scheduler.ts` (tick logic)
4. Create `lib/reminder-dispatcher.ts` (template + webhook + logger)
5. Add `reminder.fired` to webhook events
6. Create API routes (`/api/reminders/...`)
7. Wire up `instrumentation.ts`
8. Add record-reset integration in `webhook-service.ts`
9. Create `components/ReminderManager.tsx` + settings page
10. Register `reminder` source in activity-logger
11. Update docs (README, HTTP_REQUESTS.md)
