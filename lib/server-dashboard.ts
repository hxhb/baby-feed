import { prisma } from '@/lib/prisma'
import { getBeijingToday } from '@/lib/time'
import { getBeijingDayRange } from '@/lib/api-helpers'
import { getPreloadedBabies, type PreloadedBaby } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'

export interface PreloadedDashboardFeedingRecord {
  id: string
  type: string
  startTime: string
  leftBreastDuration?: number
  rightBreastDuration?: number
  breastMilkAmount?: number
  formulaAmount?: number
  adGiven?: boolean
  notes?: string | null
  recordType: 'feeding'
}

export interface PreloadedDashboardHealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number
  height?: number
  temperature?: number
  medicationName?: string | null
  vaccineName?: string | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  recordType: 'health'
}

export interface PreloadedDashboardData {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialTodayRecords: PreloadedDashboardFeedingRecord[]
  initialTodayHealthRecords: PreloadedDashboardHealthRecord[]
}

export async function getPreloadedDashboardData(): Promise<PreloadedDashboardData> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return {
      initialBabies: [],
      initialSelectedBabyId: null,
      initialTodayRecords: [],
      initialTodayHealthRecords: [],
    }
  }

  const initialBabies = await getPreloadedBabies()
  const initialSelectedBabyId = initialBabies.activeBabyId || initialBabies.babies[0]?.id || null

  if (!initialSelectedBabyId) {
    return {
      initialBabies: initialBabies.babies,
      initialSelectedBabyId: null,
      initialTodayRecords: [],
      initialTodayHealthRecords: [],
    }
  }

  const today = getBeijingToday()
  const { start, end } = getBeijingDayRange(today)

  const [feedingRecords, healthRecords] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId: initialSelectedBabyId,
        createdBy: session.user.id,
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        type: true,
        startTime: true,
        leftBreastDuration: true,
        rightBreastDuration: true,
        breastMilkAmount: true,
        formulaAmount: true,
        adGiven: true,
        notes: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId: initialSelectedBabyId,
        createdBy: session.user.id,
        recordedAt: { gte: start, lte: end },
      },
      orderBy: { recordedAt: 'desc' },
      select: {
        id: true,
        type: true,
        recordedAt: true,
        weight: true,
        height: true,
        temperature: true,
        medicationName: true,
        vaccineName: true,
        diaperType: true,
        diaperStatus: true,
        adGiven: true,
        sleepStartTime: true,
        sleepEndTime: true,
        sleepQuality: true,
        notes: true,
      },
    }),
  ])

  return {
    initialBabies: initialBabies.babies,
    initialSelectedBabyId,
    initialTodayRecords: feedingRecords.map((record) => ({
      id: record.id,
      type: record.type,
      startTime: record.startTime.toISOString(),
      leftBreastDuration: record.leftBreastDuration ?? undefined,
      rightBreastDuration: record.rightBreastDuration ?? undefined,
      breastMilkAmount: record.breastMilkAmount ?? undefined,
      formulaAmount: record.formulaAmount ?? undefined,
      adGiven: record.adGiven ?? undefined,
      notes: record.notes,
      recordType: 'feeding',
    })),
    initialTodayHealthRecords: healthRecords.map((record) => ({
      id: record.id,
      type: record.type,
      recordedAt: record.recordedAt.toISOString(),
      weight: record.weight ?? undefined,
      height: record.height ?? undefined,
      temperature: record.temperature ?? undefined,
      medicationName: record.medicationName,
      vaccineName: record.vaccineName,
      diaperType: record.diaperType,
      diaperStatus: record.diaperStatus,
      adGiven: record.adGiven ?? undefined,
      sleepStartTime: record.sleepStartTime?.toISOString() ?? null,
      sleepEndTime: record.sleepEndTime?.toISOString() ?? null,
      sleepQuality: record.sleepQuality,
      notes: record.notes,
      recordType: 'health',
    })),
  }
}
