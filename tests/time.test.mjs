import test from 'node:test'
import assert from 'node:assert/strict'

import { formatBeijingDateTimeLabel } from '../lib/time.ts'

test('Beijing date-time labels include the full year', () => {
  assert.equal(
    formatBeijingDateTimeLabel('2026-08-10T06:30:00.000Z'),
    '2026年8月10日 周一 14:30',
  )
})

test('Beijing date-time labels use the Beijing calendar year at UTC year boundaries', () => {
  assert.equal(
    formatBeijingDateTimeLabel('2025-12-31T16:30:00.000Z'),
    '2026年1月1日 周四 00:30',
  )
})
