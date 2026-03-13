export interface User {
  id: string
  email: string
  name: string
}

export interface SessionUser extends User {
  id: string
}

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
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

export type FeedingType = 'BREAST_MILK' | 'BREAST_MILK_BOTTLE' | 'FORMULA'
export type HealthRecordType = 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN'

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
