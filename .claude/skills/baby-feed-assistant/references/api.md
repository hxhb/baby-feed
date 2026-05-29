# Baby Feed — Full API Reference

Detailed endpoint signatures, field tables, and response shapes for every
Baby Feed HTTP API. SKILL.md keeps a high-level intent-to-endpoint routing
table; **read this file when you need exact field names, value types, or
response structure**.

All POSTed times must end with `+08:00`. All response times end with `Z` (UTC) — add 8h to display. See `references/time-handling.md` for the full timezone rules.

Use `bash <SKILL_DIR>/scripts/query-api.sh` to call any endpoint (auth + filter built in).

---

## 1. Baby

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/babies` | List all babies; cache `id` + `name` |
| GET | `/api/babies/:id` | Single baby (for `birthDate`, age math) |

Baby fields: `id`, `name`, `birthDate`, `gender`, `createdAt`, `updatedAt`.

---

## 2. Feeding

### GET `/api/feeding?babyId=ID[&date=YYYY-MM-DD]`
Sorted `startTime` DESC. Omit `date` for full history.

### POST `/api/feeding`
Required: `babyId`, `type`, `startTime` (with `+08:00`).

| `type` | Required type-specific fields |
|--------|-------------------------------|
| `BREAST_MILK`        | `leftBreastDuration`, `rightBreastDuration` (minutes) |
| `BREAST_MILK_BOTTLE` | `breastMilkAmount` (ml) |
| `FORMULA`            | `formulaAmount` (ml) |
| `SOLID_FOOD`         | `solidFoodName`, `solidFoodAmount` (string) |

Optional: `endTime` (with `+08:00`), `notes`.

---

## 3. Health Records

All health types share `GET /api/health` and `POST /api/health`. Discriminated by `type`.

### GET `/api/health?babyId=ID[&type=TYPE][&date=YYYY-MM-DD]`
Sorted `recordedAt` DESC, so `[0]` is the most recent. Behavior:
- `type` only → full history of that type
- `type` + `date` → that type on that day
- `date` only → all types on that day, mixed

### POST `/api/health`
Common required fields: `babyId`, `type`, `recordedAt` (with `+08:00`). Plus the type-specific fields below.

**`notes` (string) is universally optional** for every type listed below — both as POST input and as a returned field on GET responses (may be `null`).

| `type` (Chinese) | Type-specific fields | Notes |
|---|---|---|
| `WEIGHT` (体重)         | `weight` (kg, number, e.g. `9.2`) | For trends, prefer `stats.weightTrend[]` (full history, sorted asc). |
| `HEIGHT` (身高)         | `height` (cm, number, e.g. `66`) | For trends, prefer `stats.heightTrend[]`. |
| `TEMPERATURE` (体温)    | `temperature` (°C, number, e.g. `36.8`) | Highlight ≥37.5 as low fever, ≥38.5 as fever. |
| `DIAPER` (尿布)         | `diaperType` ∈ `PEE`/`POOP`/`BOTH`, optional `diaperStatus` (free text, e.g. `多`/`稀`) | `BOTH` counts as 1 pee + 1 poop. |
| `VACCINE` (疫苗)        | `vaccineName`, `vaccineDoseNumber`, `vaccineTotalDoses` (all required), optional `vaccineManufacturer` | Also surfaces in `stats.vaccineRecords[]` (full history). |
| `MEDICATION` (用药)     | `medicationName`, optional `medicationDose` (string, e.g. `1包`) | `stats.medicationRecords[]` is bounded by `days`. |
| `AD_VITAMIN` (维生素AD) | `adGiven` (boolean) | `stats/day` and `stats` already include `adGiven` for daily checks. |
| `SLEEP` (睡眠)          | `sleepStartTime`, `sleepEndTime` (both with `+08:00`), optional `sleepQuality` | **For *querying* sleep, use `/api/sleep-summary`, NOT `/api/health?type=SLEEP`** — the summary endpoint splits cross-midnight sleep by Beijing day boundary. |

Example POSTs (one per type — copy the structure):
```jsonc
// WEIGHT
{ "babyId":"ID", "type":"WEIGHT",      "recordedAt":"2026-05-15T10:00:00+08:00", "weight":9.2 }
// HEIGHT
{ "babyId":"ID", "type":"HEIGHT",      "recordedAt":"2026-05-15T10:00:00+08:00", "height":66 }
// TEMPERATURE
{ "babyId":"ID", "type":"TEMPERATURE", "recordedAt":"2026-05-15T10:00:00+08:00", "temperature":36.8 }
// DIAPER
{ "babyId":"ID", "type":"DIAPER",      "recordedAt":"2026-05-15T10:00:00+08:00", "diaperType":"POOP", "diaperStatus":"多" }
// VACCINE — three vaccine fields are required
{ "babyId":"ID", "type":"VACCINE",     "recordedAt":"2026-05-15T09:30:00+08:00",
  "vaccineName":"五联疫苗", "vaccineManufacturer":"巴斯德",
  "vaccineDoseNumber":1, "vaccineTotalDoses":4 }
// MEDICATION
{ "babyId":"ID", "type":"MEDICATION",  "recordedAt":"2026-05-15T08:00:00+08:00", "medicationName":"益生菌", "medicationDose":"1包" }
// AD_VITAMIN
{ "babyId":"ID", "type":"AD_VITAMIN",  "recordedAt":"2026-05-15T08:00:00+08:00", "adGiven":true }
// SLEEP
{ "babyId":"ID", "type":"SLEEP",       "recordedAt":"2026-05-14T14:30:00+08:00",
  "sleepStartTime":"2026-05-14T13:00:00+08:00",
  "sleepEndTime":"2026-05-14T14:30:00+08:00" }
```

**GET response shape** for `/api/health` and `/api/feeding` records: each record returns its business fields above PLUS standard metadata `id`, `babyId`, `createdAt`, `updatedAt`, plus `recordedAt` (health) or `startTime` (feeding). Optional fields appear as `null` when unset.

---

## 4. Sleep summary (preferred query for sleep)

### GET `/api/sleep-summary?babyId=ID&date=YYYY-MM-DD`

```jsonc
{
  "date": "2026-05-14",
  "totalMinutes": 545,
  "count": 2,
  "segments": [
    {
      "id":           "cm...",                                 // sleep record id
      "sleepStart":   "2026-05-13T14:00:00.000Z",              // original record start (may span days)
      "sleepEnd":     "2026-05-13T19:30:00.000Z",              // original record end
      "segmentStart": "2026-05-13T16:00:00.000Z",              // portion belonging to queried date
      "segmentEnd":   "2026-05-13T19:30:00.000Z",
      "segmentMinutes": 210,
      "quality": null,                                         // sleep quality, may be null
      "note":    null,                                         // free-text note, may be null
      "isFullRecord": false                                    // false = original record crossed midnight; true = entirely within this date
    }
  ]
}
```

---

## 5. Stats

### GET `/api/stats/day?babyId=ID&date=YYYY-MM-DD` — single-day feeding summary

Returns: `breastFeedingCount`, `totalBreastDuration`, `breastBottleCount`, `totalBreastMilkAmount`, `formulaCount`, `totalFormulaAmount`, `adGiven`, plus `weight` / `temperature` only on days they were measured.

**Does NOT include**: height, diaper counts, sleep, vaccine, medication. For those, query separately or use `/api/stats`.

### GET `/api/stats?babyId=ID[&days=N]` — multi-day overview + trends (default 7, max 365)

```jsonc
{
  "baby": { "id":"...", "name":"...", "birthDate":"..." },
  "todayStats": {
    "date": "2026-05-14",
    "breastFeedingCount": 7, "totalBreastDuration": 60,
    "leftBreastDuration": 32, "rightBreastDuration": 28,
    "breastBottleCount": 1, "totalBreastMilkAmount": 70,
    "formulaCount": 0, "totalFormulaAmount": 0,
    "adGiven": false,
    "peeCount": 7, "poopCount": 3,
    "nightFeedingCount": 1,
    "sleepDurationMinutes": 615, "sleepCount": 3,
    "weight": 9.2, "height": undefined, "temperature": 36.8   // only on measurement days
  },
  "lastDays":          [ /* per-day records, length = days, each record has the SAME shape as todayStats above (some fields like weight/height appear only on measurement days) */ ],
  "totalStats":        { "totalFeedings":50, "totalFormulaAmount":0, "totalBreastDuration":500, "totalBreastMilkAmount":350 },
  "weightTrend":       [ { "date":"2026-01-01", "recordedAt":"2026-01-01T00:00:00.000Z", "weight":3.75 }, /* ... */ ],   // ALL history, sorted asc
  "heightTrend":       [ { "date":"2026-01-01", "recordedAt":"2026-01-01T00:00:00.000Z", "height":51 },   /* ... */ ],   // ALL history, sorted asc
  "vaccineRecords":    [ { "id":"...", "vaccineName":"五联疫苗", "date":"2026-05-07",
                           "vaccineDoseNumber":3, "vaccineTotalDoses":4 } /* ... */ ],                                  // ALL vaccines, never bounded by `days`
  "medicationRecords": [ { "id":"...", "medicationName":"益生菌", "medicationDose":null, "date":"2026-05-10" } /* ... */ ], // medications WITHIN `days`
  "feedingIntervals":  [120, 150, 180],                                                                                  // minutes between consecutive feedings
  "feedingHeatmap":    [ { "date":"2026-05-14", "hour":8, "count":2 } /* ... */ ],
  "babyBirthDate":     "2026-01-01"
}
```

**⚠️ `sleepDurationMinutes` is already cumulative & real-time.** It includes records you created seconds ago. Never compute `stats_total + latest_nap` — that double-counts. Trust the returned number.

---

## 6. Memo

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/memo[?babyId=&completed=true|false&date=YYYY-MM-DD&rangeDays=N]` | Sorted `scheduledAt` ASC. `rangeDays` (default 7, max 365) requires `date`. |
| POST   | `/api/memo` | Required: `babyId`, `title` (1-100), `scheduledAt` (with `+08:00`). Optional: `content` (≤500). |
| PUT    | `/api/memo/:id` | Patchable: `title`, `content`, `scheduledAt`, `completed` (true auto-sets `completedAt`, false clears it). |
| DELETE | `/api/memo/:id` | |

Memo record shape (returned by GET): `id`, `babyId`, `title`, `content` (string or null), `scheduledAt` (UTC `Z`), `completed` (bool), `completedAt` (UTC `Z` or null), `createdAt`, `updatedAt`.

---

## 7. Timeline dates

### GET `/api/timeline-dates?babyId=ID`
List of `YYYY-MM-DD` strings that have any record. Use to check whether a specific date has data before drilling in.
