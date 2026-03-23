export type HealthType = 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN' | 'SLEEP'
export type DiaperType = 'PEE' | 'POOP' | 'BOTH'

export interface HealthFieldValues {
  weight: string
  height: string
  temperature: string
  medicationName: string
  medicationDose: string
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: string
  vaccineTotalDoses: string
  diaperType: DiaperType
  diaperStatus: string
  adGiven: boolean
  sleepStartTime: string
  sleepEndTime: string
  sleepQuality: string
}

export interface VaccineSuggestion {
  key: string
  vaccineName: string
  vaccineManufacturer: string
  nextDoseNumber: number
  totalDoses: number
  latestRecordedAt: string
}

interface VaccineRecordLike {
  id?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  recordedAt?: string | Date | null
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getRecordedAtValue(value: string | Date | null | undefined) {
  if (!value) {
    return 0
  }

  return new Date(value).getTime()
}

export function buildHealthRecordPayload(type: HealthType, values: HealthFieldValues): Record<string, unknown> {
  const basePayload = {
    weight: null,
    height: null,
    temperature: null,
    medicationName: null,
    medicationDose: null,
    vaccineName: null,
    vaccineManufacturer: null,
    vaccineDoseNumber: null,
    vaccineTotalDoses: null,
    diaperType: null,
    diaperStatus: null,
    adGiven: null,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepQuality: null,
  }

  if (type === 'WEIGHT') {
    return {
      ...basePayload,
      weight: Number.parseFloat(values.weight) || null,
    }
  }

  if (type === 'HEIGHT') {
    return {
      ...basePayload,
      height: Number.parseFloat(values.height) || null,
    }
  }

  if (type === 'TEMPERATURE') {
    return {
      ...basePayload,
      temperature: Number.parseFloat(values.temperature) || null,
    }
  }

  if (type === 'MEDICATION') {
    return {
      ...basePayload,
      medicationName: normalizeOptionalText(values.medicationName),
      medicationDose: normalizeOptionalText(values.medicationDose),
    }
  }

  if (type === 'VACCINE') {
    return {
      ...basePayload,
      vaccineName: normalizeOptionalText(values.vaccineName),
      vaccineManufacturer: normalizeOptionalText(values.vaccineManufacturer),
      vaccineDoseNumber: Number.parseInt(values.vaccineDoseNumber, 10) || null,
      vaccineTotalDoses: Number.parseInt(values.vaccineTotalDoses, 10) || null,
    }
  }

  if (type === 'DIAPER') {
    return {
      ...basePayload,
      diaperType: values.diaperType,
      diaperStatus: normalizeOptionalText(values.diaperStatus),
    }
  }

  if (type === 'AD_VITAMIN') {
    return {
      ...basePayload,
      adGiven: values.adGiven,
    }
  }

  // SLEEP
  return {
    ...basePayload,
    sleepStartTime: values.sleepStartTime || null,
    sleepEndTime: values.sleepEndTime || null,
    sleepQuality: values.sleepQuality.trim() || null,
  }
}

export function buildVaccineSuggestionKey(vaccineName: string, vaccineManufacturer: string) {
  return `${vaccineName.trim().toLowerCase()}::${vaccineManufacturer.trim().toLowerCase()}`
}

export function buildVaccineSuggestions(
  records: VaccineRecordLike[],
  options?: { excludeRecordId?: string }
): VaccineSuggestion[] {
  const suggestionsMap = records.reduce<Map<string, VaccineSuggestion>>((acc, record) => {
    if (options?.excludeRecordId && record.id === options.excludeRecordId) {
      return acc
    }

    if (
      typeof record?.vaccineName !== 'string' ||
      record.recordedAt == null ||
      typeof record?.vaccineDoseNumber !== 'number' ||
      typeof record?.vaccineTotalDoses !== 'number'
    ) {
      return acc
    }

    const normalizedName = record.vaccineName.trim()
    const normalizedManufacturer = typeof record.vaccineManufacturer === 'string' ? record.vaccineManufacturer.trim() : ''
    const doseNumber = record.vaccineDoseNumber
    const totalDoses = record.vaccineTotalDoses

    if (!normalizedName || totalDoses <= 1 || doseNumber < 1 || doseNumber >= totalDoses) {
      return acc
    }

    const key = buildVaccineSuggestionKey(normalizedName, normalizedManufacturer)
    const nextSuggestion: VaccineSuggestion = {
      key,
      vaccineName: normalizedName,
      vaccineManufacturer: normalizedManufacturer,
      nextDoseNumber: doseNumber + 1,
      totalDoses,
      latestRecordedAt: new Date(record.recordedAt).toISOString(),
    }

    const existingSuggestion = acc.get(key)
    if (!existingSuggestion || getRecordedAtValue(nextSuggestion.latestRecordedAt) > getRecordedAtValue(existingSuggestion.latestRecordedAt)) {
      acc.set(key, nextSuggestion)
    }

    return acc
  }, new Map())

  return Array.from(suggestionsMap.values()).sort((a, b) => {
    return getRecordedAtValue(b.latestRecordedAt) - getRecordedAtValue(a.latestRecordedAt)
  })
}

export function findSelectedVaccineSuggestion(
  suggestions: VaccineSuggestion[],
  values: Pick<HealthFieldValues, 'vaccineName' | 'vaccineManufacturer' | 'vaccineDoseNumber' | 'vaccineTotalDoses'>
) {
  const normalizedName = values.vaccineName.trim().toLowerCase()
  const normalizedManufacturer = values.vaccineManufacturer.trim().toLowerCase()

  return suggestions.find((suggestion) => {
    return (
      suggestion.vaccineName.trim().toLowerCase() === normalizedName &&
      suggestion.vaccineManufacturer.trim().toLowerCase() === normalizedManufacturer &&
      String(suggestion.nextDoseNumber) === values.vaccineDoseNumber &&
      String(suggestion.totalDoses) === values.vaccineTotalDoses
    )
  })
}
