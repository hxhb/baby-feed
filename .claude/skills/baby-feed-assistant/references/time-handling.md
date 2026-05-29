# Time Handling — UTC+8 (Beijing)

**Wrong timestamps are the #1 source of bugs in this app.** SKILL.md keeps the
3-line summary; this file is the full reference with examples and the bug
table. Read this when you're confused about timezone behavior, when a stored
timestamp shows up 8 hours off, or when handling sleep records that cross
midnight.

---

## Rule 1 — Sending times: always include `+08:00`

The server stores POSTed times via JS `new Date(value)`. The string must end
with `+08:00`, otherwise it's silently misinterpreted as UTC and ends up
8 hours off.

| Input | Stored as | Displayed as | Verdict |
|-------|-----------|--------------|---------|
| `2026-05-15T15:00:00`        | UTC 15:00 | Beijing 23:00 | ❌ wrong |
| `2026-05-15T15:00:00Z`       | UTC 15:00 | Beijing 23:00 | ❌ wrong |
| `2026-05-15T15:00:00+08:00`  | UTC 07:00 | Beijing 15:00 | ✅ correct |

This applies to every time field you send: `startTime`, `endTime`,
`recordedAt`, `sleepStartTime`, `sleepEndTime`, `scheduledAt`.

---

## Rule 2 — Re-fetch "now" for every record; never reuse a cached timestamp

Messages can arrive asynchronously (voice, queued events). A timestamp
captured minutes ago is stale. Run this fresh each time you need *now*:

```bash
date -u -d '+8 hours' '+%Y-%m-%dT%H:%M:%S+08:00'   # current Beijing time, ready for POST
date -u -d '+8 hours' '+%Y-%m-%d'                  # today's Beijing date (for ?date= GET param)
```

The trick: `-u` outputs in UTC, and `-d '+8 hours'` shifts forward 8h, so the
printed wall-clock equals Beijing time. This works regardless of the host's
local timezone.

---

## Rule 3 — Reading times: response timestamps are UTC, add 8h to display

API responses end with `Z` (UTC). To present to the user, add 8 hours — note
the date may roll over.

- `2026-05-15T07:00:00.000Z` → Beijing **15:00 on 2026-05-15**
- `2026-05-14T23:30:00.000Z` → Beijing **07:30 on 2026-05-15** (date changed!)

The `?date=YYYY-MM-DD` GET parameter is a Beijing date — the server handles
the UTC window internally, so don't pre-convert.
