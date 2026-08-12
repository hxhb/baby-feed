export interface VaccineSuggestion {
  key: string
  vaccineName: string
  vaccineManufacturer: string
  currentDoseNumber: number
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

interface VaccineFieldValues {
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: string
  vaccineTotalDoses: string
}

function getRecordedAtValue(value: string | Date | null | undefined) {
  if (!value) {
    return 0
  }

  return new Date(value).getTime()
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

    if (!normalizedName || totalDoses < 1 || doseNumber < 1 || doseNumber > totalDoses) {
      return acc
    }

    const key = buildVaccineSuggestionKey(normalizedName, normalizedManufacturer)
    const nextSuggestion: VaccineSuggestion = {
      key,
      vaccineName: normalizedName,
      vaccineManufacturer: normalizedManufacturer,
      currentDoseNumber: doseNumber,
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

  return Array.from(suggestionsMap.values())
    .filter(suggestion => suggestion.totalDoses > 1 && suggestion.currentDoseNumber < suggestion.totalDoses)
    .sort((a, b) => {
      return getRecordedAtValue(b.latestRecordedAt) - getRecordedAtValue(a.latestRecordedAt)
    })
}

export function findSelectedVaccineSuggestion(
  suggestions: VaccineSuggestion[],
  values: VaccineFieldValues
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
