const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

interface HealthHistoryRecordLike {
  id?: string | null
  recordedAt?: string | Date | null
  weight?: number | null
  height?: number | null
  medicationName?: string | null
  medicationDose?: string | null
}

export interface PreviousMeasurementRecord {
  value: number
  recordedAt: string
}

export interface MedicationSuggestion {
  key: string
  medicationName: string
  medicationDose: string
  latestRecordedAt: string
}

function getTime(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function findPreviousMeasurementRecord(
  records: HealthHistoryRecordLike[],
  type: 'WEIGHT' | 'HEIGHT',
  before: string | Date
): PreviousMeasurementRecord | null {
  const beforeTime = getTime(before)
  if (beforeTime == null) {
    return null
  }

  const valueField = type === 'WEIGHT' ? 'weight' : 'height'
  let previous: PreviousMeasurementRecord | null = null
  let previousTime = Number.NEGATIVE_INFINITY

  for (const record of records) {
    const recordedTime = getTime(record.recordedAt)
    const value = record[valueField]
    if (recordedTime == null || recordedTime >= beforeTime || typeof value !== 'number' || !(value > 0)) {
      continue
    }

    if (recordedTime > previousTime) {
      previous = {
        value,
        recordedAt: new Date(recordedTime).toISOString(),
      }
      previousTime = recordedTime
    }
  }

  return previous
}

export function buildRecentMedicationSuggestions(
  records: HealthHistoryRecordLike[],
  referenceAt: string | Date
): MedicationSuggestion[] {
  const referenceTime = getTime(referenceAt)
  if (referenceTime == null) {
    return []
  }

  const earliestTime = referenceTime - THREE_DAYS_MS
  const suggestions = new Map<string, MedicationSuggestion>()

  for (const record of records) {
    const recordedTime = getTime(record.recordedAt)
    const medicationName = typeof record.medicationName === 'string' ? record.medicationName.trim() : ''
    const medicationDose = typeof record.medicationDose === 'string' ? record.medicationDose.trim() : ''

    if (!medicationName || recordedTime == null || recordedTime < earliestTime || recordedTime > referenceTime) {
      continue
    }

    const key = `${medicationName.toLowerCase()}::${medicationDose.toLowerCase()}`
    const existing = suggestions.get(key)
    if (!existing || recordedTime > new Date(existing.latestRecordedAt).getTime()) {
      suggestions.set(key, {
        key,
        medicationName,
        medicationDose,
        latestRecordedAt: new Date(recordedTime).toISOString(),
      })
    }
  }

  return Array.from(suggestions.values()).sort((a, b) => {
    return new Date(b.latestRecordedAt).getTime() - new Date(a.latestRecordedAt).getTime()
  })
}
