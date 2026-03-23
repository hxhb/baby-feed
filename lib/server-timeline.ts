import { prisma } from '@/lib/prisma'
import { getPreloadedBabies } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'
import { getBeijingToday } from '@/lib/time'
import { getBeijingDateStr, getBeijingDayRange } from '@/lib/api-helpers'

export interface PreloadedTimelineBaby {
  id: string
  name: string
}

export interface PreloadedTimelineFeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  adGiven?: boolean | null
  notes?: string | null
  babyId: string
  baby?: PreloadedTimelineBaby
  recordType: 'feeding'
}

export interface PreloadedTimelineHealthRecord {
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
  notes?: string | null
  babyId: string
  baby?: PreloadedTimelineBaby
  recordType: 'health'
}

export type PreloadedTimelineRecord = PreloadedTimelineFeedingRecord | PreloadedTimelineHealthRecord

export interface PreloadedTimelinePageData {
  initialBabies: Awaited<ReturnType<typeof getPreloadedBabies>>
  initialSelectedBabyId: string | null
  initialDate: string
  initialRecords: PreloadedTimelineRecord[]
  initialValidDates: string[]
}

export async function getTimelineValidDates(userId: string, babyId: string): Promise<string[]> {
  const [feedingDates, healthDates] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
      },
      select: {
        startTime: true,
      },
      orderBy: { startTime: 'desc' },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
      },
      select: {
        recordedAt: true,
      },
      orderBy: { recordedAt: 'desc' },
    }),
  ])

  const validDates = new Set<string>()

  feedingDates.forEach((record) => {
    validDates.add(getBeijingDateStr(record.startTime))
  })

  healthDates.forEach((record) => {
    validDates.add(getBeijingDateStr(record.recordedAt))
  })

  return Array.from(validDates).sort((a, b) => b.localeCompare(a))
}

async function getPreloadedTimelineRecords(userId: string, babyId: string, dateStr: string): Promise<PreloadedTimelineRecord[]> {
  const { start, end } = getBeijingDayRange(dateStr)

  const [feedingRecords, healthRecords] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        type: true,
        startTime: true,
        endTime: true,
        leftBreastDuration: true,
        rightBreastDuration: true,
        breastMilkAmount: true,
        formulaAmount: true,
        adGiven: true,
        notes: true,
        babyId: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
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
        medicationDose: true,
        vaccineName: true,
        vaccineManufacturer: true,
        vaccineDoseNumber: true,
        vaccineTotalDoses: true,
        diaperType: true,
        diaperStatus: true,
        adGiven: true,
        notes: true,
        babyId: true,
      },
    }),
  ])

  return [
    ...feedingRecords.map((record) => ({
      ...record,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime?.toISOString() ?? null,
      recordType: 'feeding' as const,
    })),
    ...healthRecords.map((record) => ({
      ...record,
      recordedAt: record.recordedAt.toISOString(),
      recordType: 'health' as const,
    })),
  ].sort((a, b) => {
    const timeA = new Date(a.recordType === 'feeding' ? a.startTime : a.recordedAt).getTime()
    const timeB = new Date(b.recordType === 'feeding' ? b.startTime : b.recordedAt).getTime()
    return timeB - timeA
  })
}

export async function getPreloadedTimelinePageData(): Promise<PreloadedTimelinePageData> {
  const session = await getServerSession()
  const initialDate = getBeijingToday()

  if (!session?.user?.id) {
    return {
      initialBabies: [],
      initialSelectedBabyId: null,
      initialDate,
      initialRecords: [],
      initialValidDates: [],
    }
  }

  const initialBabies = await getPreloadedBabies()
  const initialSelectedBabyId = initialBabies[0]?.id ?? null

  if (!initialSelectedBabyId) {
    return {
      initialBabies,
      initialSelectedBabyId: null,
      initialDate,
      initialRecords: [],
      initialValidDates: [],
    }
  }

  const [initialRecords, initialValidDates] = await Promise.all([
    getPreloadedTimelineRecords(session.user.id, initialSelectedBabyId, initialDate),
    getTimelineValidDates(session.user.id, initialSelectedBabyId),
  ])

  return {
    initialBabies,
    initialSelectedBabyId,
    initialDate,
    initialRecords,
    initialValidDates,
  }
}