import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildIntervalFireKey,
  buildReminderConfigFingerprint,
  calculateRetryDelayMs,
  computeIntervalTiming,
  parseIntervalConfig,
  recordTypeMatches,
} from '../lib/reminder-core.ts'
import { buildWebhookEndpointDedupeKey } from '../lib/webhook-endpoint.ts'

test('the 16:08 and 17:01 evaluations stay in the same feeding reminder slot', () => {
  const latestFeeding = new Date('2026-08-07T05:08:00.000Z')
  const at1608 = computeIntervalTiming(
    latestFeeding,
    new Date('2026-08-07T08:08:23.638Z'),
    180,
    0,
  )
  const at1701 = computeIntervalTiming(
    latestFeeding,
    new Date('2026-08-07T09:01:17.476Z'),
    180,
    0,
  )

  assert.equal(at1608.shouldFire, true)
  assert.equal(at1608.slot, 0)
  assert.equal(at1608.elapsedMinutes, 180)
  assert.equal(at1608.nextCheckAt.toISOString(), '2026-08-07T11:08:23.638Z')
  assert.equal(at1701.shouldFire, true)
  assert.equal(at1701.slot, 0)
  assert.equal(at1701.elapsedMinutes, 233)
  assert.equal(
    buildIntervalFireKey('feeding-1308', at1608.slot),
    buildIntervalFireKey('feeding-1308', at1701.slot),
  )
})

test('a delayed evaluation still keeps a full interval before the next fire', () => {
  const timing = computeIntervalTiming(
    new Date('2026-08-07T05:08:00.000Z'),
    new Date('2026-08-07T11:07:00.000Z'),
    180,
    0,
  )

  assert.equal(timing.slot, 0)
  assert.equal(timing.nextCheckAt.toISOString(), '2026-08-07T14:07:00.000Z')
})

test('the supplied stale source reproduces 1681 minutes but has a different source key', () => {
  const stale = computeIntervalTiming(
    new Date('2026-08-06T05:00:00.000Z'),
    new Date('2026-08-07T09:01:17.476Z'),
    180,
    0,
  )

  assert.equal(stale.elapsedMinutes, 1681)
  assert.notEqual(
    buildIntervalFireKey('feeding-0806-1300', stale.slot),
    buildIntervalFireKey('feeding-0807-1308', 0),
  )
})

test('advance minutes move the due time without changing elapsed source semantics', () => {
  const timing = computeIntervalTiming(
    new Date('2026-08-07T05:08:00.000Z'),
    new Date('2026-08-07T07:53:00.000Z'),
    180,
    15,
  )

  assert.equal(timing.shouldFire, true)
  assert.equal(timing.dueAt.toISOString(), '2026-08-07T07:53:00.000Z')
  assert.equal(timing.elapsedMinutes, 180)
})

test('interval parsing and record filters reject malformed or irrelevant records', () => {
  assert.equal(parseIntervalConfig('{bad json'), null)
  assert.equal(parseIntervalConfig(JSON.stringify({ sourceType: 'feeding', intervalMinutes: 1.5 })), null)

  const config = parseIntervalConfig(JSON.stringify({
    sourceType: 'feeding',
    intervalMinutes: 180,
    filterCondition: { type: ['BREAST_MILK', 'FORMULA'] },
  }))
  assert.ok(config)
  assert.equal(recordTypeMatches(config, 'BREAST_MILK'), true)
  assert.equal(recordTypeMatches(config, 'SOLID_FOOD'), false)
})

test('fingerprints and endpoint keys are deterministic but change with state', () => {
  const first = buildReminderConfigFingerprint('interval', '{"intervalMinutes":180}', 0)
  assert.equal(first, buildReminderConfigFingerprint('interval', '{"intervalMinutes":180}', 0))
  assert.notEqual(first, buildReminderConfigFingerprint('interval', '{"intervalMinutes":240}', 0))

  const userId = 'user-1'
  assert.equal(
    buildWebhookEndpointDedupeKey(userId, 'https://EXAMPLE.com:443'),
    buildWebhookEndpointDedupeKey(userId, 'https://example.com/'),
  )
  assert.notEqual(
    buildWebhookEndpointDedupeKey(userId, 'https://example.com/a'),
    buildWebhookEndpointDedupeKey(userId, 'https://example.com/b'),
  )
})

test('retry backoff is exponential and capped at 24 hours', () => {
  assert.equal(calculateRetryDelayMs(1, 60), 60_000)
  assert.equal(calculateRetryDelayMs(3, 60), 240_000)
  assert.equal(calculateRetryDelayMs(99, 3600), 24 * 60 * 60 * 1000)
})
