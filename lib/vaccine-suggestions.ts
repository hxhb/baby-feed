import {
  buildVaccineProgressGroups,
  buildVaccineProgressKey,
  type VaccineProgressRecordLike,
} from './vaccine-progress.ts'

export interface VaccineSuggestion {
  key: string
  vaccineName: string
  vaccineManufacturer: string
  currentDoseNumber: number
  nextDoseNumber: number
  totalDoses: number
  latestRecordedAt: string
}

interface VaccineFieldValues {
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: string
  vaccineTotalDoses: string
}

export function buildVaccineSuggestionKey(vaccineName: string) {
  return buildVaccineProgressKey(vaccineName)
}

export function buildVaccineSuggestions(
  records: VaccineProgressRecordLike[],
  options?: { excludeRecordId?: string }
): VaccineSuggestion[] {
  return buildVaccineProgressGroups(records, options).flatMap(group => {
    if (
      group.currentDoseNumber == null ||
      group.totalDoses == null ||
      group.totalDoses <= 1 ||
      group.isCompleted
    ) {
      return []
    }

    return [{
      key: group.key,
      vaccineName: group.vaccineName,
      vaccineManufacturer: group.latestManufacturer,
      currentDoseNumber: group.currentDoseNumber,
      nextDoseNumber: group.currentDoseNumber + 1,
      totalDoses: group.totalDoses,
      latestRecordedAt: group.latestRecordedAt,
    }]
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
