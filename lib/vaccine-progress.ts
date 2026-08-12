export interface VaccineProgressRecordLike {
  id?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  recordedAt?: string | Date | null
  date?: string | null
  notes?: string | null
}

export interface VaccineDoseEntry {
  key: string
  id: string | null
  recordedAt: string
  doseNumber: number | null
  totalDoses: number | null
  manufacturer: string
  note: string | null
}

export interface VaccineProgressGroup {
  key: string
  vaccineName: string
  latestManufacturer: string
  currentDoseNumber: number | null
  totalDoses: number | null
  latestRecordedAt: string
  latestDate: string
  doseEntries: VaccineDoseEntry[]
  isCompleted: boolean
  remainingDoses: number | null
}

interface NormalizedVaccineRecord {
  id: string | null
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: number | null
  vaccineTotalDoses: number | null
  recordedAt: string
  recordedAtTime: number
  date: string
  notes: string | null
}

export function buildVaccineProgressKey(vaccineName: string) {
  return vaccineName.trim().toLowerCase()
}

function normalizeRecord(record: VaccineProgressRecordLike): NormalizedVaccineRecord | null {
  const vaccineName = typeof record.vaccineName === 'string' ? record.vaccineName.trim() : ''
  if (!vaccineName || record.recordedAt == null) {
    return null
  }

  const recordedAtTime = new Date(record.recordedAt).getTime()
  if (!Number.isFinite(recordedAtTime)) {
    return null
  }

  const recordedAt = new Date(recordedAtTime).toISOString()
  return {
    id: typeof record.id === 'string' ? record.id : null,
    vaccineName,
    vaccineManufacturer: typeof record.vaccineManufacturer === 'string' ? record.vaccineManufacturer.trim() : '',
    vaccineDoseNumber: typeof record.vaccineDoseNumber === 'number' ? record.vaccineDoseNumber : null,
    vaccineTotalDoses: typeof record.vaccineTotalDoses === 'number' ? record.vaccineTotalDoses : null,
    recordedAt,
    recordedAtTime,
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : recordedAt.slice(0, 10),
    notes: typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : null,
  }
}

function hasValidProgress(record: NormalizedVaccineRecord) {
  const doseNumber = record.vaccineDoseNumber
  const totalDoses = record.vaccineTotalDoses
  return Number.isInteger(doseNumber)
    && Number.isInteger(totalDoses)
    && doseNumber != null
    && totalDoses != null
    && doseNumber >= 1
    && totalDoses >= 1
    && doseNumber <= totalDoses
}

export function buildVaccineProgressGroups(
  records: VaccineProgressRecordLike[],
  options?: { excludeRecordId?: string }
): VaccineProgressGroup[] {
  const recordsByVaccine = new Map<string, NormalizedVaccineRecord[]>()

  for (const sourceRecord of records) {
    if (options?.excludeRecordId && sourceRecord.id === options.excludeRecordId) {
      continue
    }

    const record = normalizeRecord(sourceRecord)
    if (!record) {
      continue
    }

    const key = buildVaccineProgressKey(record.vaccineName)
    const group = recordsByVaccine.get(key) || []
    group.push(record)
    recordsByVaccine.set(key, group)
  }

  return Array.from(recordsByVaccine.entries()).map(([key, groupRecords]) => {
    const sortedRecords = [...groupRecords].sort((a, b) => {
      if (b.recordedAtTime !== a.recordedAtTime) {
        return b.recordedAtTime - a.recordedAtTime
      }
      return (b.id || '').localeCompare(a.id || '')
    })
    const latestRecord = sortedRecords[0]
    const latestProgressRecord = sortedRecords.find(hasValidProgress) || null
    const latestManufacturerRecord = sortedRecords.find(record => record.vaccineManufacturer) || null
    const currentDoseNumber = latestProgressRecord?.vaccineDoseNumber ?? null
    const totalDoses = latestProgressRecord?.vaccineTotalDoses ?? null
    const isCompleted = currentDoseNumber != null && totalDoses != null && currentDoseNumber >= totalDoses
    const remainingDoses = currentDoseNumber != null && totalDoses != null
      ? Math.max(totalDoses - currentDoseNumber, 0)
      : null

    return {
      key,
      vaccineName: latestProgressRecord?.vaccineName || latestRecord.vaccineName,
      latestManufacturer: latestProgressRecord?.vaccineManufacturer || latestManufacturerRecord?.vaccineManufacturer || '',
      currentDoseNumber,
      totalDoses,
      latestRecordedAt: latestProgressRecord?.recordedAt || latestRecord.recordedAt,
      latestDate: latestProgressRecord?.date || latestRecord.date,
      doseEntries: [...sortedRecords].reverse().map((record, index) => ({
        key: record.id || `${key}:${record.recordedAt}:${index}`,
        id: record.id,
        recordedAt: record.recordedAt,
        doseNumber: record.vaccineDoseNumber,
        totalDoses: record.vaccineTotalDoses,
        manufacturer: record.vaccineManufacturer,
        note: record.notes,
      })),
      isCompleted,
      remainingDoses,
    }
  }).sort((a, b) => {
    return new Date(b.latestRecordedAt).getTime() - new Date(a.latestRecordedAt).getTime()
  })
}
