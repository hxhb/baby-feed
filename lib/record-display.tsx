import {
  Droplets,
  Milk,
  Pill,
  Scale,
  Thermometer,
  Ruler,
  Syringe,
  Baby as BabyIcon,
  Moon,
  UtensilsCrossed,
} from 'lucide-react'
import { formatBeijingTime } from '@/lib/time'

// Shared interfaces for record display
export interface FeedingRecordDisplay {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  solidFoodName?: string | null
  solidFoodAmount?: string | null
  adGiven?: boolean | null
  notes?: string | null
  recordType: 'feeding'
}

export interface HealthRecordDisplay {
  id: string
  type: string
  recordedAt: string
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  recordType: 'health'
}

export type DisplayRecord = FeedingRecordDisplay | HealthRecordDisplay

/**
 * Format breast feeding duration details
 */
export function formatBreastFeedingDetails(record: FeedingRecordDisplay) {
  const parts = [
    record.leftBreastDuration ? `左${record.leftBreastDuration}` : null,
    record.rightBreastDuration ? `右${record.rightBreastDuration}` : null,
  ].filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return '母乳亲喂'
  }

  return `母乳亲喂 (${parts.join(' ')}分钟)`
}

/**
 * Get the icon element for a given record type
 */
export function getRecordIcon(type: string, size: number = 20) {
  switch (type) {
    case 'BREAST_MILK':
    case 'BREAST_MILK_BOTTLE':
      return <Droplets size={size} className="text-pink-500" />
    case 'FORMULA':
      return <Milk size={size} className="text-blue-500" />
    case 'AD_VITAMIN':
      return <Pill size={size} className="text-orange-500" />
    case 'WEIGHT':
      return <Scale size={size} className="text-green-500" />
    case 'HEIGHT':
      return <Ruler size={size} className="text-blue-500" />
    case 'TEMPERATURE':
      return <Thermometer size={size} className="text-red-500" />
    case 'MEDICATION':
      return <Pill size={size} className="text-purple-500" />
    case 'VACCINE':
      return <Syringe size={size} className="text-teal-500" />
    case 'DIAPER':
      return <BabyIcon size={size} className="text-amber-500" />
    case 'SLEEP':
      return <Moon size={size} className="text-indigo-500" />
    case 'SOLID_FOOD':
      return <UtensilsCrossed size={size} className="text-orange-500" />
    default:
      return null
  }
}

/**
 * Get the display title string for a record
 */
export function getRecordTitle(record: DisplayRecord): string {
  switch (record.type) {
    case 'BREAST_MILK': {
      return formatBreastFeedingDetails(record as FeedingRecordDisplay)
    }
    case 'BREAST_MILK_BOTTLE': {
      const feeding = record as FeedingRecordDisplay
      return `母乳瓶喂 ${feeding.breastMilkAmount}ml`
    }
    case 'FORMULA': {
      const feeding = record as FeedingRecordDisplay
      return `奶粉喂养 ${feeding.formulaAmount}ml`
    }
    case 'AD_VITAMIN': {
      const health = record as HealthRecordDisplay
      return health.adGiven ? 'AD滴剂已服用' : 'AD滴剂未服用'
    }
    case 'WEIGHT': {
      const health = record as HealthRecordDisplay
      return `体重 ${health.weight}kg`
    }
    case 'HEIGHT': {
      const health = record as HealthRecordDisplay
      return `身高 ${health.height}cm`
    }
    case 'TEMPERATURE': {
      const health = record as HealthRecordDisplay
      return `体温 ${health.temperature}°C`
    }
    case 'MEDICATION': {
      const health = record as HealthRecordDisplay
      return `服药 ${health.medicationName} ${health.medicationDose || ''}`
    }
    case 'VACCINE': {
      const health = record as HealthRecordDisplay
      return `疫苗 ${health.vaccineName}`
    }
    case 'DIAPER': {
      const health = record as HealthRecordDisplay
      const typeText = health.diaperType === 'PEE' ? '小便' : health.diaperType === 'POOP' ? '大便' : '大小便'
      return `${typeText}${health.diaperStatus ? `(${health.diaperStatus})` : ''}`
    }
    case 'SLEEP': {
      const health = record as HealthRecordDisplay
      const sleepStart = health.sleepStartTime ? new Date(health.sleepStartTime) : null
      const sleepEnd = health.sleepEndTime ? new Date(health.sleepEndTime) : null
      if (sleepStart && sleepEnd) {
        const durationMin = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / (60 * 1000))
        const startStr = formatBeijingTime(health.sleepStartTime!)
        const endStr = formatBeijingTime(health.sleepEndTime!)
        if (durationMin > 0) {
          const hours = Math.floor(durationMin / 60)
          const mins = durationMin % 60
          const parts: string[] = []
          if (hours > 0) parts.push(`${hours}小时`)
          if (mins > 0) parts.push(`${mins}分钟`)
          const durationStr = parts.join('')
          return `睡眠 (${startStr}-${endStr} ${durationStr})`
        }
        return `睡眠 (${startStr}-${endStr})`
      }
      if (sleepStart) {
        const startStr = formatBeijingTime(health.sleepStartTime!)
        return `睡眠 (${startStr}入睡)`
      }
      return '睡眠记录'
    }
    case 'SOLID_FOOD': {
      const feeding = record as FeedingRecordDisplay
      const name = feeding.solidFoodName || '辅食'
      const amount = feeding.solidFoodAmount
      return `${name}${amount ? ` ${amount}` : ''}`
    }
    default:
      return '未知记录'
  }
}
