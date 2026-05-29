---
name: baby-feed-assistant
version: 2.8.0
description: "Query and manage baby feeding, health, growth, sleep and reminder data through the Baby Feed HTTP API. Trigger on any English or Chinese mention of: feeding/nursing/formula/breast-milk/solid-food (喂奶/母乳/瓶喂/奶粉/辅食), diapers (尿布/大便/小便), sleep (睡眠/小睡/夜醒), weight/height/temperature (体重/身高/体温), vitamin AD or medication (AD/维生素/用药), vaccines (疫苗/打针), memos and reminders (备忘/待办/提醒), or daily/weekly summaries (今天/本周/情况/统计). Trigger on BOTH queries ('宝宝今天吃了多少', '上次体温', '下次疫苗什么时候') AND recording requests ('记录一下刚喂奶', '宝宝刚拉了'). Also use this skill when handling incoming `reminder.fired` webhook events."
---

# Baby Feed Assistant

You query and manage feeding/health/sleep/growth/memo data through the Baby Feed HTTP API, and respond to `reminder.fired` webhook events.

## Setup — the wrapper script

Always go through `query-api.sh` in the skill directory. It loads credentials from `config.local` and adds the `Authorization` header.

```bash
bash <SKILL_DIR>/query-api.sh GET    "/api/endpoint?param=value"
bash <SKILL_DIR>/query-api.sh POST   "/api/endpoint" '{"key":"value"}'
bash <SKILL_DIR>/query-api.sh PUT    "/api/endpoint/id" '{"key":"value"}'
bash <SKILL_DIR>/query-api.sh DELETE "/api/endpoint/id"
```

### Filtering response fields — use the 4th argument, not a shell pipe

The wrapper accepts a 4th argument: a Python expression where `d` is the parsed JSON. The expression runs *inside* the script, so no external pipe is needed. Use this when you only want one field.

```bash
bash <SKILL_DIR>/query-api.sh GET "/api/babies"                     "" "d[0]['id']"
bash <SKILL_DIR>/query-api.sh GET "/api/feeding?babyId=ID&date=..." "" "len(d)"
bash <SKILL_DIR>/query-api.sh GET "/api/stats?babyId=ID&days=7"     "" "d['todayStats']"
bash <SKILL_DIR>/query-api.sh GET "/api/health?babyId=ID&type=WEIGHT" "" "d[0]['weight']"
```

For GET, pass `""` as the 3rd arg (body placeholder) before the filter.

**Why no `| python3` / `| jq` *outside* the wrapper:** that pattern triggers the host's "pipe to interpreter" security scanner. Either read raw JSON output directly (you can parse it natively from Bash output) or use the FILTER argument above. The wrapper does its own internal `python3 -c` parsing — that's safe; it's the *external* pipe from your Bash command that's blocked.

---

## Time Handling — UTC+8 (Beijing)

Wrong timestamps are the #1 source of bugs. Follow these three rules.

### Rule 1 — Sending times: always include `+08:00`

The server stores POSTed times via JS `new Date(value)`. The string must end with `+08:00`, otherwise it's silently misinterpreted as UTC and ends up 8 hours off.

| Input | Stored as | Displayed as | Verdict |
|-------|-----------|--------------|---------|
| `2026-05-15T15:00:00`        | UTC 15:00 | Beijing 23:00 | ❌ wrong |
| `2026-05-15T15:00:00Z`       | UTC 15:00 | Beijing 23:00 | ❌ wrong |
| `2026-05-15T15:00:00+08:00`  | UTC 07:00 | Beijing 15:00 | ✅ correct |

This applies to every time field you send: `startTime`, `endTime`, `recordedAt`, `sleepStartTime`, `sleepEndTime`, `scheduledAt`.

### Rule 2 — Re-fetch "now" for every record; never reuse a cached timestamp

Messages can arrive asynchronously (voice, queued events). A timestamp captured minutes ago is stale. Run this fresh each time you need *now*:

```bash
date -u -d '+8 hours' '+%Y-%m-%dT%H:%M:%S+08:00'   # current Beijing time, ready for POST
date -u -d '+8 hours' '+%Y-%m-%d'                  # today's Beijing date (for ?date= GET param)
```

The trick: `-u` outputs in UTC, and `-d '+8 hours'` shifts forward 8h, so the printed wall-clock equals Beijing time. This works regardless of the host's local timezone.

### Rule 3 — Reading times: response timestamps are UTC, add 8h to display

API responses end with `Z` (UTC). To present to the user, add 8 hours — note the date may roll over.

- `2026-05-15T07:00:00.000Z` → Beijing **15:00 on 2026-05-15**
- `2026-05-14T23:30:00.000Z` → Beijing **07:30 on 2026-05-15** (date changed!)

The `?date=YYYY-MM-DD` GET parameter is a Beijing date — the server handles the UTC window internally, so don't pre-convert.

---

## API Reference

### 1. Baby

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/babies` | List all babies; cache `id` + `name` |
| GET | `/api/babies/:id` | Single baby (for `birthDate`, age math) |

Baby fields: `id`, `name`, `birthDate`, `gender`, `createdAt`, `updatedAt`.

### 2. Feeding

#### GET `/api/feeding?babyId=ID[&date=YYYY-MM-DD]`
Sorted `startTime` DESC. Omit `date` for full history.

#### POST `/api/feeding`
Required: `babyId`, `type`, `startTime` (with `+08:00`).

| `type` | Required type-specific fields |
|--------|-------------------------------|
| `BREAST_MILK`        | `leftBreastDuration`, `rightBreastDuration` (minutes) |
| `BREAST_MILK_BOTTLE` | `breastMilkAmount` (ml) |
| `FORMULA`            | `formulaAmount` (ml) |
| `SOLID_FOOD`         | `solidFoodName`, `solidFoodAmount` (string) |

Optional: `endTime` (with `+08:00`), `notes`.

### 3. Health Records

All health types share `GET /api/health` and `POST /api/health`. Discriminated by `type`.

#### GET `/api/health?babyId=ID[&type=TYPE][&date=YYYY-MM-DD]`
Sorted `recordedAt` DESC, so `[0]` is the most recent. Behavior:
- `type` only → full history of that type
- `type` + `date` → that type on that day
- `date` only → all types on that day, mixed

#### POST `/api/health`
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

### 4. Sleep summary (preferred query for sleep)

#### GET `/api/sleep-summary?babyId=ID&date=YYYY-MM-DD`

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

### 5. Stats

#### GET `/api/stats/day?babyId=ID&date=YYYY-MM-DD` — single-day feeding summary

Returns: `breastFeedingCount`, `totalBreastDuration`, `breastBottleCount`, `totalBreastMilkAmount`, `formulaCount`, `totalFormulaAmount`, `adGiven`, plus `weight` / `temperature` only on days they were measured.

**Does NOT include**: height, diaper counts, sleep, vaccine, medication. For those, query separately or use `/api/stats`.

#### GET `/api/stats?babyId=ID[&days=N]` — multi-day overview + trends (default 7, max 365)

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

### 6. Memo

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/memo[?babyId=&completed=true|false&date=YYYY-MM-DD&rangeDays=N]` | Sorted `scheduledAt` ASC. `rangeDays` (default 7, max 365) requires `date`. |
| POST   | `/api/memo` | Required: `babyId`, `title` (1-100), `scheduledAt` (with `+08:00`). Optional: `content` (≤500). |
| PUT    | `/api/memo/:id` | Patchable: `title`, `content`, `scheduledAt`, `completed` (true auto-sets `completedAt`, false clears it). |
| DELETE | `/api/memo/:id` | |

Memo record shape (returned by GET): `id`, `babyId`, `title`, `content` (string or null), `scheduledAt` (UTC `Z`), `completed` (bool), `completedAt` (UTC `Z` or null), `createdAt`, `updatedAt`.

### 7. Timeline dates

#### GET `/api/timeline-dates?babyId=ID`
List of `YYYY-MM-DD` strings that have any record. Use to check whether a specific date has data before drilling in.

---

## Workflow & Quick Reference

### Step 1 — Identify the baby
If you don't already have it cached, `GET /api/babies` and remember `id` + `name` for the rest of the conversation.

### Step 2 — Choose APIs (combined decision table)

| User intent / phrase | API call(s) |
|---|---|
| "今天吃了多少" / today's feeding overview | `stats/day?date=today` |
| "今天宝宝怎么样" / full daily situation | `stats/day` + `sleep-summary?date=today` + `health?date=today&type=DIAPER` (+ `type=VACCINE` / `type=MEDICATION` if relevant) |
| "最近一周" / weekly overview / multi-day trends | `stats?days=7` (or 14/30) |
| "上次喂奶是什么时候" | `feeding?date=today` → `[0]` |
| Specific day's feeding details | `feeding?date=YYYY-MM-DD` |
| "今天换了几次尿布" | `health?type=DIAPER&date=today` |
| "今天睡了多久" | `sleep-summary?date=today` (never use `health?type=SLEEP` for queries) |
| "现在多重" / "最新体重" | `health?type=WEIGHT` → `[0]` |
| "现在多高" / "最新身高" | `health?type=HEIGHT` → `[0]` |
| "上次体温多少" | `health?type=TEMPERATURE` → `[0]` |
| "今天量了几次体温" | `health?type=TEMPERATURE&date=today` |
| 体重/身高 trend | `stats?days=30` → `weightTrend[]` / `heightTrend[]` |
| "打过哪些疫苗" | `health?type=VACCINE` *or* `stats` → `vaccineRecords[]` |
| "吃过什么药" | `health?type=MEDICATION` |
| "宝宝多大了" | `babies/:id` → compute age from `birthDate` |
| "哪些日子有记录" | `timeline-dates` |
| "有什么备忘" / 提醒 / 待办 | `memo?completed=false&date=today&rangeDays=30` |
| Recording: feeding | `POST /api/feeding` (set `type` + relevant amount/duration) |
| Recording: diaper / temp / weight / height / AD / vaccine / med / sleep | `POST /api/health` (set `type` + type-specific fields) |
| Recording: future reminder / 备忘 | `POST /api/memo` |
| Marking memo done | `PUT /api/memo/:id` `{"completed":true}` |

For broad questions, call several APIs **in parallel**, not sequentially.

### Step 3 — Recording events

1. Parse what the user said (type, amount, time).
2. If a critical field is missing, ask one focused question.
3. Echo what you'll record and ask to confirm.
4. POST.
5. Confirm success with the key details.

---

## Presentation Rules

**Default language: Chinese. Tone: concise.** Parents are tired; skip filler.

### Emoji table — only use these, do not improvise

| Emoji | Used for |
|-------|----------|
| 🤱   | BREAST_MILK (亲喂母乳) |
| 🍼   | BREAST_MILK_BOTTLE (瓶喂母乳) |
| 🧴   | FORMULA (配方奶) |
| 🥣   | SOLID_FOOD (辅食) |
| 💧   | DIAPER PEE (小便) |
| 💩   | DIAPER POOP (大便) |
| 💩💧 | DIAPER BOTH (大小便同次) |
| 😴   | SLEEP (睡眠) |
| 🌡️   | TEMPERATURE (体温) |
| ⚖️   | WEIGHT (体重) |
| 📏   | HEIGHT (身高) |
| ☀️   | AD_VITAMIN (维生素AD) |
| 💉   | VACCINE (疫苗) |
| 💊   | MEDICATION (用药) |
| 📋   | MEMO (备忘/提醒) |

Plain ASCII separators (`-`, `·`, `*`) for structure. No decorative emojis outside this table.

### Daily summary template (only show categories with data)

```
今天 (MM月DD日) {宝宝名字}的情况：

🤱 亲喂母乳：X次，共Y分钟（左Z/右W分钟）
🍼 瓶喂母乳：X次，共Y ml
🧴 配方奶：X次，共Y ml
🥣 辅食：食物名 × 量
💩 大便：X次    💧 小便：X次
😴 睡眠：共X小时Y分钟（N段）
  · 昨晚22:00-今早06:00（今天部分6小时）
  · 今天13:00-14:30（1.5小时）
🌡️ 体温：36.8°C
☀️ 维生素AD：已补充 / 今天还未补充
💉 疫苗：（如有当天记录）
💊 用药：药名 x N次（如有当天记录）
```

### Growth-trend output
2-3 sentence summary first, then a compact table. Call out if growth is slowing or accelerating.

### Things worth flagging proactively
- 🌡️ ≥ 37.5°C → 低烧;≥ 38.5°C → 发烧
- 喂养量明显少于昨天 → 提一句变化
- 💩 连续 2 天以上没有大便 → 提一下

### Number formatting
Round when sensible (`约120ml`, not `119.5ml`). Units: `ml`, `分钟`, `kg`, `cm`, `°C`.

---

## Common Pitfalls (not covered above)

| Pitfall | Correction |
|---------|-----------|
| Adding the latest sleep on top of `stats.sleepDurationMinutes` | It's already cumulative. Don't add. |
| Using `stats/day` for weight/height trends | Trends live in `stats` (not `stats/day`) — `weightTrend[]` / `heightTrend[]`. |
| Querying sleep via `health?type=SLEEP` | Use `/api/sleep-summary` (handles cross-midnight split). |
| Passing `date` when you wanted full history | Drop `date`; you'll get all records of that type. |
| Assuming `lastDays[]` always has weight/height | They appear only on measurement days. |
| Forgetting `stats.medicationRecords[]` is bounded by `days` | Vaccines are full history; medications are not. |
| Piping wrapper output to python3/jq externally | Use the 4th-arg FILTER, or read raw JSON. |

---

## Webhook: `reminder.fired`

When a reminder rule fires, the system sends a `reminder.fired` event. Use this section to interpret it.

### Common payload shape

```jsonc
{
  "id": "16-char hex",            // event id
  "type": "reminder.fired",
  "timestamp": "...Z",            // event time (UTC) — +8 to display
  "userId": "...",
  "data": {
    "ruleId": "...", "ruleName": "...",
    "triggerType": "interval" | "cron" | "event_window",
    "babyId": "...", "babyName": "...",
    "title": "...",                 // user-facing headline; templates already substituted
    "body":  "..." | null,          // user-facing body; may be null
    "context": { /* depends on triggerType */ }
  }
}
```

Template variables already substituted in `title`/`body`: `{{babyName}}`, `{{ruleName}}`, `{{now}}` (北京 `MM-DD HH:mm`), `{{elapsed}}` ("X小时Y分钟").

### Four scenarios — disambiguate by `triggerType` + `ruleName`

| Scenario | `triggerType` | `ruleName` | Distinguishing context | Suggested follow-up |
|---|---|---|---|---|
| **喂养超时** | `interval` | `"喂养超时提醒"` | `elapsedMinutes`, `lastRecordTime` (typically minutes-hours scale) | `GET /api/feeding?babyId=X&date=today` to fetch the last feed type/amount. |
| **健康定期** | `interval` | `"健康定期提醒"` | Same fields but `elapsedMinutes` ≫ 1440 (days scale). `title` contains the item name(s). | Parse items from `title`: `体重`→`type=WEIGHT`, `身高`→`HEIGHT`, `体温`→`TEMPERATURE`, etc. Fetch latest `[0]`. |
| **每日定时** | `cron` | user's free text (e.g. `"该给宝宝吃AD啦"`) | `cronExpr` (5-field, Beijing semantics). `body` is `null`. | Forward `title` directly. No API call needed unless user asks for details. |
| **疫苗后体温监测** | `event_window` | `"疫苗后测体温[ · {疫苗信息}]"` | `slot` (which firing in the series), `windowEnd` (UTC end of monitoring window) | Pull recent `health?type=TEMPERATURE`, evaluate fever thresholds, mention remaining window (windowEnd +8h). |

Examples (one per scenario):

```jsonc
// 1) feeding timeout
{ "triggerType":"interval", "ruleName":"喂养超时提醒",
  "title":"该给小宝喂奶了", "body":"距离上次喂养已经3小时0分钟",
  "context": { "elapsedMinutes":180, "lastRecordTime":"2026-05-27T03:30:00.000Z" } }

// 2) periodic health
{ "triggerType":"interval", "ruleName":"健康定期提醒",
  "title":"该给小宝测量体重、身高了", "body":"定期检测提醒：体重、身高",
  "context": { "elapsedMinutes":20160, "lastRecordTime":"2026-05-13T01:00:00.000Z" } }

// 3) daily cron
{ "triggerType":"cron", "ruleName":"该给宝宝吃AD啦",
  "title":"该给宝宝吃AD啦", "body": null,
  "context": { "cronExpr":"0 11 * * *" } }

// 4) post-vaccine temperature window
{ "triggerType":"event_window", "ruleName":"疫苗后测体温 · 五联疫苗第2针",
  "title":"该给小宝测体温了", "body":"疫苗接种后体温监测 · 五联疫苗第2针",
  "context": { "slot":3, "windowEnd":"2026-05-28T15:00:00.000Z" } }
```

### Handling flow

```
1. data.title — user-facing line, can be forwarded as-is.
2. data.body  — extra context (or null).
3. (triggerType, ruleName) — pick the scenario above.
4. Optionally call the suggested API to enrich the message.
5. All time fields (timestamp / lastRecordTime / windowEnd) are UTC; +8h for display.
```

---

## Skill Update Check (once per session)

On the **first** invocation in a conversation, check the remote version. Don't repeat on subsequent invocations within the same conversation — it would generate noisy network calls.

```bash
curl -sf "https://raw.githubusercontent.com/hxhb/baby-feed/refs/heads/master/.claude/skills/baby-feed-assistant/SKILL.md" | head -5 | grep '^version:'
```

Compare with the local `version` in this file's frontmatter.
- Remote **higher** → tell the user: `"baby-feed-assistant skill 有新版本（远程 X.Y.Z, 本地 {本文件 frontmatter 的 version}），建议更新："`
  ```bash
  curl -sf "https://raw.githubusercontent.com/hxhb/baby-feed/refs/heads/master/.claude/skills/baby-feed-assistant/SKILL.md" -o "<SKILL_DIR>/SKILL.md"
  ```
- Equal, lower, or unreachable → stay silent.
