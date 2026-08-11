import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOrderedToothEruptionEvents,
  formatToothNames,
  formatEruptionOrder,
  getToothDefinition,
  getPrimaryToothCodesValidationError,
  isPrimaryToothCode,
} from '../lib/tooth-eruptions.ts'

test('primary teeth use friendly names with side before jaw', () => {
  assert.equal(getToothDefinition('51')?.name, '右上门牙')
  assert.equal(getToothDefinition('61')?.name, '左上门牙')
  assert.equal(getToothDefinition('72')?.name, '左下侧门牙')
  assert.equal(getToothDefinition('83')?.name, '右下尖牙')
  assert.equal(getToothDefinition('55')?.name, '右上第二乳磨牙')
  assert.equal(formatToothNames(['71', '81']), '左下门牙、右下门牙')
})

test('primary tooth codes reject permanent and unknown teeth', () => {
  assert.equal(isPrimaryToothCode('51'), true)
  assert.equal(isPrimaryToothCode('85'), true)
  assert.equal(isPrimaryToothCode('11'), false)
  assert.equal(isPrimaryToothCode('99'), false)
})

test('tooth selection validation rejects empty, invalid, and duplicate arrays', () => {
  assert.equal(getPrimaryToothCodesValidationError(undefined), null)
  assert.equal(getPrimaryToothCodesValidationError(['71', '81']), null)
  assert.equal(getPrimaryToothCodesValidationError([]), '请选择 1 到 20 颗乳牙')
  assert.equal(getPrimaryToothCodesValidationError(['71', '11']), '牙位中包含无效的乳牙编号')
  assert.equal(getPrimaryToothCodesValidationError(['71', '71']), '牙位不能重复选择')
})

test('simultaneous teeth share one derived order range', () => {
  const ordered = buildOrderedToothEruptionEvents([
    {
      id: 'later',
      recordedAt: '2026-08-10T08:00:00.000Z',
      toothEruptions: [{ toothCode: '51' }],
    },
    {
      id: 'first',
      recordedAt: '2026-07-10T08:00:00.000Z',
      toothEruptions: [{ toothCode: '71' }, { toothCode: '81' }],
    },
  ])

  assert.deepEqual(ordered.map(item => ({
    id: item.event.id,
    start: item.orderStart,
    end: item.orderEnd,
  })), [
    { id: 'first', start: 1, end: 2 },
    { id: 'later', start: 3, end: 3 },
  ])
  assert.equal(formatEruptionOrder(1, 2), '第 1-2 颗（同时）')
  assert.equal(formatEruptionOrder(3, 3), '第 3 颗')
})

test('backfilled event dates deterministically recalculate the order', () => {
  const ordered = buildOrderedToothEruptionEvents([
    {
      id: 'created-first',
      recordedAt: '2026-08-01T00:00:00.000Z',
      createdAt: '2026-08-01T01:00:00.000Z',
      toothEruptions: [{ toothCode: '61' }],
    },
    {
      id: 'backfilled',
      recordedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-08-11T01:00:00.000Z',
      toothEruptions: [{ toothCode: '71' }],
    },
  ])

  assert.deepEqual(ordered.map(item => item.event.id), ['backfilled', 'created-first'])
})
