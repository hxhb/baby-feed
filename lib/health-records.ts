import { toBeijingISO } from '@/lib/time'
import type { PrimaryToothCode } from '@/lib/tooth-eruptions'

export {
  buildVaccineSuggestionKey,
  buildVaccineSuggestions,
  findSelectedVaccineSuggestion,
} from '@/lib/vaccine-suggestions'
export type { VaccineSuggestion } from '@/lib/vaccine-suggestions'

export const HEALTH_TYPES = ['WEIGHT', 'HEIGHT', 'TEMPERATURE', 'MEDICATION', 'VACCINE', 'DIAPER', 'AD_VITAMIN', 'SLEEP', 'TOOTH_ERUPTION', 'CUSTOM'] as const
export type HealthType = typeof HEALTH_TYPES[number]
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
  vitaminDGiven: boolean
  customName: string
  sleepStartTime: string
  sleepEndTime: string
  sleepQuality: string
  toothCodes: PrimaryToothCode[]
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
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
    vitaminDGiven: null,
    customName: null,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepQuality: null,
    toothCodes: null,
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
      vitaminDGiven: values.vitaminDGiven,
    }
  }

  if (type === 'CUSTOM') {
    return {
      ...basePayload,
      customName: normalizeOptionalText(values.customName),
    }
  }

  if (type === 'TOOTH_ERUPTION') {
    return {
      ...basePayload,
      toothCodes: values.toothCodes,
    }
  }

  // SLEEP — convert datetime-local values to Beijing timezone ISO strings
  return {
    ...basePayload,
    sleepStartTime: values.sleepStartTime ? toBeijingISO(values.sleepStartTime) : null,
    sleepEndTime: values.sleepEndTime ? toBeijingISO(values.sleepEndTime) : null,
    sleepQuality: values.sleepQuality.trim() || null,
  }
}
