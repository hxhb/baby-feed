# Activity Logger - In-Memory Generic Log System

## Overview

Create a generic in-memory activity logger component (`lib/activity-logger.ts`) that supports multiple log sources with source isolation. Migrate both **API Key request logs** (new feature) and **Webhook delivery logs** (currently in DB) to use this unified system.

All logs are stored in-memory only, with 24-hour auto-expiry and manual cleanup support. Process restart clears all logs by design.

## Goals

1. **Generic**: One logger module serves any log source (API Key, Webhook, future sources)
2. **Source-isolated**: Each source has independent storage, limits, and cleanup
3. **Ephemeral**: In-memory only, 24h TTL, no DB persistence
4. **Unified API**: Common query/clear/stats interface across all sources
5. **Minimal footprint**: Bounded memory usage with configurable limits per source

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  lib/activity-logger.ts                  │
│                                                         │
│  ActivityLogger (singleton)                              │
│  ├─ sources: Map<string, LogSource>                     │
│  │   ├─ "api-key" → { logs: LogEntry[], config }       │
│  │   └─ "webhook" → { logs: LogEntry[], config }       │
│  │                                                      │
│  ├─ registerSource(name, config)                        │
│  ├─ record(source, entry)                               │
│  ├─ query(source, filters) → LogEntry[]                 │
│  ├─ clear(source, filters?)                             │
│  └─ stats(source) → { total, byKey }                   │
└─────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
   ┌─────┴─────┐               ┌───────┴───────┐
   │ api-key.ts │               │ webhook-runner │
   │ (on auth)  │               │ (on delivery)  │
   └────────────┘               └────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐        ┌──────────────────────┐
│ GET/DELETE       │        │ GET/DELETE            │
│ /api/user/      │        │ /api/webhooks/        │
│ api-key-logs    │        │ deliveries            │
└─────────────────┘        └──────────────────────┘
```

## Data Structures

### Generic Log Entry

```typescript
interface ActivityLogEntry {
  id: string           // Random short ID (8 chars hex)
  timestamp: number    // Date.now()
  source: string       // "api-key" | "webhook" | future sources
  userId: string       // Owner user ID (for access control)
  groupKey: string     // Grouping key (keyId for api-key, endpointId for webhook)
  groupLabel: string   // Human-readable group label (key name, endpoint URL)
  
  // Common fields
  status: 'success' | 'failed' | 'pending'
  summary: string      // Human-readable one-line summary
  
  // Source-specific metadata (flexible)
  meta: Record<string, unknown>
}
```

### API Key Log Entry `meta`

```typescript
{
  method: string       // "GET" | "POST" | "PUT" | "DELETE"
  path: string         // "/api/feeding"
  ip: string           // Client IP
}
```

### Webhook Delivery Log Entry `meta`

```typescript
{
  eventType: string       // "feeding.created"
  eventId: string         // Event correlation ID
  attemptNumber: number   // Retry attempt
  httpStatus: number | null
  errorMessage: string | null
  sentAt: string | null   // ISO datetime
  endpointUrl: string
}
```

### Source Configuration

```typescript
interface LogSourceConfig {
  maxEntries: number     // Per-source global max (default: 500)
  maxPerGroup: number    // Per-group max (default: 100)
  ttlMs: number          // Time-to-live (default: 24 * 60 * 60 * 1000)
}
```

## Source Configurations

| Source | maxEntries | maxPerGroup | TTL |
|--------|-----------|-------------|-----|
| api-key | 500 | 100 | 24h |
| webhook | 1000 | 200 | 24h |

## Core Module: `lib/activity-logger.ts`

### Public API

```typescript
// Singleton instance
export const activityLogger: ActivityLogger

// Register a new log source with its config
activityLogger.registerSource(name: string, config: Partial<LogSourceConfig>): void

// Record a log entry
activityLogger.record(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void

// Query logs for a source, filtered by userId (required) and optional groupKey
activityLogger.query(source: string, userId: string, options?: {
  groupKey?: string
  status?: string
  limit?: number
  offset?: number
}): { entries: ActivityLogEntry[], total: number }

// Clear logs for a source (all for user, or specific group)
activityLogger.clear(source: string, userId: string, groupKey?: string): number

// Get stats for a source
activityLogger.stats(source: string, userId: string): {
  total: number
  byGroup: Record<string, number>
  oldestTimestamp: number | null
}
```

### Internal Behavior

- **Storage**: Single flat array per source (simple, fast iteration)
- **Eviction on write**: When `record()` is called:
  1. Lazy-purge entries older than TTL
  2. If still over `maxEntries`, remove oldest entries until under limit
  3. If the group exceeds `maxPerGroup`, remove oldest entries for that group
- **No background timers**: Cleanup is lazy (on read/write), not interval-based. This avoids timer management complexity and is sufficient for the scale.

## Changes to Webhook System

### What stays in DB

- `WebhookEndpoint` model - persists endpoint configuration (URL, secret, events, active flag, retry settings)

### What moves to memory

- `WebhookEvent` model → removed from schema, events tracked only in memory via activity-logger
- `WebhookDelivery` model → removed from schema, delivery tracking in memory

### Modified webhook flow

**Current flow:**
1. `emitWebhookEvent()` → creates DB `WebhookEvent` record → creates DB `WebhookDelivery` records → attempts immediate delivery → cron retries failures from DB

**New flow:**
1. `emitWebhookEvent()` → attempts immediate delivery → records result to activity-logger
2. On failure: adds to in-memory retry queue (simple array with `nextRetryAt`)
3. Cron runner: reads in-memory retry queue → retries → records result to activity-logger
4. After max retries exhausted → records final failure to activity-logger

### In-Memory Retry Queue

```typescript
// Separate from the activity logger (different concern)
interface PendingWebhookDelivery {
  id: string
  eventPayload: string    // The JSON payload to deliver
  eventType: string
  endpointId: string
  endpointUrl: string
  endpointSecret: string
  userId: string
  attemptNumber: number
  maxRetries: number
  retryDelay: number      // base delay seconds
  nextRetryAt: number     // Date.now() based
  createdAt: number
}

// Stored in webhook-runner.ts module-level array
// Capped at 500 entries, auto-evicts entries older than 24h
```

## New Files

| File | Purpose |
|------|---------|
| `lib/activity-logger.ts` | Generic in-memory log storage module |
| `app/api/user/api-key-logs/route.ts` | API Key logs query + clear endpoint |

## Modified Files

| File | Changes |
|------|---------|
| `lib/api-key.ts` | Add `recordApiRequest()` call on successful auth, attach keyId/keyName to session |
| `lib/webhook-runner.ts` | Rewrite to use in-memory retry queue + activity-logger instead of DB |
| `lib/webhook-service.ts` | Remove DB event/delivery creation, use direct delivery + activity-logger |
| `app/api/webhooks/route.ts` | Update GET handler: replace `_count.deliveries` with activity-logger stats |
| `app/api/webhooks/deliveries/route.ts` | Rewrite to read from activity-logger instead of DB |
| `app/api/cron/webhook-runner/route.ts` | Update to process in-memory queue |
| `components/ApiKeyManager.tsx` | Add "请求日志" section below key list |
| `components/WebhookManager.tsx` | Update delivery log UI to use new API response format |
| `prisma/schema.prisma` | Remove `WebhookEvent` and `WebhookDelivery` models, remove `webhookEvents` from User |

## Database Migration

Create a new Prisma migration that:
1. Drops `WebhookDelivery` table
2. Drops `WebhookEvent` table

Schema changes:
- Remove `WebhookEvent` model entirely
- Remove `WebhookDelivery` model entirely
- Remove `webhookEvents WebhookEvent[]` relation from `User` model
- Remove `deliveries WebhookDelivery[]` relation from `WebhookEndpoint` model

The `WebhookEndpoint` table structure in DB remains unchanged (no columns reference the dropped tables directly — the FK was on the delivery side).

**Note on `deliveriesCount`**: The `GET /api/webhooks` endpoint currently uses `_count: { select: { deliveries: true } }`. After migration, this will be replaced with a call to `activityLogger.stats('webhook', userId)` to get per-endpoint log counts from memory.

## API Endpoints

### GET `/api/user/api-key-logs`

Query params: `keyId?`, `limit?` (default 50, max 100), `offset?` (default 0)

Response:
```json
{
  "logs": [
    {
      "id": "a1b2c3d4",
      "timestamp": 1716700000000,
      "status": "success",
      "summary": "GET /api/feeding",
      "groupLabel": "iOS快捷指令",
      "meta": { "method": "GET", "path": "/api/feeding", "ip": "192.168.1.1" }
    }
  ],
  "total": 42,
  "offset": 0,
  "limit": 50
}
```

### DELETE `/api/user/api-key-logs`

Query params: `keyId?` (optional, clear specific key's logs; omit to clear all)

Response:
```json
{ "success": true, "deleted": 42 }
```

### GET `/api/webhooks/deliveries` (modified)

Same query params as before. Response format changes slightly to match activity-logger output:

```json
{
  "deliveries": [
    {
      "id": "x1y2z3w4",
      "timestamp": 1716700000000,
      "status": "success",
      "summary": "新增喂养 · 奶粉 120ml",
      "groupLabel": "https://example.com/webhook",
      "meta": {
        "eventType": "feeding.created",
        "attemptNumber": 1,
        "httpStatus": 200,
        "errorMessage": null,
        "sentAt": "2026-05-26T10:00:00Z",
        "endpointUrl": "https://example.com/webhook"
      }
    }
  ],
  "total": 10,
  "offset": 0,
  "limit": 50
}
```

### DELETE `/api/webhooks/deliveries` (modified)

Query params: `endpointId?` (optional)

Now clears from activity-logger instead of DB.

## UI Changes

### ApiKeyManager.tsx — New "请求日志" Section

Added below the "我的 Key" card as an independent card:

- **Header**: "请求日志" with log count badge + "清理" button (right-aligned)
- **Empty state**: "暂无请求记录" with muted icon
- **Log list**: Scrollable, most recent first
  - Each entry shows:
    - Status dot (green=success)
    - HTTP method badge (GET/POST/PUT/DELETE in colored pill)
    - Path (truncated if long)
    - Key name (muted)
    - IP address (muted, small)
    - Relative time ("2分钟前")
  - Auto-refreshes every 30 seconds when visible
- **Manual clear**: Confirmation dialog → calls DELETE endpoint

### WebhookManager.tsx — Updated Delivery Logs

Minimal changes to the existing delivery log UI. Adjust to new response shape from activity-logger:
- Map `meta.eventType` → `EVENT_LABELS`
- Map `meta.httpStatus` for status display
- Map `meta.sentAt` for timestamp display
- Remove any references to DB-specific fields (`respondedAt`, `nextRetryAt`)

## Memory Budget

Estimated per-entry size:
- API Key log: ~200 bytes (short strings, no payload)
- Webhook delivery log: ~400 bytes (includes eventType, URL, error messages)

Worst case: 500 api-key entries + 1000 webhook entries = 500KB total. Negligible for a self-hosted Node.js process.

## Error Handling

- Activity logger never throws. All operations are wrapped in try-catch with silent failure.
- If the logger reaches memory limits, oldest entries are evicted (not new entries rejected).
- Auth failures in `authByApiKey` are NOT logged (only successful requests).

## Testing Considerations

- Unit test `activity-logger.ts` for: record, query, TTL eviction, max entries eviction, per-group limits, clear
- Integration test for API Key log recording flow
- Integration test for webhook delivery recording (new flow without DB)
- Verify Prisma migration removes tables cleanly

## Migration Plan (Implementation Order)

1. Create `lib/activity-logger.ts` (no dependencies, can be tested in isolation)
2. Create `app/api/user/api-key-logs/route.ts` + modify `lib/api-key.ts` (API Key logging — independent of webhook changes)
3. Update `components/ApiKeyManager.tsx` (UI for API Key logs)
4. Rewrite `lib/webhook-runner.ts` and `lib/webhook-service.ts` (switch to in-memory)
5. Update `app/api/webhooks/deliveries/route.ts` and `app/api/cron/webhook-runner/route.ts`
6. Update `components/WebhookManager.tsx` (adjust to new response format)
7. Remove `WebhookEvent` and `WebhookDelivery` from Prisma schema + create migration
8. Clean up: remove `cleanupOldDeliveries()` / `cleanupOldWebhookRecords()` functions
