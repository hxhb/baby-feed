import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVaccineProgressGroups } from '../lib/vaccine-progress.ts'

test('vaccine progress groups same-name doses across manufacturers', () => {
  const groups = buildVaccineProgressGroups([
    {
      id: 'dose-2',
      vaccineName: ' 乙肝疫苗 ',
      vaccineDoseNumber: 2,
      vaccineTotalDoses: 3,
      recordedAt: '2026-02-01T08:00:00.000Z',
      date: '2026-02-01',
    },
    {
      id: 'dose-3',
      vaccineName: '乙肝疫苗',
      vaccineManufacturer: '厂家 B',
      vaccineDoseNumber: 3,
      vaccineTotalDoses: 3,
      recordedAt: '2026-03-01T08:00:00.000Z',
      date: '2026-03-01',
    },
    {
      id: 'dose-1',
      vaccineName: '乙肝疫苗',
      vaccineManufacturer: '厂家 A',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 3,
      recordedAt: '2026-01-01T08:00:00.000Z',
      date: '2026-01-01',
    },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.currentDoseNumber, 3)
  assert.equal(groups[0]?.totalDoses, 3)
  assert.equal(groups[0]?.isCompleted, true)
  assert.equal(groups[0]?.latestManufacturer, '厂家 B')
  assert.deepEqual(groups[0]?.doseEntries.map(entry => entry.doseNumber), [1, 2, 3])
})

test('latest valid vaccine progress wins regardless of input order or an invalid legacy row', () => {
  const groups = buildVaccineProgressGroups([
    {
      id: 'invalid-latest',
      vaccineName: '五联疫苗',
      vaccineDoseNumber: null,
      vaccineTotalDoses: null,
      recordedAt: '2026-04-01T08:00:00.000Z',
    },
    {
      id: 'dose-1',
      vaccineName: '五联疫苗',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 4,
      recordedAt: '2026-01-01T08:00:00.000Z',
    },
    {
      id: 'dose-3',
      vaccineName: '五联疫苗',
      vaccineDoseNumber: 3,
      vaccineTotalDoses: 4,
      recordedAt: '2026-03-01T08:00:00.000Z',
    },
  ])

  assert.equal(groups[0]?.currentDoseNumber, 3)
  assert.equal(groups[0]?.totalDoses, 4)
  assert.equal(groups[0]?.remainingDoses, 1)
  assert.equal(groups[0]?.isCompleted, false)
})

test('a vaccine with only legacy records missing progress remains visible for correction', () => {
  const groups = buildVaccineProgressGroups([
    {
      id: 'legacy',
      vaccineName: '旧疫苗记录',
      vaccineManufacturer: '旧厂家',
      vaccineDoseNumber: null,
      vaccineTotalDoses: null,
      recordedAt: '2025-01-01T08:00:00.000Z',
    },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.currentDoseNumber, null)
  assert.equal(groups[0]?.totalDoses, null)
  assert.equal(groups[0]?.isCompleted, false)
  assert.equal(groups[0]?.remainingDoses, null)
  assert.equal(groups[0]?.latestManufacturer, '旧厂家')
})
