import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecentMedicationSuggestions,
  findPreviousMeasurementRecord,
} from '../lib/health-record-history.ts'

test('previous measurement is the latest valid record before the new record time', () => {
  const records = [
    { weight: 7.8, recordedAt: '2026-08-01T08:00:00.000Z' },
    { weight: 8.1, recordedAt: '2026-08-10T08:00:00.000Z' },
    { weight: 8.2, recordedAt: '2026-08-12T08:00:00.000Z' },
    { weight: 0, recordedAt: '2026-08-11T08:00:00.000Z' },
  ]

  assert.deepEqual(
    findPreviousMeasurementRecord(records, 'WEIGHT', '2026-08-11T00:00:00.000Z'),
    { value: 8.1, recordedAt: '2026-08-10T08:00:00.000Z' },
  )
  assert.equal(findPreviousMeasurementRecord(records, 'HEIGHT', '2026-08-11T00:00:00.000Z'), null)
})

test('recent medication suggestions use the preceding 72 hours and deduplicate matching prescriptions', () => {
  const suggestions = buildRecentMedicationSuggestions([
    {
      medicationName: '布洛芬',
      medicationDose: '2ml',
      recordedAt: '2026-08-09T04:00:00.000Z',
    },
    {
      medicationName: ' 布洛芬 ',
      medicationDose: '2ML',
      recordedAt: '2026-08-11T12:00:00.000Z',
    },
    {
      medicationName: '蒙脱石散',
      medicationDose: '半袋',
      recordedAt: '2026-08-09T12:00:00.000Z',
    },
    {
      medicationName: '过期记录',
      medicationDose: '1片',
      recordedAt: '2026-08-09T03:59:59.000Z',
    },
    {
      medicationName: '未来记录',
      recordedAt: '2026-08-12T04:01:00.000Z',
    },
  ], '2026-08-12T04:00:00.000Z')

  assert.deepEqual(suggestions, [
    {
      key: '布洛芬::2ml',
      medicationName: '布洛芬',
      medicationDose: '2ML',
      latestRecordedAt: '2026-08-11T12:00:00.000Z',
    },
    {
      key: '蒙脱石散::半袋',
      medicationName: '蒙脱石散',
      medicationDose: '半袋',
      latestRecordedAt: '2026-08-09T12:00:00.000Z',
    },
  ])
})
