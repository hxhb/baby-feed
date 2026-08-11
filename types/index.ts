import type { FeedingType } from '@/lib/feeding-records'
import type { HealthType } from '@/lib/health-records'
import type { PrimaryToothCode } from '@/lib/tooth-eruptions'

export type { FeedingType } from '@/lib/feeding-records'

export interface User {
  id: string
  email: string
  name: string
}

export interface SessionUser extends User {
  id: string
  role: string
}

export interface Baby {
  id: string
  name: string
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type HealthRecordType = HealthType

export interface FeedingRecord {
  id: string
  babyId: string
  type: FeedingType
  leftBreastDuration?: number
  rightBreastDuration?: number
  breastMilkAmount?: number
  formulaAmount?: number
  startTime: string
  endTime?: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  baby?: Baby
}

export interface HealthRecord {
  id: string
  babyId: string
  type: HealthRecordType
  weight?: number
  height?: number
  temperature?: number
  medicationName?: string
  medicationDose?: string
  vaccineName?: string
  diaperType?: 'PEE' | 'POOP' | 'BOTH'
  diaperStatus?: string
  adGiven?: boolean
  vitaminDGiven?: boolean
  customName?: string
  sleepStartTime?: string
  sleepEndTime?: string
  sleepQuality?: string
  toothEruptions?: { toothCode: PrimaryToothCode }[]
  recordedAt: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  baby?: Baby
}

export interface DailyStats {
  date: string
  breastFeedingCount: number
  totalBreastDuration: number
  formulaCount: number
  totalFormulaAmount: number
  adGiven: boolean
  vitaminDGiven: boolean
  weight?: number
  temperature?: number
}

export interface BabyStats {
  baby: Baby
  todayStats: DailyStats
  last7Days: DailyStats[]
  totalFeedings: number
  totalFormulaAmount: number
}
