import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVaccineSuggestions } from '../lib/vaccine-suggestions.ts'

test('vaccine suggestions include only vaccines whose latest dose is incomplete', () => {
  const suggestions = buildVaccineSuggestions([
    {
      id: 'completed-dose-1',
      vaccineName: '乙肝疫苗',
      vaccineManufacturer: '厂家 A',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 2,
      recordedAt: '2026-01-01T08:00:00.000Z',
    },
    {
      id: 'completed-dose-2',
      vaccineName: '乙肝疫苗',
      vaccineManufacturer: '厂家 A',
      vaccineDoseNumber: 2,
      vaccineTotalDoses: 2,
      recordedAt: '2026-02-01T08:00:00.000Z',
    },
    {
      id: 'pending-dose-1',
      vaccineName: '五联疫苗',
      vaccineManufacturer: '厂家 B',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 4,
      recordedAt: '2026-03-01T08:00:00.000Z',
    },
    {
      id: 'pending-dose-2',
      vaccineName: '五联疫苗',
      vaccineManufacturer: '厂家 B',
      vaccineDoseNumber: 2,
      vaccineTotalDoses: 4,
      recordedAt: '2026-04-01T08:00:00.000Z',
    },
  ])

  assert.deepEqual(suggestions, [
    {
      key: '五联疫苗',
      vaccineName: '五联疫苗',
      vaccineManufacturer: '厂家 B',
      currentDoseNumber: 2,
      nextDoseNumber: 3,
      totalDoses: 4,
      latestRecordedAt: '2026-04-01T08:00:00.000Z',
    },
  ])
})

test('excluding the edited record recalculates the previous vaccine progress', () => {
  const suggestions = buildVaccineSuggestions([
    {
      id: 'dose-1',
      vaccineName: '脊灰疫苗',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 3,
      recordedAt: '2026-01-01T08:00:00.000Z',
    },
    {
      id: 'dose-2',
      vaccineName: '脊灰疫苗',
      vaccineDoseNumber: 2,
      vaccineTotalDoses: 3,
      recordedAt: '2026-02-01T08:00:00.000Z',
    },
  ], { excludeRecordId: 'dose-2' })

  assert.equal(suggestions[0]?.currentDoseNumber, 1)
  assert.equal(suggestions[0]?.nextDoseNumber, 2)
  assert.equal(suggestions[0]?.totalDoses, 3)
})

test('a latest single-dose completion suppresses an older incomplete suggestion', () => {
  const suggestions = buildVaccineSuggestions([
    {
      id: 'old-multi-dose',
      vaccineName: '流感疫苗',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 2,
      recordedAt: '2025-08-01T08:00:00.000Z',
    },
    {
      id: 'latest-single-dose',
      vaccineName: '流感疫苗',
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 1,
      recordedAt: '2026-08-01T08:00:00.000Z',
    },
  ])

  assert.deepEqual(suggestions, [])
})

test('manufacturer changes do not split one vaccine course into incomplete suggestions', () => {
  const suggestions = buildVaccineSuggestions([
    {
      id: 'hepatitis-b-1',
      vaccineName: '乙肝(酿酒酵母)',
      vaccineManufacturer: null,
      vaccineDoseNumber: 1,
      vaccineTotalDoses: 3,
      recordedAt: '2026-01-02T07:02:00.000Z',
    },
    {
      id: 'hepatitis-b-2',
      vaccineName: '乙肝(酿酒酵母)',
      vaccineManufacturer: '',
      vaccineDoseNumber: 2,
      vaccineTotalDoses: 3,
      recordedAt: '2026-02-10T01:20:00.000Z',
    },
    {
      id: 'hepatitis-b-3',
      vaccineName: '乙肝(酿酒酵母)',
      vaccineManufacturer: '深圳康泰',
      vaccineDoseNumber: 3,
      vaccineTotalDoses: 3,
      recordedAt: '2026-07-04T01:35:00.000Z',
    },
  ])

  assert.deepEqual(suggestions, [])
})
